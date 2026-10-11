# Technical audit and reference benchmarks

## Vibration Damage Comparison 1.0.2

11 October 2026 | Prepared for Alex Jordan | useful-tools repository

### Audit conclusion

The implemented SDOF response, sine-cycle accumulation and random spectral-fatigue equations agree with the cited formulations under the stated assumptions. The random-fatigue kernel reproduces a published FLife regression to every published decimal place. A complete base-input example independently evaluated with FLife agrees within 2.42 x 10^-10 relative difference in Dirlik damage.

This is a source and numerical implementation audit by the tool's development assistant, not an independent organizational approval or experimental validation. It inspected the code at commit 19ff2e5d958b7cc4b8482dece2897a1f55adb600 and verified the corrected version 1.0.2. The companion manifest identifies the delivered calculation files by SHA-256.

### Findings and corrective actions

| Finding | Consequence | Disposition |
| --- | --- | --- |
| F1: ambiguous dwell at a sine-profile jump | Previous code selected the earlier segment. At a 10-to-1 g step, choosing the wrong level changes dwell damage by 10^6 for b = 6. | Fixed: require explicit peak-G override when adjoining values differ by more than 1 ppm. Continuous boundaries remain accepted. |
| F2: approximate sweep maximum | Quadrature samples plus special frequencies did not guarantee the exact peak for every power-law segment. | Fixed: evaluate all analytical stationary points and endpoints. A displacement example at Q = 1 increases the peak by 0.000350%. Damage integration is unchanged. |
| F3: incomplete independence of verification | The original PDF-integration check reused the engine's Dirlik coefficients and could miss a shared coefficient error. | Fixed: recompute coefficients from independently integrated moments. Added unmodified, pinned FLife comparisons and a published regression. |

No change was needed to the Dirlik or narrowband damage formulas. The bundled illustrative case's fatigue ratios are unchanged by these fixes. The paper and tool now state the revised boundary and peak behavior.

### Appropriate use after the audit

Use the tool to compare relative exposure severity for common linear dynamics and an unchanged fatigue mechanism. A pass remains conditional on configuration, mounting, damping, modal coverage, stress mapping, achieved legacy exposure and the applicable acceptance basis. The audit does not establish component life, reliability or qualification.

@@page

## 1. Equation and assumption audit

The trace below distinguishes equations supported by the references from reconstruction rules and numerical choices introduced by this implementation. Reference numbers resolve on the last page.

| Calculation | Audit evidence | Result |
| --- | --- | --- |
| DA, peak and RMS conversions | Direct sinusoidal differentiation; inch = 0.0254 m and g0 = 9.80665 m/s^2. DA is halved before conversion. | Correct; analytical tests pass. |
| Base acceleration to relative displacement | Direct solution of the damped base-excited oscillator equation. At resonance: z_pk = g0 A Q / omega_n^2. | Correct. This is not the absolute acceleration transfer function. |
| Dwell cycles and caps | n = repeats x f_excitation x min(time cap, cycle cap/f_excitation). This is the user-specified test reconstruction rule. | Correct; no artificial dwell is added at hypothetical modes. F1 removes boundary ambiguity. |
| Sweep accumulation | Integrate f (z_pk/z_ref)^b dt with dt/df = 60/(r ln(2) f) or 60/v. | Correct for quasi-steady motion; 32 independent cases pass. |
| Spectral moments and cycle rates | [2], section 2; [4] implements angular-frequency moments. Tool moments use Hz. | Correct: m_j(angular) = (2 pi)^j m_j(Hz); tool rates need no extra 1/(2 pi). |
| Narrowband and Dirlik fatigue | [1], equations 5, 7-8; [2], equations 29-32; [4], Dirlik and Narrowband modules. | Correct coefficients, Gamma factors, peak rate and absolute value of the Dirlik R parameter. |
| Ratio and scaling | Homogeneity: damage scales as time x amplitude^b, or time x PSD^(b/2). | Correct equivalent duration and amplitude/PSD multipliers for fixed spectral shape and dynamics. |

The code uses cycle amplitudes. Reference [1] also presents a range formulation: converting r = 2s consistently introduces 2^b on both sides of a severity ratio, which cancels. It must not be introduced on only one side. The normalized displacement index is not an absolute Miner fraction.

For a power-law acceleration segment A(f) proportional to f^p, the corrected peak search solves the following polynomial and evaluates its positive in-band roots along with both segment endpoints:

$$ (p-2)u^2+(p-1)(Q^{-2}-2)u+p=0,\qquad u=(f/f_n)^2 $$

The 0.1 sweep-rate indicator threshold, five-time-constant dwell diagnostic, one-part-per-million boundary tolerance and 0.5% quadrature warning are implementation choices. None is an acceptance criterion supplied by the cited references.

@@page

## 2. Exact published numerical benchmark

### Fixed reference, with no fitted inputs

