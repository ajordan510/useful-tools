# Vibration Damage Comparison

An offline engineering tool for comparing a documented heritage sine sweep / resonance-dwell qualification exposure, or an independent assumed resonant dwell at each SDOF frequency, with a new random vibration PSD requirement.

## Start

Download `vibration_damage_comparison.html` and open it in a modern browser. No server, installation or network connection is required. The initial data is illustrative, not a hardware qualification case.

Wait for **Calculator ready**, then choose **Run comparison**. The tool brings the results into view after calculating, including on narrow screens. Input errors appear above the inputs and are brought into view.

For a first run, open **Worked example & tutorial**. The eight-step walkthrough follows the checked 100 Hz reference case from input units through oscillator response, dwell cycles, random damage, fatigue coverage and the separate peak screen. It then contrasts a documented dwell with independent assumed resonant dwells across 90–110 Hz. A local experiment demonstrates how dwell cycles and random duration change fatigue coverage. Reading and experimenting leave the workspace and its exports untouched; explicit Load buttons replace the workspace inputs and calculate either teaching case.

The tutorial includes an original, accessible mass–spring–damper schematic and three responsive SVG plots: the sine transfer function, filtered response PSD, and documented-versus-assumed fatigue coverage. Captions distinguish the conceptual schematic from calculated curves, explain units and scales, and provide numerical takeaways. All plotted values come from the current engine and fixed reference inputs; no network or image downloads are required.

If Run comparison is disabled and **The calculator has not started** remains visible, the file viewer may be blocking JavaScript. Download the HTML and open the saved file in a browser with JavaScript enabled; an attachment or document preview may display the form without running it. If a browser error appears, include its exact message when reporting the issue.

Read `Vibration_Damage_Comparison_White_Paper.pdf` for the baseline method, equations, ground rules, assumptions, examples and references. The editable source is `WHITE_PAPER.md`. The white paper and archived technical audit describe v1.0.2's documented-schedule model; the assumed-resonance extension introduced in v1.1.0 is specified below and in the app's Method & interpretation section.

## Multiple comparisons and PowerPoint reporting (v2.0)

1. Name the case, identify both specifications/revisions, and record evidence and assumptions. Use the text areas or expandable row editors for sine segments, dwells and PSD points; tab-separated spreadsheet paste is accepted. Expand the input preview to check shapes and units.
2. Run the comparison. The primary plot shows **coverage R / target**, so the target is always **1**. The separate peak plot uses the same threshold convention. Known-mode assessments use dots with faint connecting context curves. The alternate fatigue estimator is optional. Detailed spectra and sensitivity are grouped below the main results.
3. **Duplicate case** to reuse a common specification without linking cases, or **Add case** for a new pair. Switch cases with the active-case selector. Names can be edited in the case inputs. Each case retains its own inputs and calculated results during the session. Removing a case can be undone.
4. In **Case collection & reporting**, include the desired cases and choose **Run all included cases**. Any missing, invalid or changed result blocks collective exports until recalculated or excluded. Common coverage axes use the included cases; this affects presentation only, not the calculation.
5. **Export PowerPoint** produces a 16:9 summary and four slides per case (inputs, sine unit check, fatigue pair, peak pair). For seven typical cases this is 29 slides. Titles, specification tables and takeaway text are editable; charts are high-resolution PNG images. Exact input records, full analyst interpretation, warnings, revision and calculation time are preserved in slide notes. Optional appendices add peak plots, sensitivity tables and review records. Individual plots can also be saved as labeled SVG or high-resolution PNG.
6. **Save collection JSON** before closing. Reopening restores independent inputs, inclusion choices and case revisions; results must be recalculated with the current engine. Data stays in memory unless explicitly downloaded. Up to 30 cases can be collected. Existing single-case JSON files still open into the active case.

Compact HTML reports include the takeaway, input summaries, seven essential plots and review notes per case. The detailed input/frequency appendix is optional. The summary CSV is useful for a report index; the individual results CSV retains full numerical data. Downloaded case files include the case ID, name and revision. Analyst interpretation is labeled separately from the calculated findings.

