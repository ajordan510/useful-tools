# JAXA NAL-735 measured-spectrum assessment

A usable measured-data case was located in Fukuda et al. (2011), **An Acoustic Impedance Model for Evaluating the Ground Effect of Static-Firing Tests on a Rocket Motor**, Figures 17–18 (printed p. 128 / PDF p. 9). It reports the original measured spectra and two author ground-corrected versions at M1 and M8 from the December 2007 Noshiro static firings. This is experimental evidence independent of the Smith prediction replay. It supports a **conditional accuracy assessment**, not a claim that DSM-II is universally validated.

## Primary sources

- [Fukuda et al. 2011, journal article](https://www.jstage.jst.go.jp/article/tjsass/54/184/54_184_120/_article), [PDF](https://www.jstage.jst.go.jp/article/tjsass/54/184/54_184_120/_pdf). Geometry/heights: Section 2 and Figure 2; ground-correction method: Section 6; measured/corrected spectra: Figures 17–18. The plotted data, not another model's prediction, are the comparison target.
- [Tsutsumi et al. 2009, EUCASS conference paper](https://www.eucass.eu/component/docindexer/?id=6346&task=download), *Numerical Simulation of Jet Aeroacoustics from a Solid Rocket in Static-Firing Tests*. Table 1 gives motor conditions; Figure 1 gives microphone geometry; Section 3.1 supplies the 0.84% Sutherland-based efficiency estimate; Figures 7 and 9 establish frequency/Strouhal correspondence. This paper explicitly identifies inadequacies in empirical source/core/directivity modeling.
- [Fukuda et al. 2009, AIAA 2009-3368](https://doi.org/10.2514/6.2009-3368), *Acoustic Measurement and Prediction of Solid Rockets in Static Firing Tests*. Its public text identifies the motor as NAL-735, a 10-second steady chamber-pressure analysis interval, microphone response concerns above 2 kHz and run-to-run differences. The earlier paper's tuned efficiency is **not** adopted; the later EUCASS Sutherland estimate is used unchanged. A public text copy was inspected, but numerical readings are extracted from the journal PDF directly.

## Input provenance and choices

| Input | Value | Status |
|---|---:|---|
| Thrust at sea level | 260,000 N | Published, EUCASS Table 1 |
| Nozzle exit diameter | 0.614 m | Published |
| Nozzle exit Mach | 2.92 | Published |
| Exit/ambient pressure ratio | 0.418 | Published; overexpanded plume |
| Fully expanded diameter / Mach | 0.446 m / 2.47 | Published; recorded for context, not mixed into the exit-based baseline |
| Exit velocity | approximately 2,456 m/s | Derived from Sr=fDe/Ue and the printed 4,000 Hz ↔ Sr=1 axis correspondence |
| Acoustic efficiency | 0.84% | Published Sutherland-based estimate; not inferred from these receiver spectra |
| Ambient sound speed | 343 m/s | Explicit workbench assumption, not reported test weather |
| M1 horizontal nozzle radius / angle | 39 m / 80° | Figure geometry; 63.5De≈38.99 m |
| M8 downstream / lateral offsets | 10 m / 13 m | Journal Section 6 and geometry |
| Nozzle / M1 / M8 heights | 1.8 / 1.45 / 0.12 m | Published |
| Core / source curves | Eldred / normalized historical | Workbench baseline choices |
| Sources | 240 slices, 0.1–5 Lc | Workbench baseline |
| Reflection / additional attenuation / margin | 0 / none / 0 | Compare free-field calculation with author-corrected readings |

Our receiver coordinates are M1: x=39 cos(80°), y=sqrt((39 sin(80°))²+0.35²), and M8: x=10, y=sqrt(13²+1.68²). Folding height into radial distance is exact for the modeled straight axisymmetric free plume. It does not model ground reflection. The 2011 prose calls 39 m a diameter, but the earlier paper explicitly identifies 63.5De as the **radius**; the diagrams support that interpretation. The fixed case retains 39 m, with no geometry fitted to sound levels.

Our source power is 0.5 × eta × F × Ue = **2.681952 MW**. The EUCASS power definition uses fully expanded jet kinetic energy, 0.5 × mass flow × Uj². The source does not provide all thermodynamic/mass-flow quantities needed to reproduce that exactly. Applying its efficiency to our documented power convention is an explicit modeling approximation, not a claim of exact original-model parity. It can shift absolute level. Likewise, the assumed ambient sound speed and axis-derived exit velocity carry uncertainty. None are fitted here.

## Data extraction and assessment scope

`extract_measured_case.py` reads the **vector** marker and connecting-line coordinates from PDF page 9. Axis-frame coordinates determine the dB mapping separately for M1 and M8. Filled circles are raw measured data; open circles and triangles are ground-corrected measurement scenarios at sigma=5,000 and 200,000 kPa·s/m². Both scenarios are retained; neither is selected to maximize agreement. Vector coordinates, drawing indices, axis calibration, the source URL and PDF SHA-256 are stored in `fukuda2011-measured.json`. Estimated reading precision is ±0.5 dB; it is not a measurement confidence interval.

Nineteen nominal third-octave bands (125–8,000 Hz) are extracted for each receiver and each of three curves: **114 source values**. The workbench's exact base-10 centers are paired by nominal band index. The paper does not specify its exact band implementation, so small band-convention differences remain. This pairing does not rebin measured energy or interpolate levels to fabricate new measurements.

The **primary assessment** uses 13 nominal bands, 125–2,000 Hz, at each of two receivers. Higher bands remain in CSV/report tables and the source fixture as diagnostic data. They do not enter headline metrics, given documented microphone-response concerns above 2 kHz, especially for the near-field piezoelectric sensor. Reported overall levels, if any, must be restricted to the same bands; no full-spectrum OASPL claim is made.

## Results without calibration

Differences are workbench minus each author ground-corrected spectrum. The calculator uses the fixed baseline above; no core, directivity, efficiency or vertical offset was optimized.

| Receiver | RMS vs. sigma 5,000 | RMS vs. sigma 200,000 | Mean bias A / B | Maximum absolute A / B |
|---|---:|---:|---:|---:|
| M1, 80° arc | 4.732 dB | 4.391 dB | −0.257 / +0.755 dB | 7.870 / 8.237 dB |
| M8, near field | 2.726 dB | 2.228 dB | −1.206 / −0.535 dB | 4.191 / 4.356 dB |

The M1 mean is close to zero even though individual spectral discrepancies exceed 8 dB. That is why spectral RMS and maximum residual are reported alongside bias. M8 agreement is better for this case, but two receivers do not establish a general accuracy envelope.

For context only, comparing the free-field prediction directly to the **raw ground-affected measurements** gives RMS differences of 3.822 dB (M1) and 6.464 dB (M8). The apparent better M1 raw agreement is not evidence that omitting reflection is physically correct. Raw and corrected readings must not be silently interchanged.

Illustrative one-at-a-time sensitivities over the assessed bands and both receivers:

- c0=331 or 355 m/s instead of 343 changes a band by at most 0.203 dB.
- Exit velocity ±5% changes a band by at most 0.223 dB under the workbench's fixed-Mach model.
- Efficiency 0.5% or 1.0% instead of 0.84% shifts all levels by −2.253 or +0.757 dB, respectively.

These ranges are not confidence bounds. They demonstrate that uncertainty in acoustic power and the ground treatment matters more than these modest sound-speed/exit-speed changes for this particular assessment.

## What this establishes, and what it does not

1. The tool now has a source-backed comparison to **actual measurements**, independent of Smith's erroneous angle replay. It can expose both strengths and weaknesses of DSM-II under declared assumptions.
2. Free-field targets are author-corrected measurements, not direct reflection-free recordings. The correction itself uses an assumed distributed source model and Varnier core. This dependence limits its independence as a model-validation target.
3. The motor is overexpanded, and both receivers are within 100 exit diameters of portions of the modeled source. Shock-associated noise, coherence and near-field effects exceed the solver's simplified physics.
4. No acceptance tolerance was specified in advance. The source's experimental variability is not automatically an allowable error for this calculator. The measured comparison is therefore reported numerically rather than labeled a universal pass.
5. A stronger independent absolute-level benchmark would release the raw recordings/band levels, test-specific mass flow and exit thermodynamics, weather and facility impedance, or a genuinely free-field static firing. The present case is useful now, with these limits visible.

## Audit and reproduction

- Numerical/fixture tests check power and geometry mapping, 19 source bands versus 13 assessed bands, raw/corrected separation, residual calculations and slice convergence.
- The independent SciPy DSM-II reference now includes both NAL-735 receivers; it verifies the declared implementation using continuous plume integration, not the empirical model's physical accuracy. See `dsm2-independent-results.json`.
- Browser checks verify both receiver plots, original and corrected spectra, fixed-case isolation, calculator loading, provenance-rich CSV/HTML exports, offline behavior and mobile layout.
- Production `engine.js` and its empirical coefficient tables are unchanged. Smith's diagnostic helper is not called by this measured-data case.

Run `node test_measured.cjs`, `python verify_dsm2.py`, and `node test_measured_browser.cjs` from this directory. Run `python extract_measured_case.py` only to regenerate source readings, with the original journal PDF saved as `research/tsutsumi2011.pdf`. In the tool, select **Verification & audit → Run measured comparison**. `nal735-case.json` is importable; the dedicated report and CSV retain all source readings and assumptions.
