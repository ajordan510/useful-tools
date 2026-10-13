"""Reproducible Gaussian-history review, not hardware validation.

Acceptance set before execution: ensemble RMS within 5% of spectral RMS;
rainflow mean within max(35%, four ensemble standard errors) of Dirlik for
these two profiles at b=4,6. Report peak empirical non-exceedance with a
Wilson 95% interval; do not assert exact nominal-probability calibration.
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
fixtures = json.loads((ROOT / '_paper_build/workbench/simulation-fixtures.json').read_text())
rng = np.random.default_rng(20261012)

def histories(c, seconds, count):
    fs = 2048
    length = int(fs * seconds)
    f = np.fft.rfftfreq(length, 1/fs)
    p = np.array(c['psd'])
    psd = np.zeros_like(f)
    inside = (f >= p[0, 0]) & (f <= p[-1, 0])
    psd[inside] = np.exp(np.interp(np.log(f[inside]), np.log(p[:, 0]), np.log(p[:, 1]))) * c['psdScale']
    w, wn = 2*np.pi*f, 2*np.pi*100
    hz = 9.80665 / np.hypot(wn*wn-w*w, wn*w/c['Q'])
    scale = np.sqrt(psd * hz**2 * fs * length / 4)
    for _ in range(count):
        fourier = (rng.standard_normal(len(f)) + 1j*rng.standard_normal(len(f))) * scale
        fourier[0] = fourier[-1] = 0
        yield np.fft.irfft(fourier, n=length)

def damage(x):
    # Three-point rainflow stack, preserving unclosed residual half cycles.
    turns = x[np.r_[True, np.diff(x)[:-1] * np.diff(x)[1:] < 0, True]]
    stack, out = [], np.zeros(2)
    def add(span, cycles):
        nonlocal out
        amp = span / 2 / .001
        out += cycles * np.array([amp**4, amp**6])
    for value in turns:
        stack.append(value)
        while len(stack) >= 3:
            old, new = abs(stack[-2]-stack[-3]), abs(stack[-1]-stack[-2])
            if new < old:
                break
            if len(stack) == 3:
                add(old, .5)
                stack.pop(0)
            else:
                add(old, 1)
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    for a,b in zip(stack, stack[1:]):
        add(abs(b-a), .5)
    return out

def wilson(success, count):
    z = 1.96
    p = success/count
    mid = (p+z*z/(2*count))/(1+z*z/count)
    half = z*np.sqrt(p*(1-p)/count+z*z/(4*count*count))/(1+z*z/count)
    return [mid-half, mid+half]

results = []
for f in fixtures:
    d, rms = [], []
    for x in histories(f['c'], 120, 32):
        d.append(damage(x))
        rms.append(np.sqrt(np.mean(x*x)))
    d = np.array(d)
    sigma = f['rows'][0]['sigma']
    expected = np.array([r['dirlik'] for r in f['rows']])
    ratio, se = d.mean(axis=0)/expected, d.std(axis=0, ddof=1)/np.sqrt(len(d))/expected
    assert abs(np.mean(rms)/sigma - 1) < .05
    assert np.all(abs(ratio-1) < np.maximum(.35, 4*se)), (f['name'], ratio, se)
    maxima = np.array([np.max(np.abs(x))/sigma for x in histories(f['c'], 5, 600)])
    peaks = []
    for peak in f['peaks']:
        success = int(np.sum(maxima <= peak['k']))
        peaks.append({**peak, 'observed_nonexceedance': success/len(maxima), 'wilson_95': wilson(success,len(maxima)), 'trials': len(maxima)})
    results.append({'profile': f['name'], 'alpha': f['rows'][0]['alpha'], 'RMS_ratio': np.mean(rms)/sigma, 'b': [4,6], 'rainflow_to_Dirlik_mean': ratio.tolist(), 'ratio_standard_error': se.tolist(), 'peak_experiment_5_seconds': peaks})
report = {'seed':20261012,'sample_rate_Hz':2048,'damage_trials':32,'damage_seconds_per_trial':120,'method':'Gaussian Fourier coefficients filtered by analytical SDOF displacement PSD; endpoint residual half cycles retained. Finite-period discretization and sampling remain approximations.','acceptance':'RMS within 5%; mean rainflow within max(35%,4SE) of Dirlik for these profiles. Peak probabilities reported, not certified.','results':results}
(ROOT/'workbench/history-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