**Focus on results** expands the results to the full workspace width. Changing a case input disables all of its result and plot exports until recalculation. No engineering equations were changed for v2.0.

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
node test_reporting.cjs
node test_extreme.cjs
python3 validate_reference.py
python3 build_white_paper.py
python3 build_white_paper.py --source TECHNICAL_AUDIT.md --output Vibration_Damage_Comparison_Technical_Audit.pdf --audit
```

The audit script requires NumPy, SciPy, Matplotlib and Tkinter (imported by the external source; no GUI opens). It uses unmodified pinned FLife modules without installing optional visualization packages. Source hashes and runtime versions are recorded in the benchmark JSON. `reference/audit-manifest.json` records delivered calculation-file hashes.

## Inputs

- One axis and hardware configuration per case, with evidence notes.
- Sine segments with independent unit conventions: double-amplitude or peak displacement, peak/RMS velocity, and peak/RMS/peak-to-peak acceleration.
- Documented dwell frequencies, optional peak-G overrides, time/cycle caps (earlier positive limit), and repetition counts.
- Alternatively, a shared assumed-dwell rule applied independently at each oscillator's natural frequency, using the local sine-profile amplitude.
- Optional quasi-steady sweeps specified by one-way traversals and oct/min or Hz/min rate.
- Positive log-log PSD breakpoints in g²/Hz, duration, repetitions and optional dB adjustment.
- Q, fatigue exponent b, damage coverage factor, random peak screen factor and frequency scope.

Sine row: `low_Hz,high_Hz,unit,low_level,high_level`.

Dwell row: `Hz,g_peak_override,hour_cap,cycle_cap,repeats`. A zero override uses the profile; a zero cap disables that cap. At least one cap must be positive. The sine amplitude multiplier applies to overrides too.

PSD row: `Hz,g2_per_Hz`. Blank lines and trailing `# comments` are accepted. Fields may use commas, tabs, semicolons or spaces. Omit headers. See the unit-code menu in the tool.

## Unknown-resonance screening

Under **Resonance dwells → Dwell analysis**, select **Assumed dwell at each resonance**. This selects the full oscillator bank as the initial summary scope. Enter the hours cap, cycles cap and repeats once; the manual schedule is retained for switching back but ignored in this mode. Zero disables a cap, and at least one cap must be positive. Set sweep traversals to zero for a dwell-only comparison, or retain the specified sweep exposure.

Every frequency is a separate hypothetical case: an oscillator at natural frequency `fn` receives one dwell with excitation frequency `fn`, acceleration `A(fn)` from the sine profile after the amplitude multiplier, and duration per repeat `t(fn) = min(positive hour cap × 3600, positive cycle cap / fn)`. The total cycle count is `N(fn) = fn × t(fn) × repeats`. Its dwell damage index is `N(fn) × [A(fn) × H(fn, fn, Q) / zref]^b`, using the existing relative-displacement transfer function `H` (metres per peak g) and `zref = 0.001 m`.

Only this dwell contributes to that oscillator's dwell damage and peak screen. Hypothetical dwells at other frequencies contribute nothing. Enabled sweeps are included through the existing integration, and random damage continues to use the full filtered PSD. Each hypothetical case receives the complete dwell allowance; no total test time is distributed across the bank and no damage is summed across bank frequencies. Refining the grid changes sampling resolution, not exposure at an existing frequency.

Outside the sine profile, assumed dwell credit is zero. Such frequencies remain in the comparison; enabled sweeps may still contribute off-resonant response. A discontinuous shared sine boundary requires an explicit choice of lower or higher peak acceleration, or a corrected continuous profile. This boundary choice affects only the shared endpoint, not adjacent segment interiors. The illustrative profile has a small jump at 80 Hz, so switching that example to assumed mode requires this choice too.

The results label the analysis as **Hypothetical resonance screening**, show the local dwell's amplitude, duration, limiter, repeats and cycles at the inspected frequency, and list sampled frequencies/ranges where `heritage damage / random damage / damage target < 1`. Plot shading marks those sampled ranges; their endpoints are not exact threshold crossings. Zero-coverage points are displayed at the logarithmic plot floor and retain their true zero values in tables and CSV. Refine the frequency grid near a decision boundary. Known-modes scope remains available but assesses only those listed points.

Case JSON and HTML reports retain the dwell mode and common rule. CSV includes the mode, per-frequency dwell status and each assumed dwell's frequency, amplitude, time, limiter, repeats and cycles. Older cases lacking the new fields load in documented-schedule mode. The Q/b sensitivity calculation repeats the same independent-scenario comparison.

