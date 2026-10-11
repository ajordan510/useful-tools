"""Independent SciPy quadrature of response moments, sweep and dwell damage.
Run after node test_engine.cjs. Requires numpy/scipy; browser tool has no dependencies.
"""
import json, math, subprocess
import numpy as np
from scipy.integrate import quad
from scipy.special import gamma
from pathlib import Path
root=Path(__file__).resolve().parent
script="""const V=require('./engine.js'),r=require('./example-case.json').inputs;const out=[];for(const Q of [2,10,50,100])for(const b of [4,6,8,12])for(const f of [10,35,120,280,500,1700]){const c=V.parse({...r,Q,b});out.push(V.atMode(c,f));}console.log(JSON.stringify(out));"""
rows=json.loads(subprocess.check_output(['node','-e',script],cwd=root))
g=9.80665
psd=np.array([[20,.01],[80,.04],[350,.04],[2000,.007]])
def A(f):
    if f<=20:return .1*.0254/2*(2*math.pi*f)**2/g
    if f<=80:return 6.283185307*.0254*2*math.pi*f/g
    return 8.17997886
maxerr=0.
for row in rows:
    fn,Q,b=row['fn'],row['Q'],row['b']
    def h(f):return g/math.hypot((2*math.pi*fn)**2-(2*math.pi*f)**2,(2*math.pi)**2*fn*f/Q)
    def integrate(fun,a,z):
        points=sorted(set([a,z]+[fn*(1+k/(2*Q)) for k in [-16,-4,-1,0,1,4,16] if a<fn*(1+k/(2*Q))<z]))
        return sum(quad(fun,x,y,epsabs=1e-50,epsrel=2e-10,limit=300)[0] for x,y in zip(points[:-1],points[1:]))
    m=[]
    for j in [0,1,2,4]:
        val=0
        for (a,x),(z,y) in zip(psd[:-1],psd[1:]):
            slope=math.log(y/x)/math.log(z/a)
            val+=integrate(lambda f:f**j*x*(f/a)**slope*h(f)**2,a,z)
        m.append(val)
    sweep=sum(integrate(lambda f:2*60/math.log(2)*(A(f)*h(f)/.001)**b,a,z) for a,z in [(5,20),(20,80),(80,500)])
    dwell=sum(min(28800*f,1e6)*(A(f)*h(f)/.001)**b for f in [35,120,280])
    for actual,ref in zip(row['m']+[row['sweep'],row['dwell']],m+[sweep,dwell]):
        err=abs(actual/ref-1);maxerr=max(maxerr,err)
        assert err<1e-6,(fn,Q,b,actual,ref,err)
    # Integrate Dirlik amplitude PDF independently instead of the engine's closed form.
    # Recompute coefficients from the independent moments, never from engine output.
    alpha=m[2]/math.sqrt(m[0]*m[3]);xm=m[1]/m[0]*math.sqrt(m[2]/m[3])
    d1=2*(xm-alpha**2)/(1+alpha**2)
    den=1-alpha-d1+d1*d1
    R=(alpha-xm-d1*d1)/den;d2=den/(1-R);d3=1-d1-d2
    q=1.25*(alpha-d3-d2*R)/d1
    D=dict(d1=d1,d2=d2,d3=d3,R=R,q=q)
    for key,value in D.items():
        assert abs(row['coeff'][key]-value)<1e-9, (fn,Q,b,key)
    sig=math.sqrt(m[0]);nu=math.sqrt(m[3]/m[2])
    def integrand(z):
        p=D['d1']/D['q']*math.exp(-z/D['q'])+D['d2']*z/D['R']**2*math.exp(-z*z/(2*D['R']**2))+D['d3']*z*math.exp(-z*z/2)
        return z**b*p
    moment=quad(integrand,0,np.inf,epsabs=1e-8,epsrel=1e-10)[0]
    direct=3600*nu*(sig/.001)**b*moment
    assert abs(direct/row['dirlik']-1)<1e-6
print(f'Independent SciPy reference: {len(rows)} cases passed. Maximum moment/sweep/dwell relative error: {maxerr:.3g}. Dirlik PDF integration agrees within 1e-6.')
