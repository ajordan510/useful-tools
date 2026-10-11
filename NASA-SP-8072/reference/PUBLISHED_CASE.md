# Published DSM-II spectrum comparison: Smith (2013)

## Finding and status

**The 13.11 dB RMS discrepancy is traced to different directivity, a quadrant error in the publication's appended code, and smaller curve/band conventions.** A diagnostic reconstruction reproduces Figure 53 to **0.182 dB RMS / 0.339 dB maximum**, without fitted offsets or efficiency. It includes the source error and therefore must not be used as a physical prediction. The production calculator already uses correct vector geometry. The earlier comparison did not match model definitions; its presentation has been corrected. This is laboratory-jet published-curve reconstruction, not full-scale rocket or experimental validation.

Source: Wesley Oliver Smith III, *An Empirical and Computational Investigation into the Acoustical Environment at the Launch of a Space Vehicle*, Auburn University dissertation (2013), [university record](https://auetd.auburn.edu/handle/10415/3954). Section 3.4, Tables 8–10, Figure 53; printed pp. 59–63 / PDF pp. 75–79. The university PDF was reviewed directly. Figure 53 compares a DSM-II variant with Norum's wind-tunnel experiment. Only the **red predicted band-SPL curve** is digitized here; the blue SSDL curve and black measurements are not treated as interchangeable data.

## Reproducible input mapping

| Quantity | Workbench value | Basis |
|---|---:|---|
| Engine count | 1 | Single wind-tunnel nozzle |
| Thrust | 794.3 N | Section 3.4 estimate |
| Exit velocity | 406.6 m/s | Section 3.4 |
| Exit diameter | 0.073 m | Section 3.4 |
| Mach | 1.15 | Operating condition, not nozzle design Mach 1.5 |
| Acoustic power | 14 W | Table 9, Lush formulation adopted in the dissertation |
| Equivalent efficiency | 0.00866974042% | Derived as 200 × 14 / (794.3 × 406.6); not fitted here |
| Receiver x, y | +3.5, +3.5 m | Table 8: paper X=0, Y=3.5, Z=−3.5; exhaust is −Z |
| Nozzle distance | 4.949747 m | Derived; 3.5 m is the sideline offset, not radius |
| Ambient sound speed | 353.496535 m/s | Derived from 311 K with ideal-air γ=1.4, R=287 J/(kg K) |
| Plume, reflections | Straight, +0 dB | No ramp; free-field reconstruction |
| Core / slices | Eldred / 240 | Workbench choices; 0.1–5 Lc support |
| Normalization / directivity | On / historical Figure 10 | Workbench choices, not a claim of Smith implementation parity |
| Band centers | 100–10,000 Hz, base-10 thirds | Workbench comparison range |

The full case is `smith2013-case.json`. Its notes travel with calculator JSON, CSV, Excel and reports.

## Independent published readings

`smith2013-spectrum.json` contains 21 readings, source SHA-256, pixel coordinates and calibration. `digitize_smith.py` extracts the embedded 478 × 368 figure from PDF page 79. The log-frequency calibration is x=47.5 at 10 Hz and x=403.5 at 10 kHz; the linear-level calibration is y=37.5 at 120 dB and y=327.5 at 40 dB. The red stroke is sampled independently of engine output. Where a measured marker obscures the stroke, interpolation uses the nearest bracketing red columns, limited to five pixels on each side. Those columns are retained in the fixture.

Graph-reading precision is estimated at ±0.5 dB, not a statistical confidence interval. Visual spot checks are approximately 91.7 dB at 1 kHz and 89.2 dB at 10 kHz. The displayed original figure allows further checking. The excerpt contains the axes and legend; its attribution is supplied separately.

Smith specifies **base-2 third-octave centers** on printed p. 38 (e.g. 99.2 and 10,079.4 Hz). We sample the plotted connecting curve at the workbench's base-10 centers. This is approximate curve interpolation, not exact rebinning of original band energies. The source provides no tabulated Figure 53 values. This small frequency/bandwidth convention difference remains a comparison limitation.

## Results and discrepancy attribution

The reported 13.11 dB was **RMS of band-by-band differences**, not a constant correction or an overall sound-level difference. Original baseline mean bias is +11.390 dB, with a maximum +29.452 dB at 100 Hz. All stages below keep the physical inputs, 14 W source power, receiver and workbench's 240-slice, 0.1–5 core-length support fixed. No fit to the digitized data enters the computations.

| Cumulative change | RMS vs. figure, dB | Mean bias, dB |
|---|---:|---:|
| Workbench baseline | 13.106 | +11.390 |
| Wilby III instead of Eldred, physical angles | 5.644 | +3.275 |
| Replay Appendix D's angle calculation | 1.278 | +1.255 |
| Disable curve normalization | 0.480 | +0.414 |
| Smith axial and spectral fits | 0.197 | −0.158 |
| Center PSD × base-2 bandwidth | 0.182 | −0.143 |

These are cumulative counterfactual calculations, not additive dB error-budget entries. Changing their order can change the attribution. Full spectra and unrounded metrics are in `published-comparison-results.json`; the UI plots baseline, published and diagnostic spectra and exports all of them. An additional column shows Smith's fits with physical angles.

### Confirmed defect in the appended source code

Appendix D, printed p. 262 / PDF p. 278, computes the after-ramp angle using a one-argument `atand` and then subtracts it from 180 degrees. For the sonic-jet preset, the ramp angle is −90 degrees (printed p. 218), and the centerline is straight along paper −Z. In our coordinates the calculation reduces to:

```
theta_appendix = 180° − atan(y_receiver / (s − x_receiver))
theta_physical = atan2(y_receiver, x_receiver − s)
```

For sources before this downstream receiver, `theta_appendix = theta_physical + 180°`. At s=0.8 m with receiver (+3.5,+3.5) m, the physical angle is about 52.35°, while the appendix returns about 232.35°. An angle between a ray and the local flow vector must lie between 0° and 180°. The workbench's vector-dot-product/acos calculation already does so.

Wilby's third directivity as implemented on printed pp. 281–282 / PDF pp. 297–298 is:

```
DI = 0.088828 + 7.411814 log10(Sr) + 1.607279 [log10(Sr)]² + delta
Sr = f D / U
if theta < 170°: delta = 0
otherwise:
  Sr < 0.01: delta = −28.9339
  0.01 ≤ Sr ≤ 0.04345: delta = 61.7691 + 45.3515 log10(Sr)
  Sr > 0.04345: delta = 0
```

The erroneous >180° angles activate the correction meant for the far-upstream sector. With Sr=0.01795376 at 100 Hz, **delta = −17.40757 dB**. The false correction disappears above approximately **242.01 Hz**, closely matching the bend in the published low-frequency curve. At 100 Hz:

- Workbench baseline: **86.509 dB**.
- Smith fits and physical angles: **74.384 dB**.
- Smith fits and erroneous appendix angles: **56.977 dB**.
- Independently digitized Figure 53: **57.057 dB**.

All sources in the retained workbench span are before the microphone, so this particular low-frequency delta acts on every source. Do not generalize that constant-per-band result to other source extents or geometries.

The code defect is confirmed directly; attribution of Figure 53's behavior to it is a **strongly supported inference**, not proof of which saved software version generated that figure. The source run files are unavailable. Correcting the source angle moves the reconstructed low-frequency spectrum away from the printed curve; forcing the calculator to match it would introduce the same error.

### Other model choices

1. **Directivity:** the calculator uses interpolated Eldred Figure 10. Smith uses Wilby III, giving a different angular/frequency response. Smith explicitly extends Wilby's stated 90°–180° domain to 0°–180° on printed p. 25. The physical-angle alternative in this audit remains an extrapolation of Wilby and is not offered as a recommended general rocket model.
2. **Normalization:** disabling our energy normalization lowers this baseline by 0.841277 dB. Smith's fits are used as printed, without renormalization. His axial fit is on printed pp. 278–279 and spectral fit on p. 280. The analytical fits differ from our digitized curves, especially in spectral tails. Their modified Strouhal uses ae/ao=1 for equal 311 K jet/ambient temperatures, retaining the paper's rounded U and M for their respective roles. The reconstruction uses exact 4π spreading; Appendix D rounds 10 log10(4π) to 11 dB (a 0.008 dB difference).
3. **Band treatment:** Smith uses center spectral density multiplied by `f × (2^(1/6) − 2^(−1/6))`. We normally integrate band energy between base-10 edges. The final diagnostic evaluates Smith's expression at the workbench center frequencies to compare with the digitized connecting curve. It is not an exact replay or rebinning of the original base-2 band sequence.
4. **Numerical resolution and ambient temperature:** baseline 240→960 slices changes at most 0.000107 dB; using 300 K instead of 311 K changes at most 0.15613 dB. Neither explains the large gap. Replay 240→960 changes at most 0.000754 dB.

### Remaining limits, and what was fixed

- **No production solver error found:** audited angle convention, source power, spreading, summation and integration. `engine.js` and empirical tables are unchanged. A reconstruction helper is isolated in the fixed-case audit, and the source-code error cannot be selected in the calculator. The fix is a properly qualified, model-aware comparison with traceable causal diagnostics, replacing the unexplained baseline-only comparison.
- **Exact source support is unknown:** the retained workbench span is 0.1–5 Lc (about 0.052–2.600 m), with 240 midpoint cells. The appended UI defaults include 0.5 m slices and 50D support, but the saved small-jet run is not supplied. Those generic settings should not be silently declared the Figure 53 settings. Source support and near-nozzle cells can affect a replay, particularly below 250 Hz. The close agreement is for the explicitly stated reconstruction, not full source-code identity.
- **Rounded vs. appendix inputs:** the appendix preset uses U=406.57 m/s, F=794.28 N and microphone Y=3.505 m, Z=−3.588 m, whereas Section 3.4/Table 8 give rounded values retained here. No input was optimized to reduce residuals.
- **External Proudman data:** Appendix D's special jet branch replaces axial power using `matlab.mat`. Section 5.3, printed p. 123, explicitly introduces that replacement for later CFD-based Figures 84–89. This supports treating it as a later model variant, not a missing requirement for Chapter 3's empirical Figure 53. The empirical fits already reconstruct the latter within graph precision; exact code-to-output provenance remains unavailable.
- **Prediction, not measurement:** only the red predicted curve is digitized. The black experimental circles are not an acceptance dataset here. The 14 W empirical power, cold air jet, model extrapolations and broader frequency range of Table 10 limit any physical-accuracy claim.

### Secondary technical audit

The source equations and angle code were checked against original rendered PDF pages. Automated regressions test physical downstream/upstream angles, the erroneous +180° difference, Wilby's 170° and Strouhal thresholds, and source-curve agreement within the estimated ±0.5 dB reading precision. They also verify the corrected-angle alternative removes the artificial low-frequency penalty.

`verify_published.py` independently evaluates the published fits using SciPy adaptive **continuous spatial integration**, split at curve breakpoints. At 960 JavaScript slices, both the diagnostic and physical-angle alternatives agree with this independent calculation within **0.000121 dB** across 21 bands. Original `verify_dsm2.py` continues checking the production implementation against its independent reference. These establish numerical correctness of the stated algorithms, not correctness of the empirical physics.

The browser suite verifies diagnostic metrics, overlay, residuals, cumulative table, CSV/report provenance, calculator isolation, offline operation and mobile layout. No coefficients, acoustic efficiency or vertical offsets are fitted. The digitized reference remains unchanged.

**Disposition: discrepancy explained to plotting precision for the documented reconstruction; physical validation remains open.** A clean experimental verification still requires a complete measured dataset and applicable model assumptions.

## Other candidates reviewed

| Primary work | Why it was not used as an exact spectrum verification |
|---|---|
| [Perez & Allgood 2011, NASA Stennis](https://ntrs.nasa.gov/citations/20110012036) | Thrust class, U/D and normalized receiver coordinates are given; exact deflector placement and complete flow/source configuration are missing. |
| [Haynes & Kenny 2009](https://ntrs.nasa.gov/citations/20090023640) | Relevant Saturn V spectra, incomplete case settings for a replay. |
| [Varnier 2001](https://doi.org/10.2514/2.1199) | Useful flow tables and spatial/OASPL comparisons; sound power calibrated against measurements. No matching complete tabulated receiver spectrum for this tool identified. Author-posted full text reviewed. |
| [James et al. 2016](https://doi.org/10.2322/tastj.14.Po_2_17) | Strong full-scale evidence, but spatial band-level plots and modified RSRM directivity rather than a ready-to-replay full receiver spectrum and released parameter set. |
| [Park et al. 2014](https://doi.org/10.7776/ASK.2014.33.3.153) | KSR-III comparison requires additional impingement physics and deflector details; supplied table lacks some workbench flow inputs. |
| [Arvidsson 2022, KTH](https://www.diva-portal.org/smash/get/diva2%3A1698313/FULLTEXT01.pdf) | Actual RFA test, but Section 3.3.2 says some engine values are approximate or modified; three deflector plates, enclosure and water injection exceed this tool’s geometry/physics. |
| [Nguyen et al. 2025](https://publications.waset.org/10014241.pdf) | Saturn V spectra supplied, but no complete numeric baseline input table; directivity/model-definition differences also remain. |

The search does not prove that no suitable dataset exists. It establishes what the reviewed publications support. Several inaccessible or incomplete sources were not treated as verified evidence.

## Reproduce

Run `node test_published.cjs`, `python verify_published.py`, `python verify_dsm2.py`, and `node test_published_browser.cjs` from the NASA-SP-8072 directory (or use repository-relative paths shown in README). The standalone HTML embeds the fixture and source excerpt. In **Verification & audit**, use **Run published comparison**; **Load case + overlay in calculator** enables ordinary sensitivity work while preserving the published curve as a pinned reference. Dedicated CSV and HTML comparison exports preserve the fixed case independently of subsequent calculator edits.
