# Secondary technical audit

Rocket Acoustics Workbench 1.0.0 — 2026-10-11.

## Disposition

The implementation passes the delivered numerical and browser checks. It is suitable for inspectable preliminary comparisons within its declared assumptions. It is **not experimentally validated for a particular engine/facility**, and the historical DSM-II source-distribution issue remains a physical-model limitation.

This was a second technical review of the completed implementation, with separately written Python numerical references. It is not a separate engineer's certification, a NASA endorsement, or an independent execution of the complete MATLAB SATURN application.

## Audit method

1. Return to the original NASA equations and rendered empirical figures, separating spectral density from band power and pressure level from power level.
2. Read the modern publication alongside its released MATLAB functions and directivity data. Check signs, reference units, domains and version differences.
3. Inspect the production engine for geometry, interpolation, normalization, source summation and invalid-input behavior.
4. Write independent numerical calculations using SciPy adaptive quadrature and exact piecewise power-law integrals rather than the production quadrature.
5. Exercise the complete browser workflow and visually inspect desktop, modern-model, DSM-II and narrow-screen screenshots.
6. Search for published verification cases and document exactly which inputs and outputs permit reproduction.

## Findings and resolutions

| Finding | Consequence if missed | Resolution / remaining limit |
|---|---|---|
| SP-8072 Eq. 1 coefficient 0.005 corresponds to 1% acoustic efficiency | 3.01 dB error if described as the 0.5% nominal model | Explicit percent conversion and factor 1/2; UI explains nominal versus conservative values |
| Spectral curves are densities in dimensionless frequency | Wrong bandwidth and frequency scaling | Integrate power across exact band edges using the required Jacobian |
| Scanned curve approximations do not integrate to exactly unity | Source spectrum may exceed or undershoot specified acoustic power | Optional full-density normalization; report actual captured band fraction; preserve raw-curve option |
| Mathews dissertation Eq. 6.5 printed de-normalization sign and Eq. 6.10 spreading sign conflict with code and dimensional behavior | Power could decrease with thrust or grow with distance | Follow source power addition and spherical-spreading subtraction in the released code and NASA equations |
| Dissertation empirical-loss parameters differ from code | Undocumented model mixture | Pin commit and use code formulation, 16 Hz first corner and second exponent 1.5; document the discrepancy |
| Released modern directivity data cover only 0–90 degrees | Unbounded extrapolation into upstream locations | Reject unsupported receiver geometries and mask unsupported map cells; warn on Sr boundary holding |
| NASA Figure 10 has limited Sr and angular coverage | Unstated extrapolation | Hold curve boundaries and surface an applicability warning |
| Original Figure 12 inherits a historical plotting error | A numerically correct implementation can still embody incorrect physical allocation | Explicit warning and research discussion; do not advertise DSM-II as corrected or universally accurate |
| Shorter core does not improve every full-scale case | False general accuracy claim | Keep Eldred as baseline and expose Varnier as a sensitivity option |
| A slice can straddle a plume bend | A finite cell is incorrectly assigned a single tangent across a discontinuity | Split cells at the bend before midpoint integration; independent maximum DSM-II residual improved from approximately 0.00946 to 0.000155 dB at 960 slices |
| Pressure doubling and energy doubling differ | 3 dB reflection mistake or double-counting | Mutually exclusive 0, 3.0103 and 6.0206 dB settings; unit tests |
| Engine count affects both power and merged equivalent diameter | Wrong spectral shift or double-counted cluster power | Total power scales with N once; diameter is D sqrt(N) for merged and D for independent/co-located engines |
| Edited inputs can leave plausible old plots visible | Incorrect attribution/export of old predictions | Clear displayed results and disable exports until successful recalculation |
| Pinned comparison needs provenance in a standalone report | Unlabeled or unreproducible second curve | Preserve pinned input case, receiver and spectrum in the exported report |
| Extreme empirical attenuation can underflow linear energies | Infinite negative dB values despite finite model inputs | Stable logarithmic energy addition; strong extrapolation warning beyond 20 km |
| Unsupported inputs and source coincidence cause invalid math | NaNs, infinite level or broken graphics | Finite numeric ranges, enumerated modes, whole-number engines/slices, source exclusion radius and explicit errors |

## Numerical results

### Engine invariants

`node test_engine.cjs`: **21 groups passed**.

- Thrust and efficiency doubling: +3.0102999566 dB.
- Four independent, uncorrelated co-located engines: +6.0205999133 dB; effective diameter unchanged.
- Four merged engines: effective diameter doubles.
- Reflection added once; design allowance remains separate from predicted OASPL.
- RMS pressure and energy summation agree with dB definitions.
- A-weighting is approximately zero at 1000 Hz.
- Adjacent third-octave bands have contiguous exact edges.
- Narrower frequency selection leaves retained band powers unchanged.
- Broad frequency integration conserves acoustic power to the tested truncation tolerance.
- Core relationships, termination, bend continuity and slice convergence behave as specified.
- Omnidirectional far-field spreading approaches -6.0206 dB per distance doubling.
- Modern directivity exactly reproduces supplied table nodes and rejects unsupported angles.
- Modern spectral/loss equations match independently calculated fixed values.
- Invalid/nonfinite inputs and coincident source/receiver positions are rejected.