This answers whether the sine specification would provide the requested relative fatigue coverage **if a resonance existed at a given frequency and the specified dwell were performed there**. It does not establish actual resonance locations or achieved historical exposure.

## Outputs

- Fatigue-damage spectra and heritage/new damage ratios: Dirlik and narrowband cross-check.
- Separate relative-displacement peak-response comparison.
- Equivalent random duration and required uniform amplitude/PSD scaling.
- Explicit dwell duration and cycle accounting; per-dwell damage contributions at an inspection mode.
- Independent assumed-resonance screening and sampled frequency ranges below the fatigue target, with zero-credit frequencies visible.
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
node test_reporting.cjs
python3 validate_reference.py
```

`engine.js` contains the independent calculation engine. `app.template.html` holds the UI. `tutorial.html` contains the editable tutorial prose, captions, accessible schematic and layout; `tutorial.js` computes the worked values and plots and manages the isolated experiment. Build after editing any of them; `vibration_damage_comparison.html` embeds all sources and is the distributable. Tutorial plots have their own renderer so visiting the tab cannot replace the workspace plot exports.

The SciPy reference check needs NumPy and SciPy. PDF generation (`python3 build_white_paper.py`) needs Matplotlib, Pillow and ReportLab. These are development dependencies only.

Browser smoke tests require Playwright and Chromium:

```sh
node test_browser.mjs
node test_collection.mjs
node test_peak_browser.mjs
# Windows with PowerPoint installed: powershell -File test_powerpoint.ps1
# Optional: CHROMIUM_PATH=/path/to/chromium TEST_ARTIFACT_DIR=/tmp/vdc-qa node test_browser.mjs
```

Twenty-five engine test groups cover the baseline model and assumed-dwell analytical values, grid independence, caps, scaling, optional sweeps, boundary choices, zero credit and sensitivity. The independent reference script covers 96 quadrature/PDF-integration cases; the archived audit contains 32 additional sweep/peak cases. Browser checks cover both dwell modes, plots, exports, case roundtrip and legacy imports, stale-result protection, invalid inputs, zero coverage, mobile layout and absence of network requests. Tutorial checks verify worked values, rendered plots, mobile label bounds, experiment scaling, workspace/export isolation and both example loaders. This is numerical/software verification; experimental validation and engineering approval remain specific to the hardware and program.

## References

- Dirlik & Benasciutti (2021), https://doi.org/10.3390/met11091333
- Zorman, Slavič & Boltežar (2023), https://doi.org/10.1016/j.ymssp.2023.110149
- NASA NESC Academy, Tom Irvine, *Using Fatigue to Compare Sine and Random Environments*: https://nescacademy.nasa.gov/video/2584e207341e411b95fa829e191d81441d

Version 2.0.0, 2026-10-11. Adds independent case collections, table/paste inputs and previews, normalized reporting plots, SVG/PNG downloads, compact reports and offline PowerPoint export. Retains the tutorial, independent assumed-resonance screening and audited baseline calculation methods.

`reporting.js` owns shared report summaries and figures; `collection.js` owns case snapshots and report selection; `input-editor.js` owns input editing and plot downloads; `presentation-export.js` builds presentations using the vendored PptxGenJS 4.0.1 runtime. See `vendor/README.md` for provenance and licenses. Build after editing any source. The collection tests additionally require JSZip to inspect generated packages; all production export dependencies are embedded in the standalone HTML.

The seven-case browser test checks independent duplication, switching, common axes, stale/invalid export blocking, save/load, include/exclude, remove/undo, table/paste input, SVG/PNG/HTML/CSV export and a 29-slide PPTX with editable tables and source notes. PowerPoint desktop was used to open and render the generated deck during this release's layout review.


## Plot interpretation updates (v2.1.0, 2026-10-12)

- **Fatigue coverage** keeps the existing values: coverage = R / F, where R = sine damage / random damage and F is the required damage factor. It equals R only when F = 1. Removing “(log)” from the axis label does not change the logarithmic scale or transform the underlying values. The source plot on the left uses sine damage and F × random damage, so dividing its two curves gives the coverage exactly.
- **Peak coverage** is sine peak / (selected k × random RMS). The left plot now shows those peak curves together with the RMS vibration response spectrum (VRS). Every curve uses relative displacement and the same Q. These are not absolute-acceleration response spectra.
- Guidance beside k and in the method tab distinguishes an RMS VRS, a fixed-k peak screen and a duration-dependent extreme response spectrum. The default k = 4 is an assumption, not a recommendation for every exposure. A case-specific leading narrowband estimate, sqrt[2 ln(ν₀T)], is shown for the inspected oscillator as guidance only; it neither changes k nor assigns a confidence level. T includes all random exposures. A probability-based ERS/URS needs an explicit statistical model and per-mode/non-joint probability interpretation; this release retains the selected-k peak calculation.
- Sine input is also plotted in **inches double amplitude (peak-to-peak)** using DA = 2 × peak g × 9.80665 / [(2πf)² × 0.0254]. It includes the sine multiplier; dwell overrides remain separate.
- Shared figure formatting uses scientific notation below 0.001 and at or above 10,000, with additional axis clearance. UI, SVG/PNG, HTML and PowerPoint use the same figure definitions. Each coverage pair shares frequency limits, including common axes across cases.

Primary references for the new peak guidance: [VRS definition](https://www.vibrationdata.com/VRS.htm), [Irvine, Peak Response to Random Vibration, Rev H (2020)](https://www.vibrationdata.com/tutorials2/peak_response_random_revisionH.pdf), and [Rayleigh peak distribution](https://www.vibrationdata.com/tutorials_alt/RayD.pdf). The calculation equations and selected-k outputs are unchanged.

## Optional extreme-response estimate (v2.2.0, 2026-10-12)

In the random inputs, **Random peak model** defaults to **Selected k × RMS**. Existing cases and the tutorial retain that calculation. Choose **Duration + probability estimate** to compare sine peaks against an approximate random extreme spectrum. The selected random peak curve is the denominator of peak coverage; the RMS VRS remains a context curve. Fatigue calculations are unchanged.

The optional model uses [Irvine, Rev H, equation (4)](https://www.vibrationdata.com/tutorials2/peak_response_random_revisionH.pdf), often called an XRS/URS when a probability is specified:

```text
N = ν₀ T; ν₀ = sqrt(m₂/m₀) in Hz; T = minutes × 60 × repetitions
k(N,p) = [sqrt(2 ln N) + 0.5772 / sqrt(2 ln N)]
         × sqrt(-ln[1 - p^(1/N)] / ln N)
