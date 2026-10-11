"""Reproduce published FLife regression and an end-to-end sine/random benchmark.

Usage: python3 verify_audit.py --flife-root /path/to/pinned/FLife
Requires numpy, scipy, matplotlib and tkinter (FLife imports it, no GUI is opened).
The external repository is never modified or installed. Only its spectral-data,
Dirlik and narrowband modules are loaded; its large optional GUI imports are avoided.
"""
import argparse, hashlib, importlib.util, json, math, subprocess, sys, types
from pathlib import Path
import numpy as np
from scipy.integrate import quad
from scipy.optimize import minimize_scalar

ROOT = Path(__file__).resolve().parent
PIN = 'f39ba53d608b3338b16c9ebb5bd52c86635898b0'
parser = argparse.ArgumentParser()
parser.add_argument('--flife-root', required=True, type=Path)
args = parser.parse_args()
external = args.flife_root.resolve()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=external,text=True).strip()==PIN
assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=external,text=True).strip(), 'Reference checkout must be unmodified'
pkg=types.ModuleType('audit_flife');pkg.__path__=[str(external/'FLife')];sys.modules['audit_flife']=pkg
def module(name, file):
    spec=importlib.util.spec_from_file_location('audit_flife.'+name,external/'FLife'/file)
    obj=importlib.util.module_from_spec(spec);sys.modules[spec.name]=obj;spec.loader.exec_module(obj)
    return obj
SD=module('spectralData','spectralData.py').SpectralData
DK=module('dirlik','freq_domain/dirlik.py').Dirlik
NB=module('narrowband','freq_domain/narrowband.py').Narrowband
def engine(expression, data):
    script="const V=require('./engine.js'),x=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify("+expression+"));"
    return json.loads(subprocess.check_output(['node','-e',script],input=json.dumps(data),text=True,cwd=ROOT))
def rel(a,b): return abs(a/b-1)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

# A: exact dataset and settings from the upstream tests/test_basic.py.
data=np.load(external/'data/m1.npy');t=data[::2];x=data[1::2];x=100*x/np.std(x)
sd=SD(input={'time_history':x,'dt':t[1]},nperseg=int(.1/t[1]))
orders=[0,1,2,4]
mhz=[float(sd.moments[j]/(2*math.pi)**j) for j in orders]
# z/zref is numerically stress amplitude in MPa for this kernel-only test.
r=engine('V.spectral(x.m.map(v=>v*V.ZREF**2),x.b,1)',{'m':mhz,'b':6})
C=1.8e19
a=dict(source_commit=PIN,source='tests/test_basic.py::test_data',C=C,b=6,
       sample_count=len(x),dt=float(t[1]),rms=100,nperseg=int(.1/t[1]),
       stress_moments_Hz=mhz,published_seconds={'Dirlik':1595.031603,'Narrowband':1064.200649},
       flife_seconds={'Dirlik':float(DK(sd).get_life(C,6)),'Narrowband':float(NB(sd).get_life(C,6))},
       tool_seconds={'Dirlik':C/r['dirlik'],'Narrowband':C/r['nb']})
for method in a['published_seconds']:
    assert abs(a['tool_seconds'][method]-a['published_seconds'][method])<1e-6
    assert rel(a['tool_seconds'][method],a['flife_seconds'][method])<1e-11
a['fractional_b_check']={}
for b in [2,4.5,7.3,12]:
    v=engine('V.spectral(x.m.map(v=>v*V.ZREF**2),x.b,1)',{'m':mhz,'b':b})
    ref=1/DK(sd).get_life(1,b)
    assert rel(v['dirlik'],ref)<1e-11
    a['fractional_b_check'][str(b)]=rel(v['dirlik'],ref)

# B: independently integrate the same base environment, FRF, Q, b and duration.
case=json.loads((ROOT/'example-case.json').read_text())
case['version']='1.0.2'
case['inputs'].update(caseName='Reference example: 100 Hz sine dwell / 90-110 Hz random',
    basis='Irvine (2011), random_sine_rainflow.pdf, second method: 1 g peak at 100 Hz for 30 s; 0.03 g^2/Hz from 90 to 110 Hz for 30 s; Q=10, b=4. The tool uses relative displacement and stationary spectral expected damage. Compare like-for-like with FLife; the published acceleration rainflow sample is not an exact target.',
    Q='10',b='4',passes='0',duration='0.5',randomRepeats='1',sineScale='1',psdDb='0',damageFactor='1',
    sineText='90,110,accel_g_pk,1,1',dwellText='100,1,0,3000,1',psdText='90,0.03\n110,0.03',
    fmin='90',fmax='110',density=48,modesText='100',inspectFn='100',scope='modes',method='dirlik',example=True)