### Independent DSM-I and modern calculations

`python verify_reference.py`: **16 cases × 2 receivers × 31 bands = 992 band comparisons**.

The matrix includes both source models, raw/normalized spectra, geometric/empirical-loss propagation, and merged/independent cluster conventions. It uses NumPy/SciPy interpolation and adaptive integration with explicit spectral breakpoints. Numerical inputs are fixed and saved, including a 1.43 m nozzle, two engines, 3.83 MN total thrust and 3160 m/s exit velocity from the modern research example.

- Maximum band difference: **0.000101642 dB**.
- Maximum overall difference: **0.000011504 dB**.
- Acceptance tolerance: 0.012 dB.
- Ten raw modern-spectrum probes also cover all branches and boundaries.

This verifies the equations and the conversion of the released directivity data. It does not execute MATLAB, reproduce launch trajectories or independently verify the empirical dataset's physical accuracy.

### Independent DSM-II continuous-source integration

`python verify_dsm2.py`: **4 heritage cases × 31 bands + 21 laboratory-jet bands = 145 band comparisons**.

This reference uses analytic integrals for the piecewise power-law spectra and SciPy adaptive quadrature along the continuous plume. It compares with 960 production slices for both core definitions, free plumes and bent/terminated plumes.

| Case | Maximum band difference, dB |
|---|---:|
| Eldred, free plume | 0.000147887 |
| Varnier, free plume | 0.000151454 |
| Eldred, terminated bend | 0.000154674 |
| Varnier, terminated bend | 0.000154674 |
| Smith laboratory-jet reconstruction, Eldred | 0.000149115 |

Acceptance tolerance is 0.02 dB. The separate 240-versus-960-slice test verifies the default-resolution behavior within 0.06 dB at the tested receivers. The 60-slice map is a visualization approximation; it does not replace the receiver results.

### Browser and visual verification

`node test_browser.cjs` covers:

- Offline file startup and all four quantitative SVG graphics.
- Desktop layout and 390-pixel mobile layout without page-level horizontal overflow.
- Every model preset, including bent DSM-II and modern empirical propagation.
- Complete receiver-band CSV, SVG download, standalone HTML report and case JSON round trip.
- Pinned comparison and stale-result protection.
- Invalid efficiency and unsupported modern directivity rejection.
- Separate methodology and verification pages and the in-browser numerical checks.
- No JavaScript page errors and no HTTP(S) network requests during use.

Desktop, modern, bent-plume and mobile screenshots were visually reviewed. Axis labels were enlarged for readability and near-nozzle map label collisions were reduced. Plot legends, equal map spatial scales, units, source/receiver orientation and color semantics were reviewed. Colors encode calculated quantities only; no generated scientific imagery is used.

## Published verification evidence

### Reproduced numerical checkpoint

Perez & Allgood (2011), NASA report NTRS 20110012036, Table 3:

- Published acoustic power: **10.58 MW**.
- Published sound power level: **190.25 dB re 1 pW**.
- Calculated: **190.244856677 dB**.
- Residual: **-0.005143323 dB**, inside the 0.01 dB rounding-aware tolerance.

This is a real published numerical checkpoint. It checks conversion of already-specified acoustic power into sound power level; it is not a complete receiver prediction.

### Reproducible multi-component numerical case

The UI's stationary reference loads the independent case with 0.34% efficiency, 3.83 MN total thrust, U=3160 m/s, D=1.43 m per nozzle, N=2, merged plume, normalized modern spectrum, released modern DI and empirical propagation. It covers band centers 10–10000 Hz, with free-field reflection correction.

| Receiver (axial x, transverse y), m | Independent overall reference, dB |
|---|---:|
| (200, 300) | 135.922397557 |
| (3000, 5000) | 108.302806666 |

The in-tool check uses 0.001 dB tolerance. Receiver coordinates are deliberately fixed verification geometry, not measured station locations.

### Measured validation remains open

1. **Stennis case I/II:** normalized engine inputs and measured spectra are published. Independent U and D, exact geometry/source placement and some custom directivity information are insufficient for an exact replication. The report explicitly identifies ad-hoc DSM-I placement and missing water/shielding treatment.
2. **Saturn V in Haynes–Kenny:** measured spectra at 85 m and 45 m vehicle stations support core-termination effects. The complete analysis configuration is not provided in a form that can be imported and reproduced here.
3. **Firefly Alpha/Starship in Mathews:** modern launch validation requires full trajectory and measurement data and the complete moving-source model. The pinned repository does not supply that full experiment package. Reported research-model accuracy is not claimed for this workbench.

The next physical validation step is a fully specified static firing or launch case with consistent flow inputs, surveyed receiver/deflector geometry, calibrated third-octave spectra, suppression conditions and propagation information. Residuals should be compared by band and receiver without tuning efficiency separately for each observation.

## Residual limitations

