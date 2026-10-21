"""Independent SciPy DOP853 ODE verification; requires Python, NumPy, SciPy, Node.
Run: python Shock-Prediction/test_numerical.py
Writes inspectable results to ignored _qa/numerical.json; no downloaded datasets.
"""
import json, math, pathlib, subprocess
import numpy as np
import scipy
from scipy.integrate import solve_ivp

HERE = pathlib.Path(__file__).resolve().parent
G = 9.80665
DT = 0.00005
FREQS = [20, 100, 800, 2000]
QS = [.51, 2, 10, 50]
specs = [(f, q) for q in QS for f in FREQS]
w = 2 * np.pi * np.array([f for f, q in specs])
damp = w / np.array([q for f, q in specs])
t = np.arange(501) * DT
histories = {
    'half_sine': np.where(t < .005, 100 * G * np.sin(np.pi * t / .005), 0),
    'damped_multitone': 70 * G * np.exp(-220 * t) * (np.sin(2*np.pi*310*t) + .4*np.sin(2*np.pi*1400*t)),
    'short_triangle': np.array([0., 100*G, 0.]),
    'nonzero_endpoint': np.array([0., 20*G, 40*G, 60*G]),
}
payload = {'dt': DT, 'specs': specs, 'histories': {k: a.tolist() for k, a in histories.items()}}
js = """const fs=require('fs'),S=require('./engine.js'),p=JSON.parse(fs.readFileSync(0,'utf8'));
const result={};for(const [name,a] of Object.entries(p.histories))result[name]=p.specs.map(([f,q])=>S.oscillator(a,p.dt,f,q));
result.mount=S.isolate({a:p.histories.half_sine,dt:p.dt},{fn:200,q:2,mass:2,clearance:3});
console.log(JSON.stringify(result));"""
actual = json.loads(subprocess.check_output(['node', '-e', js], input=json.dumps(payload).encode(), cwd=HERE))
errors = []
for name, a in histories.items():
    time = np.arange(len(a))*DT
    def rhs(tm, y):
        z, v = y[:len(w)], y[len(w):]
        return np.r_[v, -damp*v - w*w*z - np.interp(tm, time, a)]
    sol = solve_ivp(rhs, [0, time[-1]], np.zeros(2*len(w)), method='DOP853', rtol=2e-10, atol=1e-12, max_step=DT/2, dense_output=True)
    assert sol.success
    dense = np.linspace(0, time[-1], max(2, math.ceil(time[-1]/min(DT/16,1/(256*max(FREQS))))+1))
    y = sol.sol(dense)
    ac = -damp[:, None]*y[len(w):] - (w*w)[:, None]*y[:len(w)]
    for i, (f, q) in enumerate(specs):
        # A separate ODE solve for the zero-input residual, sampled densely for extrema.
        wf = 2*np.pi*f
        tail_end = 2/(f*np.sqrt(1-1/(4*q*q)))
        tail = solve_ivp(lambda tm, y: [y[1], -wf/q*y[1]-wf*wf*y[0]], [0, tail_end], sol.y[[i, i+len(w)], -1], method='DOP853', rtol=2e-11, atol=1e-13, dense_output=True)
        yt = tail.sol(np.linspace(0,tail_end,8193))
        at = -wf/q*yt[1]-wf*wf*yt[0]
        pp, pn = max(0,ac[i].max())/G, max(0,-ac[i].min())/G
        rp, rn = max(0,at.max())/G, max(0,-at.min())/G
        sd = max(np.abs(y[i]).max(),np.abs(yt[0]).max())
        ref = dict(primaryPositive=pp,primaryNegative=pn,residualPositive=rp,residualNegative=rn,positive=max(pp,rp),negative=max(pn,rn),sa=max(pp,pn,rp,rn),sd=sd,pv=wf*sd,pa=wf*wf*sd/G)
        out = actual[name][i]
        for key, value in ref.items():
            # Ignore tiny signed tails in the relative-error gate; retain absolute check.
            scale = max(ref['sa'] if key not in ['sd','pv','pa'] else ref[key], 1e-12)
            error = abs(out[key]-value)/max(abs(value),scale*1e-7)
            assert abs(out[key]-value) <= .01*abs(value)+1e-7*scale, (name,f,q,key,out[key],value,error)
            errors.append({'history':name,'f':f,'q':q,'metric':key,'actual':out[key],'reference':float(value),'relative_error':float(error),'normalized_absolute_error':float(abs(out[key]-value)/scale),'material':bool(abs(value)>scale*1e-5)})

# Independently solve the mount's displacement/velocity in physical coordinates.
a = histories['half_sine']; time = np.arange(len(a))*DT
mount = actual['mount']; wf=2*np.pi*200; q=2; end=(len(mount['a'])-1)*DT
def mount_rhs(tm,y):
    base = np.interp(tm,time,a) if tm<=time[-1] else 0.
    return [y[1], -wf/q*y[1]-wf*wf*y[0]-base]
sol = solve_ivp(mount_rhs,[0,end],[0,0],method='DOP853',rtol=2e-10,atol=1e-12,max_step=DT/2,dense_output=True)
yp = sol.sol(np.arange(len(mount['a']))*DT)
acc = -wf/q*yp[1]-wf*wf*yp[0]
wave_error = float(np.max(np.abs(acc-np.array(mount['a'])))/np.max(np.abs(acc)))
assert wave_error < 1e-6, wave_error
yp_dense = sol.sol(np.linspace(0,end,math.ceil(end/(DT/16))+1))
travel = float(np.max(np.abs(yp_dense[0]))*1000)
force = float(np.max(np.abs(-wf/q*yp_dense[1]-wf*wf*yp_dense[0]))*2)
assert abs(mount['travelMm']/travel-1)<.01
assert abs(mount['forceN']/force-1)<.01
summary = {'scipy':scipy.__version__,'oscillator_cases':len(specs)*len(histories),'scalar_comparisons':len(errors),'max_material_relative_error':max(e['relative_error'] for e in errors if e['material']),'max_normalized_absolute_error':max(e['normalized_absolute_error'] for e in errors),'max_sa_relative_error':max(e['relative_error'] for e in errors if e['metric']=='sa'),'mount_waveform_normalized_max_error':wave_error,'mount_travel_mm':mount['travelMm'],'mount_force_N':mount['forceN'],'srs_tolerance':'1% plus 1e-7 of metric scale','results':errors}
(HERE/'_qa').mkdir(exist_ok=True)
(HERE/'_qa'/'numerical.json').write_text(json.dumps(summary,indent=2))
print(json.dumps({k:v for k,v in summary.items() if k!='results'},indent=2))
