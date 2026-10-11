"""Independent audit of the Smith diagnostic reconstruction (not physical validation).
Uses SciPy continuous spatial quadrature and independently evaluated published fits.
No graph readings enter the numerical calculation.
"""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy.integrate import quad
R = Path(__file__).resolve().parent
js = "const E=require('./engine.js'),P=require('./published-case.js');console.log(JSON.stringify({c:P.caseInputs(),replay:P.reconstruct(E,{raw:true,fits:true,centerBands:true,slices:960,appendixAngle:true}),physical:P.reconstruct(E,{raw:true,fits:true,centerBands:true,slices:960}),frequencies:E.bandGrid(P.caseInputs()).map(b=>b.f)}))"
a = json.loads(subprocess.check_output(['node','-e',js],cwd=R,text=True))
c=a['c']; U=c['velocity']; D=c['diameter']; core=3.45*D*(1+.38*c['mach'])**2
W=c['eta']/100*c['thrust']*U/2

def source_density(q):
    z=np.log10(q/1.6)
    A=13.8*np.log10(q)-5 if q<=1.1 else -75*z**3-65*z*z-3 if q<=2.6 else -53*np.log10(q)+15.5
    return 10**(A/10)

def spectral_density(st):
    z=np.log10(st/1.5)
    A=10*np.log10(st)-7 if st<=.8 else -12*z**3-20*z*z-6.8 if st<=3.5 else -23*np.log10(st)+2.5
    return 10**(A/10)

rows=[]
for f in a['frequencies']:
    sr=f*D/U; z=np.log10(sr)
    base_di=.088828+7.411814*z+1.607279*z*z
    delta=0 if sr>.04345 else -28.9339 if sr<.01 else 61.7691+45.3515*z
    bandwidth=f*(2**(1/6)-2**(-1/6))
    # Independent geometric conclusion: entire 0.1–5 Lc source span is before
    # downstream microphone. Physical theta<90; Appendix returns theta+180.
    assert 5*core < c['receivers'][0]['x']
    def integrand(q):
        x=q*core
        r2=(3.5-x)**2+3.5**2
        return W*source_density(q)*spectral_density(f*x/U)*x/U*bandwidth/(4*np.pi*r2*1e-12)
    cuts=sorted({.1,5,1.1,2.6,*[q for q in [.8*U/f/core,3.5*U/f/core] if .1<q<5]})
    energy=sum(quad(integrand,lo,hi,epsabs=1e-5,epsrel=1e-11)[0] for lo,hi in zip(cuts,cuts[1:]))
    physical=10*np.log10(energy)+base_di
    rows.append({'frequency':f,'continuousPhysicalDb':physical,'continuousReplayDb':physical+delta})
max_replay=max(abs(r['continuousReplayDb']-v) for r,v in zip(rows,a['replay']))
max_physical=max(abs(r['continuousPhysicalDb']-v) for r,v in zip(rows,a['physical']))
assert max(max_replay,max_physical)<.01,(max_replay,max_physical)
result={'scope':'Independent continuous spatial integration of the diagnostic Smith fits; not experimental validation','bands':len(rows),'sliceCountJS':960,'toleranceDb':.01,'maxReplayDifferenceDb':max_replay,'maxPhysicalDifferenceDb':max_physical,'rows':rows}
(R/'reference/published-independent-results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('PASS independent Smith diagnostic quadrature; max difference',max(max_replay,max_physical),'dB')