- Manual curve readings and assumed tails are approximate. Numerical residuals below 0.001 dB are far smaller than empirical uncertainty and do not imply that physical accuracy.
- DSM-II Figure 12 remains historical, not corrected. The finite 0.1–5 Lc support is a modeling choice.
- Reflection is a simple scalar choice. Impingement, geometry, coherence and weather are not solved.
- The modern model is stationary; other model combinations are explicitly sensitivity configurations.
- Band-center directivity, geometry and A-weighting are approximations even though spectral power is integrated within each band.
- No independent peer-engineering sign-off or full measured validation has been completed.

## Reproduction and provenance

See README.md for commands. Saved results are `reference/engine-test-results.json`, `reference/independent-results.json`, `reference/dsm2-independent-results.json` and `reference/browser-test-results.json`. Case inputs and actual numerical values are retained in `reference/stationary-cases.json`. `reference/audit-manifest.json` records release/source hashes.

Primary sources and exact implementation rules are in [RESEARCH.md](RESEARCH.md). No unreported calibration was used to force a match with the published receiver spectra.

## Follow-up: map orientation and Excel export

- Added a schematic chamber/bell-nozzle outline below the data plane, aligned with x = 0; a leader connects the inset exit plane to the origin. Exhaust is directed toward +x, with the engine upstream. The inset is explicitly not to scale and does not introduce physical geometry or shielding into the calculation. It avoids obscuring near-nozzle receiver markers. Plot coordinates retain equal spatial scale and the original map sampling region.
- Added offline native XLSX export using an artifact-tool-authored three-sheet template. Every receiver and band is exported, with typed numeric values, source power, A-weighting, design allowance, SI inputs, complete case JSON, model warnings and source links. The workbook is explicitly a static snapshot; calculations remain in the HTML engine.
- Reviewed the ZIP archive and worksheet serialization, frozen headers, filters, precision, invalidation after input changes, XML escaping, and literal treatment of formula-like receiver names. An independent openpyxl reader checks downloaded workbooks for the baseline, modern, deflected and Unicode/literal-name cases: 9 receiver summaries and 279 frequency-band rows. Workbook previews were inspected for all three sheets.
- Browser checks cover the updated map, all prediction modes, desktop/mobile layouts, Excel/CSV/report/SVG exports and offline operation. All 21 physics test groups still pass. The prediction engine is unchanged; this update makes no new physical-validation claim.


## Follow-up: illustrated approach, DSM-II default and plume schematic

- DSM-II is now the startup and reference-preset method. The Eldred core, 0.5% efficiency, normalization and free-plume geometry remain the initial choices. Imported cases retain their requested source model. Existing numerical tests explicitly retain DSM-I where required, with an additional default-case regression check.
- Six bounded source-figure excerpts were inspected against the original PDFs: SP-8072 Figures 10–13 and Haynes–Kenny Figures 6–7. Captions identify source figure, printed page and PDF page. Axes, original curves and original captions are retained; the figures are embedded offline and can be enlarged. The guide distinguishes empirical data, historical limitations, tool-specific choices and published validation evidence.
- The original Haynes–Kenny Figure 8 caption specifies a 45 m vehicle station, not the previously stated 152 m. The verification panel now reports the correct 85 m / 45 m pair. The included comparison is Figure 7 (85 m).
- The geometry diagram reports validated case inputs and calculated core/source-span values. Tests cover inactive bends, 0/30/90/170-degree turns, preserved/terminated cores, a deflector beyond the source span, and models where core/bend controls do not apply. Angle β measures the outgoing centerline relative to +x; it is not a hardware plate angle. The diamond is a turn-station symbol, not an inferred deflector shape. Geometry is schematic, not to scale.
- Reviewed layouts at desktop and mobile widths, source-image loading, figure enlargement/keyboard dismissal, stale-case summaries, report/SVG exports and workbook round trips. These documentation and visualization changes do not add physical validation or modify the prediction equations.

## Follow-up: published spectrum comparison

Added Smith (2013), Figure 53 as an explicitly unresolved laboratory-jet comparison. The published curve is independently digitized, source-hashed and sampled at matching workbench frequencies (approximate interpolation from the paper’s base-2 bands). Input mapping checks preserve 14 W acoustic power and the 4.950 m receiver radius. Positive residual means workbench minus published. The full result is 13.11 dB RMS / 29.45 dB maximum difference, not a passing criterion.

The case is also checked by independent continuous-plume integration. Convergence, normalization and ambient-temperature diagnostics do not explain the published mismatch. Reviewed source-model differences and the appended code’s unreleased `matlab.mat` dependency; Figure 53 code-to-output provenance remains unresolved. No prediction equations or model data were changed. See [detailed audit](reference/PUBLISHED_CASE.md) and `reference/published-comparison-results.json`.

Browser checks cover fixed-case isolation, source overlay, residuals, CSV/report provenance, loading into the calculator, stale exports, offline operation and mobile layout. The comparison panel and exported reports state the failed agreement clearly. This audit is a secondary technical review, not independent professional sign-off.