base=engine('V.atMode(V.parse(x),100)',case['inputs'])
wn=2*math.pi*100;g=9.80665;zref=.001;T=30;b=4
def h(f): return g/np.hypot(wn**2-(2*np.pi*f)**2,wn*2*np.pi*f/10)
refs=[]
for n in [20001,40001]:
    f=np.linspace(90,110,n)
    # SpectralData integrates radians moments internally. PSD is of z/zref.
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',UserWarning)
        sr=SD(input={'PSD':.03*(h(f)/zref)**2,'f':f})
    refs.append({'points':n,'dirlik':float(T/DK(sr).get_life(1,b)),
                 'nb':float(T/NB(sr).get_life(1,b)),'sigma_mm':float(np.sqrt(sr.moments[0]))})
exact_dwell=3000*(g*10/wn**2/zref)**b
assert rel(base['dwell'],exact_dwell)<1e-12
for key in ['dirlik','nb']:
    assert rel(base[key],refs[-1][key])<1e-8
    assert rel(refs[-1][key],refs[0][key])<1e-8
conversion=(2*wn**2*zref/g)**b
B={'inputs':case['inputs'],'tool':{k:base[k] for k in ['dwell','dirlik','nb','ratio','sigma','nu0','nup','alpha','eqMinutes','peakRatio','m']},
   'flife':refs,'analytical_dwell_index':exact_dwell,'input_grms':math.sqrt(.03*20),
   'published_sine_range_g4':4.80e8,'published_random_range_g4':4.85e8,
   'tool_pseudoacceleration_range_g4':{'sine':base['dwell']*conversion,'random_Dirlik':base['dirlik']*conversion},
   'matching_proxy_ratio':exact_dwell/refs[-1]['dirlik']}

# C: sweep damage and maxima across control types, damping and both sweep laws.
sweep_checks=[]
for Q in [.5,1,10,100]:
  for unit,a1,a2 in [('disp_pk_mm',1,1),('vel_pk_mmps',1,1),('accel_g_pk',1,1),('accel_g_pk',1,30)]:
    for law in ['oct','linear']:
      raw={**case['inputs'],'Q':Q,'b':4.5,'passes':1,'dwellText':'','sineText':f'5,500,{unit},{a1},{a2}',
           'sweepType':law,'sweepRate':2}
      rr=engine('V.atMode(V.parse(x),100)',raw)
      p=math.log(a2/a1)/math.log(500/5)
      def amplitude(f):
        v=a1*(f/5)**p
        ag=v*(2*math.pi*f)**2*.001/g if unit=='disp_pk_mm' else v*2*math.pi*f*.001/g if unit=='vel_pk_mmps' else v
        return ag*g/math.hypot(wn**2-(2*math.pi*f)**2,wn*2*math.pi*f/Q)
      def integrand(f): return f*(amplitude(f)/zref)**4.5*(60/(2*math.log(2)*f) if law=='oct' else 30)
      points=sorted(set([5,500]+[100*(1+k/(2*Q)) for k in [-32,-8,-2,-.5,0,.5,2,8,32] if 5<100*(1+k/(2*Q))<500]))
      val=sum(quad(integrand,l,u,epsabs=1e-30,epsrel=1e-10)[0] for l,u in zip(points[:-1],points[1:]))
      peak=max([amplitude(5),amplitude(500)]+[-minimize_scalar(lambda f:-amplitude(f),bounds=(l,u),method='bounded',options={'xatol':1e-10}).fun for l,u in zip(points[:-1],points[1:])])
      assert rel(rr['sweep'],val)<1e-7,(Q,unit,law)
      assert rel(rr['peakSine'],peak)<1e-9,(Q,unit,law,rr['peakSine'],peak)
      sweep_checks.append({'Q':Q,'unit':unit,'law':law,'damage_relative_error':rel(rr['sweep'],val),'peak_relative_error':rel(rr['peakSine'],peak)})

out=ROOT/'reference';out.mkdir(exist_ok=True)
hashes={p:sha(external/p) for p in ['tests/test_basic.py','data/m1.npy','FLife/spectralData.py','FLife/tools.py','FLife/freq_domain/dirlik.py','FLife/freq_domain/narrowband.py']}
result={'engine_version':engine('V.VERSION',{}),'reference_commit':PIN,'source_sha256':hashes,'published_regression':a,'end_to_end':B,'sweep_checks':sweep_checks,
        'environment':{'numpy':np.__version__,'scipy':__import__('scipy').__version__,'python':sys.version.split()[0]}}
(out/'benchmark-results.json').write_text(json.dumps(result,indent=2)+'\n')
(out/'irvine-2011-case.json').write_text(json.dumps(case,indent=2)+'\n')
print(json.dumps({'published':a,'end_to_end':B,'sweep_cases':len(sweep_checks),'max_sweep_error':max(s['damage_relative_error'] for s in sweep_checks),'max_peak_error':max(s['peak_relative_error'] for s in sweep_checks)},indent=2))