random extreme = k(N,p) × response RMS
```

Here p is the nominal non-exceedance probability for the event's maximum absolute response **at one oscillator**, not simultaneous coverage across modes or hardware reliability. The tool accepts 50–99.99%, starting at an editable 99%. Select the probability from the analysis requirement and record its rationale. The model assumes stationary Gaussian, nearly narrowband response; repeated exposures contribute to total duration without modeling startup transients. Broadband responses prompt an explicit review note. A minimum of 100 expected response cycles at every calculated oscillator is a practical long-exposure guard, not a statistical validity guarantee. Below it the optional calculation stops with an explanation; the selected-k method remains available.

The engine evaluates the small tail probability with `expm1` to avoid cancellation. It reproduces the source's 500 Hz / 1200 s / 50% example, k = 5.34 to published precision. This verifies implementation of the approximation, not its applicability to a particular measured environment.

Case/collection JSON preserves the selected model and probability. Plots, HTML reports and PowerPoint slides identify the model; exported peak figures include exposure duration. The peak-basis narrative gives the frequency-dependent k range, inspected and governing values, assumptions and source. Slide notes retain the complete inputs. CSV now labels the selected denominator `random_selected_peak_m` and adds `effective_peak_factor_k`, `expected_response_cycles`, and `random_fixed_k_reference_peak_m`; metadata and the collection summary also identify the model/probability. Consumers of the old `random_k_sigma_peak_m` header should use the selected or fixed-reference column explicitly.

`test_extreme.cjs` checks the published example, independent CDF inversion over large cycle counts, probability/duration monotonicity, response-rate rather than natural-frequency dependence, PSD scaling, repeat equivalence, invalid and short exposures, broadband warnings, fixed-mode compatibility, unchanged fatigue, and paired-curve identities. Browser/collection tests include mixed peak models, disabled inputs, stale results, saved settings and probability provenance in the 29-slide PowerPoint export. All three generated decks are also opened and rendered in PowerPoint for layout review. The archived white paper remains the baseline documented-schedule method; this section and the app's Method tab specify the optional peak extension.
