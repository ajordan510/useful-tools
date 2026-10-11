# Vibration Damage Comparison

An offline engineering tool for comparing a documented heritage sine sweep / resonance-dwell qualification exposure with a new random vibration PSD requirement.

## Start

Download `vibration_damage_comparison.html` and open it in a modern browser. No server, installation or network connection is required. The initial data is illustrative, not a hardware qualification case.

Wait for **Calculator ready**, then choose **Run comparison**. The tool brings the results into view after calculating, including on narrow screens. Input errors appear above the inputs and are brought into view.

If Run comparison is disabled and **The calculator has not started** remains visible, the file viewer may be blocking JavaScript. Download the HTML and open the saved file in a browser with JavaScript enabled; an attachment or document preview may display the form without running it. If a browser error appears, include its exact message when reporting the issue.

Read `Vibration_Damage_Comparison_White_Paper.pdf` for the method, equations, ground rules, assumptions, examples and references. The editable source is `WHITE_PAPER.md`.

## Technical audit and reproducible reference case

- [Audit findings and equation traceability](TECHNICAL_AUDIT.md) and [audit PDF](Vibration_Damage_Comparison_Technical_Audit.pdf).
- **Method & interpretation → Check published benchmark** reproduces FLife's published regression: Dirlik **1595.031603 s**, narrowband **1064.200649 s**. This checks the random-fatigue kernel against fixed stress moments; it is not a full base-input benchmark.
- **Load reference case** runs the 100 Hz sine / 90–110 Hz random example. Its full relative-displacement calculation independently agrees with FLife: heritage/random Dirlik ratio **1.131908593**. [Importable case](reference/irvine-2011-case.json), [saved analysis report](reference/analysis-report.html), [results CSV](reference/analysis-results.csv), and [full benchmark data](reference/benchmark-results.json).
- Irvine's published random result uses finite-record acceleration rainflow and is **not exactly reproduced** by this stationary relative-displacement model. The audit quantifies and explains the difference. Numerical agreement with FLife does not validate a component fatigue prediction.

To regenerate the external checks, clone `https://github.com/ladisk/FLife`, check out `f39ba53d608b3338b16c9ebb5bd52c86635898b0`, and run:

```sh
python3 verify_audit.py --flife-root /path/to/FLife
node build.mjs
node test_engine.cjs
python3 validate_reference.py
python3 build_white_paper.py
python3 build_white_paper.py --source TECHNICAL_AUDIT.md --output Vibration_Damage_Comparison_Technical_Audit.pdf --audit
```

The audit script requires NumPy, SciPy, Matplotlib and Tkinter (imported by the external source; no GUI opens). It uses unmodified pinned FLife modules without installing optional visualization packages. Source hashes and runtime versions are recorded in the benchmark JSON. `reference/audit-manifest.json` records delivered calculation-file hashes.

## Inputs

- One axis and hardware configuration per case, with evidence notes.
- Sine segments with independent unit conventions: double-amplitude or peak displacement, peak/RMS velocity, and peak/RMS/peak-to-peak acceleration.
- Documented dwell frequencies, optional peak-G overrides, time/cycle caps (earlier positive limit), and repetition counts.
- Optional quasi-steady sweeps specified by one-way traversals and oct/min or Hz/min rate.
- Positive log-log PSD breakpoints in g²/Hz, duration, repetitions and optional dB adjustment.
- Q, fatigue exponent b, damage coverage factor, random peak screen factor and frequency scope.

Sine row: `low_Hz,high_Hz,unit,low_level,high_level`.

Dwell row: `Hz,g_peak_override,hour_cap,cycle_cap,repeats`. A zero override uses the profile; a zero cap disables that cap. At least one cap must be positive. The sine amplitude multiplier applies to overrides too.

PSD row: `Hz,g2_per_Hz`. Blank lines and trailing `# comments` are accepted. Fields may use commas, tabs, semicolons or spaces. Omit headers. See the unit-code menu in the tool.

## Outputs

- Fatigue-damage spectra and heritage/new damage ratios: Dirlik and narrowband cross-check.
- Separate relative-displacement peak-response comparison.
- Equivalent random duration and required uniform amplitude/PSD scaling.
- Explicit dwell duration and cycle accounting; per-dwell damage contributions at an inspection mode.
- Q/b sensitivity matrix, normalized input plots, response PSD and assessment table.
- Self-contained HTML analysis report, complete results CSV, editable case JSON and individual SVG plots.

The report can be printed to PDF. Exports include the case assumptions and version; changing inputs disables results exports until recalculation. All data stays in the local browser. Cases are saved explicitly; there is no background persistence.

## Interpretation

The model is an SDOF **relative exposure severity comparison**, not an absolute life model or automatic qualification decision. Relative displacement serves as a stress proxy. The unknown stress conversion and S-N intercept cancel only for the same dynamics, stress mapping and fatigue law. Do not sum damage across oscillator-bank frequencies.

Dirlik is the primary stationary Gaussian random model; narrowband/Rayleigh is a cross-check. The sine model is steady-state at fixed dwells and quasi-steady during sweeps. The peak factor is user-selected, not a duration-based confidence bound. Review assumptions, actual test completion, modal coverage, configuration/axis equivalence, peak response and sensitivity before making a disposition.

The same Q and b apply to both exposures. Different configurations, stress FRFs, nonlinear response, multiaxial interaction, non-Gaussian histories, mean-stress corrections, endurance limits, variable PSD blocks and rainflow time-history analysis are not implemented. Already-tested hardware needs a separate consumed/remaining-life assessment.

## Development and verification

```sh
node build.mjs
node test_engine.cjs
python3 validate_reference.py
```

`engine.js` contains the independent calculation engine. `app.template.html` holds the UI. Build after editing either; `vibration_damage_comparison.html` embeds the engine and is the distributable.

The SciPy reference check needs NumPy and SciPy. PDF generation (`python3 build_white_paper.py`) needs Matplotlib, Pillow and ReportLab. These are development dependencies only.

Browser smoke tests require Playwright and Chromium:

```sh
node test_browser.mjs
# Optional: CHROMIUM_PATH=/path/to/chromium TEST_ARTIFACT_DIR=/tmp/vdc-qa node test_browser.mjs
```

Eighteen engine test groups, 96 independent quadrature/PDF-integration cases and 32 additional sweep/peak cases verify the calculations. Browser checks cover file-based operation, plots, exports, case import, stale-result protection, invalid inputs, mobile layout and absence of network requests. This is numerical/software verification; experimental validation and engineering approval remain specific to the hardware and program.

## References

- Dirlik & Benasciutti (2021), https://doi.org/10.3390/met11091333
- Zorman, Slavič & Boltežar (2023), https://doi.org/10.1016/j.ymssp.2023.110149
- NASA NESC Academy, Tom Irvine, *Using Fatigue to Compare Sine and Random Environments*: https://nescacademy.nasa.gov/video/2584e207341e411b95fa829e191d81441d

Version 1.0.2, 2026-10-11. This release adds audited reference checks, exact sweep peaks and explicit handling of ambiguous dwell boundaries; it retains the 1.0.1 startup and result-navigation fixes. See the white paper for source roles and implementation details.