Reference [4], tests/test_basic.py::test_data, publishes expected fatigue lives for its data/m1.npy record. The audit uses the exact pinned dataset and processing: 3,150,000 samples, dt = 0.0001 s, stress normalized to standard deviation 100, Hann Welch PSD with nperseg = 1000, b = 6 and C = 1.8 x 10^19. No input was tuned to obtain agreement.

| Method | Published life, s | Tool life, s |
| --- | --- | --- |
| Dirlik | 1595.031603 | 1595.031602975958 |
| Narrowband | 1064.200649 | 1064.200648966832 |

Absolute differences from the rounded published numbers are 2.40 x 10^-8 s and 3.32 x 10^-8 s, respectively. Both are below the specified 0.000001 s tolerance. Relative differences from rerunning FLife are below 2 x 10^-15.

### How stress data exercise the same engine

The tool's browser normally receives base acceleration, while this published case starts with an already-computed stress PSD. For the kernel benchmark only, use the numerical mapping z = z_ref s. Supply M_j = z_ref^2 m_j,stress to the unchanged spectral() function, with duration one second. The returned index is then the stress-amplitude damage intensity multiplied by C, so reference life is C/I. This mapping does not introduce a physical stress calibration or add a life-estimation capability to the normal tool workflow.

The four stress moments in the tool's Hz convention are:

| Moment | Value | Unit |
| --- | --- | --- |
| m0 | 10005.545684107845 | MPa^2 |
| m1 | 2522936.5832924247 | MPa^2 Hz |
| m2 | 1238259305.5066493 | MPa^2 Hz^2 |
| m4 | 781653956437149.8 | MPa^2 Hz^4 |

In the HTML tool, open Method & interpretation and select Check published benchmark. This reruns the embedded engine against these fixed moments and displays PASS or FAIL. The committed Python script regenerates the moments from the source record and checks the pinned external code; the browser check alone does not repeat the Welch processing.

### What the match establishes

It verifies the random-fatigue kernel, normalization and frequency convention against an external published numerical result. It does not validate the base-input transfer function, sweep approximation or physical fatigue prediction. The upstream record also has a rainflow life of 1399.409574 s; Dirlik's life is about 14.0% longer. Matching Dirlik is not the same as matching rainflow.

@@page

## 3. End-to-end sine and random example

The case uses Irvine [3], second method, page 3. The full base-PSD-to-relative-response calculation is checked against FLife; comparison with the published rainflow result is a separate question.

| Setting | Value | Tool entry |
| --- | --- | --- |
| Natural frequency; Q; b | 100 Hz; 10; 4 | Known-mode scope, only 100 Hz |
| Sine dwell | 1 g peak at 100 Hz for 30 s | 100,1,0,3000,1 |
| Credited sweeps | None | Traversals = 0 |
| One-sided random PSD | 0.03 g^2/Hz, 90-110 Hz | Two equal PSD endpoints |
| Random duration | 30 s | 0.5 minutes, one repetition |
| Normalization | z_ref = 1 mm | Built into engine |

Select Load reference case, or open reference/irvine-2011-case.json. The explicit dwell override sets the sine level; no sweep is credited. Peak factor k = 4 and mode bounds 90-110 Hz are analyst settings, not published inputs.

| Quantity | Independent reference | Tool |
| --- | --- | --- |
| Input gRMS | 0.7745966692 | 0.7745966692 |
| Sine dwell index | 11.4226010877 | 11.4226010877 |
| Random Dirlik index | 10.0914518643 | 10.0914518667 |
| Random narrowband index | 10.1213233693 | 10.1213233717 |
| Heritage / random Dirlik | 1.1319085937 | 1.1319085934 |
| Response RMS, mm | 0.1433682065 | 0.1433682065 |

Python constructs the response PSD on 40,001 frequencies for the unmodified FLife estimators; a 20,001-point run checks convergence. Dirlik relative difference is 2.41 x 10^-10, below the 10^-8 tolerance. The analytical dwell has 3,000 cycles and z_pk = 0.248405 mm. Equivalent random duration is 33.9573 s.

### The published rainflow value does not match exactly

Irvine reports a sine range-based acceleration index 4.80 x 10^8 and a random time-history rainflow index 4.85 x 10^8. Our pseudoacceleration mapping, a_p = omega_n^2 z/g0, reproduces the sine number; it gives random expected Dirlik index 4.24063 x 10^8, about 12.6% lower than that published random realization.

This is not an exact benchmark for random damage: finite-record rainflow versus spectral expectation and absolute acceleration versus relative displacement are different quantities. The original random waveform and seed are not supplied in the paper, so the discrepancy cannot be allocated uniquely. The exact damped absolute-acceleration transfer also differs from the paper's rounded resonant amplification. Do not claim this example reproduces the paper's random result or its equivalence conclusion. The independent like-for-like FLife comparison above is the relevant implementation check.

@@page

## 4. Verification, limits and reproduction

### Verification record

Eighteen Node test groups pass. The 96-case SciPy audit covers Q = 2, 10, 50, 100; b = 4, 6, 8, 12; and six natural frequencies. Maximum relative difference in response moments, sweep and dwell indices is 6.43 x 10^-12. Independently reconstructed Dirlik coefficients and PDF integration agree within 10^-6 in damage. Four additional slopes, including 4.5 and 7.3, agree with FLife to floating-point precision.

