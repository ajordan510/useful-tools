# Shock Prediction and Attenuation Workbench

**Version 1.0 is implemented. Open [shock_workbench.html](shock_workbench.html) in Chrome or Edge.** The standalone application runs offline without installation, a server, an account, or external dependencies. Research and implementation date: 20 October 2026.

This release provides the empirical/measurement foundation and linear SDOF isolation described below. It has numerical verification, but no physically validated source-device or attenuation database. The startup study is clearly marked as teaching data.

**Team announcement:** [Watch the narrated action-comedy trailer](trailer/shock_workbench_trailer.mp4), or use the [smaller 720p copy](trailer/shock_workbench_trailer_720p.mp4). [Trailer credits and production notes](trailer/README.md).

## Implemented capabilities

- Shared source library for separation bolts/nuts, pin actuators, cutters, linear shaped charges, frangible joints, clampbands, non-explosive releases, mechanical impacts and incoming interfaces. Point, line, ring, multiple-source and interface support are recorded as metadata.
- CSV/TXT import or paste of maximax acceleration SRS and uniformly sampled acceleration histories, with units, Q, axis, frame, configuration, reference location, valid band and evidence.
- Five methods: direct interface environment, whole-path SRS ratio, calibrated scalar distance power law, distinct frequency-banded dB factors, and linear SDOF isolation driven by a time history.
- Positive/negative and residual SRS, relative displacement, pseudo-velocity, pseudo-acceleration, measurement diagnostics, mount travel and transmitted dynamic force.
- Separate engineering allowance and additional test margin; component test/specification coverage, missing-band and evidence conditions; included-case envelopes and governing cases in the run manifest.
- Interactive SVG plots, frequency view limits, project JSON save/open, full run JSON with input SHA-256, numerical CSV, standalone HTML reports and SVG figure export.
- Background-worker calculations, cancellation, stale-result invalidation, desktop/mobile layouts and an embedded method guide.

## First use

1. Open the HTML file and inspect the baseline, alternative-path and line-source teaching assessments.
2. Choose **New study**, or replace the teaching source with applicable evidence. A device family name does not generate a source amplitude.
3. Enter the component interface, select a transmission method and supply calibration or transfer evidence. A whole-path ratio already represents the entire path; extra factors are not applied in that mode.
4. Enter allowance and test-margin rationales. Optionally supply an achieved test or specification with compatibility metadata.
5. **Run study**, inspect conditions alongside the curves, and save the project. Inputs remain in memory until downloaded; closing the page does not automatically save them.

To explore isolation, select **Linear isolation · time domain**, load the teaching half-sine, confirm prescribed base motion, and run. The example is a 100 g, 5 ms pulse sampled at 20 kHz, driving a rigid 2 kg payload on a 200 Hz, Q=2 support. This is an analytical example, not a hardware recommendation.

Import exactly two columns and an optional header. Spectra use frequency in Hz and acceleration; histories use time in seconds and acceleration; path ratios use Hz and dimensionless amplitude ratio. Choose g or m/s² in the editor. Frequency and spectrum levels must be positive, histories uniformly sampled, and all first-column coordinates strictly increasing. Blank numeric cells and extrapolation are rejected.

The production oscillator uses first-order-hold input integration, at least 64 response evaluations per oscillator period and four per input interval, and analytic residual extrema. Spectrum/band breakpoints augment the logarithmic grid. History assessment is limited to the declared measurement band and sample rate/10; that numerical bound does not establish instrument bandwidth. See **Method & verification** in the application or [method.html](method.html).

## Verification and development

Executed results: **30 engine checks, 64 independent oscillator cases / 640 scalar comparisons, and 24 browser checks passed**. The maximum tested maximax SRS deviation from the independent ODE solution was **0.397%**. See [VALIDATION.md](VALIDATION.md) and [validation-results.json](validation-results.json) for methods and limits.

```powershell
node Shock-Prediction/build.mjs
node Shock-Prediction/test_engine.cjs
python Shock-Prediction/test_numerical.py
node Shock-Prediction/test_browser.cjs
```

