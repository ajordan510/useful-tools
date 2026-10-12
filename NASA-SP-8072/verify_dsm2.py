"""Independent continuous-source DSM-II reference, not a slice-code translation.
Analytically integrates the piecewise power-law spectral density; SciPy adaptively
integrates along the plume. Compares to the production midpoint slice calculation.
"""
import math,json,subprocess
from pathlib import Path
import numpy as np
from scipy.integrate import quad
R=Path(__file__).resolve().parent
d=json.loads((R/'model-data.json').read_text())
def density(table,x,left,right):
    p=np.asarray(table);a=np.log10(p[:,0]);v=np.interp(np.log10(x),a,p[:,1])
    if x<p[0,0]:v=p[0,1]+left*np.log10(x/p[0,0])
    elif x>p[-1,0]:v=p[-1,1]+right*np.log10(x/p[-1,0])
    return 10**(v/10)
def exact_integral(table,low,high,left,right):
    pts=[low]+[a[0] for a in table if low<a[0]<high]+[high];v=0.
    for a,b in zip(pts[:-1],pts[1:]):
        ya=density(table,a,left,right);yb=density(table,b,left,right);k=math.log(yb/ya)/math.log(b/a)
        v+=ya*a*(math.log(b/a) if abs(k+1)<1e-10 else math.expm1((k+1)*math.log(b/a))/(k+1))
    return v
sn=exact_integral(d['fig13'],1e-9,1e7,10,-30)
an=exact_integral(d['fig12'],.1,5,0,0)
srgrid=np.log10(d['fig10Sr']);angles=np.array(d['fig10Theta']);dis=np.array(d['fig10DI'])
def directivity(sr,theta):return np.interp(math.log10(np.clip(sr,.004,.4)),srgrid,[np.interp(np.clip(theta,20,180),angles,row) for row in dis])
script="""const E=require('./engine.js');let out=[];for(const core of ['eldred','varnier'])for(const bent of [false,true]){let c={...E.defaults(),model:'dsm2',core,deflection:bent?8:0,terminate:bent,slices:960,receivers:[{name:'structure',x:-30,y:10}]};let r=E.predict(c);out.push({c,frequencies:r.bands.map(b=>b.f),actual:r.receivers[0].levels});}{const c={...require('./published-case.js').caseInputs(),slices:960},r=E.predict(c);out.push({c,frequencies:r.bands.map(b=>b.f),actual:r.receivers[0].levels});}{const base=require('./measured-case.js').caseInputs();for(const receiver of base.receivers){const c={...base,name:base.name+' / '+receiver.name,receivers:[receiver],slices:960},r=E.predict(c);out.push({c,frequencies:r.bands.map(b=>b.f),actual:r.receivers[0].levels});}}console.log(JSON.stringify(out));"""
cases=json.loads(subprocess.check_output(['node','-e',script],cwd=R,text=True,encoding='utf-8'));checks=[]
for case in cases:
    c=case['c'];D=c['diameter'];core=(3.45 if c['core']=='eldred' else 1.75)*D*(1+.38*c['mach'])**2
    if c['terminate']:core=min(core,c['deflection'])
    power=c['eta']/200*c['thrust']*c['velocity'];p=c['receivers'][0];ref=[]
    for f in case['frequencies']:
        def fun(q):
            s=q*core;x=s;y=0;tx=1;ty=0
            if c['deflection'] and s>c['deflection']:
                a=math.radians(c['bend']);tx=math.cos(a);ty=math.sin(a);x=c['deflection']+(s-c['deflection'])*tx;y=(s-c['deflection'])*ty
            dx=p['x']-x;dy=p['y']-y;r=math.hypot(dx,dy);theta=math.degrees(math.acos(np.clip((dx*tx+dy*ty)/r,-1,1)))
            a=f/10**.05*s/(c['mach']*c['c0']);b=f*10**.05*s/(c['mach']*c['c0'])
            band=exact_integral(d['fig13'],a,b,10,-30)/sn
            return density(d['fig12'],q,0,0)/an*band/(4*math.pi*r*r)*10**(directivity(f*D/c['velocity'],theta)/10)
        points=[a[0] for a in d['fig12'] if .1<a[0]<5]
        if c['deflection'] and .1<c['deflection']/core<5:points.append(c['deflection']/core)
        integral=quad(fun,.1,5,points=sorted(set(points)),epsabs=1e-14,epsrel=2e-6,limit=250)[0]
        ref.append(10*math.log10(power/1e-12*integral))
    errors=np.abs(np.array(case['actual'])-ref);maximum=float(max(errors));assert maximum<.02,maximum
    checks.append({'case_name':c['name'],'core':c['core'],'terminated_bend':c['terminate'],'slices':960,'maximum_band_error_dB':maximum,'expected_band_levels':ref,'actual_band_levels':case['actual']})
result={'method':'Continuous plume integration with SciPy quad and exact piecewise power-law band integration, versus 960 midpoint slices. Same digitized NASA curves; not physical validation.','cases':len(checks),'band_comparisons':sum(len(x['actual_band_levels']) for x in checks),'tolerance_dB':.02,'checks':checks}
(R/'reference/dsm2-independent-results.json').write_text(json.dumps(result,indent=2));print('PASS',[(v['core'],v['terminated_bend'],v['maximum_band_error_dB']) for v in checks])