Thirty-two independent sweep cases cover Q = 0.5, 1, 10, 100; displacement, velocity, constant acceleration and sloped acceleration; and logarithmic and linear sweep rates. Maximum relative differences are 9.33 x 10^-14 for sweep damage and 1.17 x 10^-11 for peak response. Regression checks exercise discontinuous boundaries and a shifted displacement-controlled peak.

Browser checks exercise the packaged HTML, reference loading, published benchmark, six plots, data/report exports, validation errors, mobile result navigation and blocked-script diagnostics. The saved reference analysis report and CSV come from the browser's export path. These checks verify calculation and reporting consistency, not experimental performance.

### Limits still requiring engineering closure

Dirlik is an empirical stationary Gaussian spectral estimator. Neither cited review promises exact agreement with arbitrary rainflow histories; higher b and complex spectra can increase error. Agreement between two implementations does not remove that model uncertainty.

Relative displacement must track the fatigue-critical stress for the actual component. Different mounting, modal stress distributions, damping or nonlinear mechanisms break the cancellation argument. A bank minimum is not a multimode stress calculation, and its sampled grid is not a guarantee of the continuous minimum. The built-in integration refinement checks only the nominal governing point.

Fast sweeps, short dwells, changing resonances, multiaxial loads, non-Gaussian response, mean stress, endurance limits and sequence effects remain outside the model. The k-sigma screen has no probability-of-exceedance guarantee. Achieved test exposure and the completeness of known modes must be established from records. A positive exposure ratio does not restore life consumed by a prior test on the same article.

### Reproduction

Run node test_engine.cjs and python3 validate_reference.py. Clone https://github.com/ladisk/FLife, check out commit f39ba53d608b3338b16c9ebb5bd52c86635898b0, then run python3 verify_audit.py --flife-root /path/to/FLife. The script refuses a different or modified reference checkout. It uses NumPy, SciPy, Matplotlib and Tkinter; no external runtime is required by the HTML tool.

reference/benchmark-results.json records numerical results, software versions, pinned source commit and source SHA-256 hashes. reference/irvine-2011-case.json is directly importable. reference/analysis-report.html and reference/analysis-results.csv preserve the example calculation. README.md lists build and browser-test commands. The large upstream measured record is not copied into this repository.

@@page

## 5. References and audit trail

[1] Dirlik, T., and Benasciutti, D. (2021). Dirlik and Tovo-Benasciutti Spectral Methods in Vibration Fatigue: A Review with a Historical Perspective. Metals 11(9), 1333. https://doi.org/10.3390/met11091333. Equations 5 and 7-8 checked in the author-deposited full text. The paper's range convention was reconciled with the tool's amplitude convention.

[2] Zorman, A., Slavic, J., and Boltezar, M. (2023). Vibration fatigue by spectral methods: A review with open-source support. Mechanical Systems and Signal Processing 190, 110149. https://doi.org/10.1016/j.ymssp.2023.110149. Author-hosted PDF at https://www.ladisk.si/data/pdf/Vibration%20fatigue%20by%20spectral%20methods-A%20review%20with%20open-source%20support.pdf. Section 2 and equations 29-32 checked; page 7 equations also inspected visually.

[3] Irvine, T. (2011). On the Use of a Narrowband Random Power Spectral Density to Cover a Pure Sine Vibration Environment via Rainflow Fatigue. Revision A, March 16. https://www.vibrationdata.com/tutorials_alt/random_sine_rainflow.pdf. Pages 1-3 define the input case and report a finite-record rainflow result; this is a different source from the NESC lecture previously linked by the tool.

[4] LADISK, FLife 2.2.2 source repository. https://github.com/ladisk/FLife. Audit pinned to f39ba53d608b3338b16c9ebb5bd52c86635898b0. Files inspected and executed: FLife/spectralData.py, FLife/freq_domain/dirlik.py and FLife/freq_domain/narrowband.py. Published targets: tests/test_basic.py::test_data. Input record: data/m1.npy. The reproducibility script loads these modules unchanged and avoids optional package-wide visualization imports.

[5] NASA NESC Academy, Tom Irvine. Using Fatigue to Compare Sine and Random Environments. https://nescacademy.nasa.gov/video/2584e207341e411b95fa829e191d81441d. Catalog entry checked; linked slides could not be retrieved. No numerical verification or equation claim in this audit relies on those unavailable slides.

### Reference provenance and publication boundary

All accessible sources above were checked on 11 October 2026. This audit publishes original calculations, traceability and small numerical fixtures. The cited papers and external dataset remain at their publishers' or authors' locations. The source scripts are preserved to make the agreement reviewable and repeatable.

Publishing these results in the project branch does not change the qualification status of any hardware. The next engineering step is to apply verified legacy and new environments to measured or justified critical modes and resolve the applicability conditions recorded in the method paper.
