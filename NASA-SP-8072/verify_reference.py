"""Independent quadrature and data-interpolation verification; not measured validation.
Uses SciPy adaptive quadrature, NumPy interpolation and original SATURN data exported
without modification. This does not execute MATLAB or claim full SATURN parity.
"""
import json, math, subprocess
from pathlib import Path
import numpy as np
from scipy.integrate import quad
from scipy.interpolate import RegularGridInterpolator

ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'model-data.json').read_text())
sat=json.loads((ROOT/'vendor/saturn-directivity.json').read_text())
db=lambda x:10*np.log10(x)
def curve(table,x,left,right):
    a=np.array(table);lx=math.log10(x);xs=np.log10(a[:,0]);ys=a[:,1]
    if lx<xs[0]:return ys[0]+left*(lx-xs[0])
    if lx>xs[-1]:return ys[-1]+right*(lx-xs[-1])
    return np.interp(lx,xs,ys)
def spec(sr,modern):
    if not modern:return curve(data['fig5'],sr,20,-20)
    z=math.log(sr)
    return 8.686*z+58.6 if sr<.0036 else .26*z**3-15.98*z-33.88 if sr<=.048 else -8.686*z-19
def intlog(fun,a,b,breaks=()):
    bounds=sorted([a]+[v for v in breaks if a<v<b]+[b])
    return sum(quad(lambda z:fun(math.exp(z))*math.exp(z),math.log(l),math.log(h),epsabs=1e-10,epsrel=2e-9,limit=200)[0] for l,h in zip(bounds[:-1],bounds[1:]))
norms={m:intlog(lambda s:10**(spec(s,m)/10),1e-9,1e7,[.0036,.048] if m else [p[0] for p in data['fig5']]) for m in [False,True]}
interpolator=RegularGridInterpolator((sat['Sr'],sat['Theta']),sat['DI'],bounds_error=True)
def di(sr,t,model):
    if model=='omni':return 0.
    if model=='modern':return float(interpolator([[np.clip(sr,sat['Sr'][0],sat['Sr'][-1]),t]])[0])
    vals=[np.interp(np.clip(t,20,180),data['fig10Theta'],v) for v in data['fig10DI']]
    return np.interp(math.log10(np.clip(sr,.004,.4)),np.log10(data['fig10Sr']),vals)
def loss(f,r):return -10*(math.sqrt(r/12000)*math.log10(1+f/16)+(r/3000)**1.5*math.log10(1+f/8000))
def predict(c):
    modern=c['model']=='modern';D=c['diameter']*math.sqrt(c['engines']) if c['cluster']=='merged' else c['diameter']
    W=c['eta']/200*c['engines']*c['thrust']*c['velocity'];freq=[1000*10**(k/10) for k in range(-60,61) if c['fmin']*(1-1e-9)<=1000*10**(k/10)<=c['fmax']*(1+1e-9)]
    outputs=[]
    for p in c['receivers']:
        levels=[]
        for f in freq:
            sr=f*D/c['velocity'];s=9.85*sr**(-.21)*D if modern else 10**np.interp(math.log10(sr),np.log10(np.array(data['fig14'])[:,0]),np.log10(np.array(data['fig14'])[:,1]))*D
            rr=math.hypot(p['x']-s,p['y']);theta=math.degrees(math.atan2(p['y'],p['x']-s))
            breaks=([.0036,.048] if modern else [a[0] for a in data['fig5']]);breaks=[s*c['velocity']/D for s in breaks]
            wb=W*intlog(lambda hz:10**(spec(hz*D/c['velocity'],modern)/10)*D/c['velocity'],f/10**.05,f*10**.05,breaks)/(norms[modern] if c['normalize'] else 1)
            levels.append(float(db(wb/1e-12)-db(4*math.pi*rr**2)+di(sr,theta,c['directivity'])+(loss(f,rr) if c['propagation']=='saturn' else 0)+c['reflection']))
        outputs.append({'levels':levels,'oa':float(db(sum(10**(v/10) for v in levels)))})
    return outputs

script="""const E=require('./engine.js');const c=E.defaults(),cases=[];
for(const model of ['dsm1','modern'])for(const normalize of [false,true])for(const propagation of ['none','saturn'])for(const cluster of ['merged','independent']){
const a={...c,model,normalize,propagation,cluster,engines:2,diameter:1.43,thrust:1915000,velocity:3160,eta:.34,directivity:model==='modern'?'modern':'legacy',receivers:[{name:'near',x:200,y:300},{name:'far',x:3000,y:5000}]};const r=E.predict(a);cases.push({input:a,receivers:r.receivers.map(p=>({levels:p.levels,oa:p.oa}))});}console.log(JSON.stringify(cases));"""
cases=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT,text=True,encoding='utf-8'))
checks=[];max_band=0;max_overall=0
for i,c in enumerate(cases):
    expected=predict(c['input'])
    for j,(a,b) in enumerate(zip(c['receivers'],expected)):
        err=float(np.max(np.abs(np.array(a['levels'])-b['levels'])));oa=abs(a['oa']-b['oa']);max_band=max(max_band,err);max_overall=max(max_overall,oa)
        assert err<.012,(i,j,err)
        checks.append({'case':i,'receiver':j,'max_band_error_dB':err,'overall_error_dB':oa,'expected_overall_dB':b['oa'],'actual_overall_dB':a['oa']})
# Raw formula probes cover branches and boundary discontinuities independently.
probe_sr=[.0001,.003599,.0036,.01,.047999,.048,.048001,.1,1,10]
expected_spectrum=[spec(s,True) for s in probe_sr]
actual=json.loads(subprocess.check_output(['node','-e',f"const E=require('./engine.js');console.log(JSON.stringify({json.dumps(probe_sr)}.map(s=>E.spectrum(s,'modern'))));"],cwd=ROOT,text=True))
assert np.max(np.abs(np.array(actual)-expected_spectrum))<1e-10
report={'method':'Independent Python/SciPy adaptive quadrature; original SATURN data, fixed stationary cases. Not MATLAB execution or experimental validation.','cases':len(cases),'receiver_comparisons':len(checks),'band_comparisons':sum(len(c['receivers'][0]['levels'])*len(c['receivers']) for c in cases),'tolerance_dB':.012,'maximum_band_error_dB':max_band,'maximum_overall_error_dB':max_overall,'quadrature_normalizations':{str(k):v for k,v in norms.items()},'checks':checks,'saturn_formula_probes':list(zip(probe_sr,expected_spectrum))}
(ROOT/'reference'/'independent-results.json').write_text(json.dumps(report,indent=2))
(ROOT/'reference'/'stationary-cases.json').write_text(json.dumps(cases,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'PASS: {len(checks)} receiver comparisons; max band error {max_band:.6g} dB; max overall error {max_overall:.6g} dB')