Production code has no external dependencies. Rebuilding and engine tests require Node.js. Numerical verification requires Python, NumPy and SciPy (`python -m pip install numpy scipy` in an isolated development environment). Browser regression requires Playwright (`npm install --no-save playwright`) and Chromium (`npx playwright install chromium`), or `CHROMIUM_PATH` pointing to an existing Chrome/Edge executable. Set `NODE_PATH` if Playwright is outside the normal Node module search path.

| File | Role |
|---|---|
| `engine.js` | Pure numerical/domain module shared by tests, browser and worker |
| `app.js`, `style.css`, `app.template.html` | Interface and exports |
| `method.html` | Embedded method specification and operating guide |
| `build.mjs` | Deterministically assembles the distributable HTML |
| `test_engine.cjs`, `test_numerical.py`, `test_browser.cjs` | Executable verification |
| `_qa/` | Ignored local screenshots, numerical outputs and downloads |

Edit source files and rebuild; do not hand-edit the generated HTML.

Complex FRF/MIMO transmission, FE/SEA integration, statistical uncertainty propagation, frequency-dependent fitted distance exponents, audited standards profiles and physical hardware validation remain future work. Version 1.0 does not claim completion of every gate in the broader roadmap.

## Broader research direction

Build a **source–structure–component workbench** with two calculation tracks:

1. **Empirical spectrum prediction:** measured source or interface spectra, qualified heritage analogs, and explicitly selected attenuation models for preliminary component environments.
2. **Dynamic response prediction:** measured or synthesized waveforms propagated through complex frequency response functions, reduced models, or externally supplied transient simulations.

Both tracks feed the same component assessment, uncertainty accounting, evidence library, and reporting workflow. Keep an SRS correction factor distinct from a physical transfer function. Keep predicted environment, qualification requirement, demonstrated test coverage, and component fragility distinct.

## Read the framework

| Document | Purpose |
|---|---|
| [Technical framework](FRAMEWORK.md) | Source taxonomy, physics, prediction methods, equations, attenuation studies, component assessment, data contracts, and user experience |
| [Research and evidence register](RESEARCH.md) | Primary-source findings, exact references and sections, access limitations, and recent developments through 2026 |
| [Implementation and validation plan](IMPLEMENTATION.md) | Staged scope, acceptance criteria, benchmark campaign, risks, and initial data priorities |

The first implemented release provides **measured SRS/time-history import, source and path records, empirical method comparison, component environment envelopes, and transparent margins**. Complex FRF propagation is the next substantial capability. A complete explicit solver, source hydrocode, and general transient SEA implementation remain external-integration candidates.

The proposed scope is spacecraft and launch-vehicle **structural shock**, including separation bolts/nuts, linear shaped charges, frangible joints, clampbands, non-explosive releases, and mechanical impact events. Source characterization starts at the mechanical input or measured response interface. Source-device design and manufacture are outside this tool's calculation scope.

The research identified NASA ShockSat as a particularly useful validation resource. Its public [file browser](https://nescacademy.nasa.gov/workshops/ShockSat/ShockSat1) lists impact, point-source, frangible-joint, model, and instrumentation packages. Dataset contents and numerical results have not been independently reproduced in this study.

## Decisions to preserve during development

- A device name alone never supplies a validated source level.
- Structural path length and load-path topology matter; straight-line distance is insufficient.
- Amplification is allowed. Attenuation factors cannot be stacked indefinitely or applied twice.
- SRS has neither Fourier phase nor a unique inverse waveform.
- Simultaneous inputs require timing/correlation treatment; separate events can be enveloped but retain their identities and counts.
- Measurement bandwidth, model bandwidth, statistical meaning, and qualification margin travel with every curve.
- A favorable SRS coverage ratio is evidence of environment coverage, not proof of component survival.

The architectural decisions and proposed numerical release gates are engineering recommendations from this study. They are not additional requirements attributed to NASA or ECSS. The research register distinguishes reviewed technical content from metadata-only and inaccessible references.
