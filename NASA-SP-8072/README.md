# Rocket Acoustics Workbench

An offline HTML engineering tool for estimating chemical-rocket broadband acoustic environments from NASA SP-8072 and documented research extensions.

## Open the tool

Open **rocket_acoustics.html** in Chrome, Edge or another modern browser. This single file includes the calculation engine, data, graphics and documentation. No installation, server, account or network connection is required. Wait for **Prediction complete**.

The tool starts with **DSM-II**, the Eldred core relation and a free plume. The initial case is illustrative. Enter engine properties and receiver coordinates, then select **Run prediction**. All quantities use SI units. Changing inputs invalidates results and disables result exports until recalculation.

## Included

- SP-8072 DSM-I and DSM-II with traceable approximations of the original empirical curves.
- A stationary adaptation of Mathews' 2025 SATURN spectrum, source locations, released directivity data and optional empirical propagation loss.
- Merged or independent/co-located engine clusters; user-specified acoustic efficiency.
- DSM-II Eldred/Varnier core selection, an idealized bent plume and optional core termination.
- Up to 30 receivers; band-limited OASPL, A-weighted level, RMS pressure, peak band and separate design allowance.
- Receiver spectrum, calculated sound-field map, source-allocation plot, frequency-selectable directivity, comparison pinning and model/efficiency sensitivity.
- Case JSON round trips, a native Excel workbook, full receiver-band CSV, individual SVG graphics and a standalone HTML report printable to PDF.
- A dedicated plume/deflector schematic reports the assumed nozzle-to-deflector distance, flow turn angle, core treatment and modeled source span. It updates with each successful prediction and is included in SVG and HTML-report exports.
- Sound-field geometry cues: nozzle-exit origin, downstream exhaust arrow and an aligned engine/nozzle inset that remains separate from the receiver markers. Hardware is schematic, not to scale; no shielding is modeled.
- An illustrated **Approach & research** guide with six embedded source figures, concise numbered steps, worked examples, expandable figures and linked source pages; a separate **Verification & audit** panel.

## Interpretation

**Export Excel** downloads a self-contained `.xlsx` workbook after a successful prediction. **Summary** contains every receiver's overall, A-weighted and design levels, pressure, peak band and source geometry; **Bands** contains every receiver/frequency combination; **Inputs** records the full case, derived source quantities, warnings and references. Tables have filters and frozen headers. Values retain numerical precision even where display formats show fewer digits. This is a result snapshot: edit and recalculate the case in the HTML tool to produce updated results. Export works offline and is disabled when inputs change until a successful recalculation.

This is a preliminary stationary acoustic prediction model, not qualified commercial software or an experimentally validated facility model. The professional interface does not imply certified accuracy.

The original scanned curves were manually approximated. DSM-II retains the historical Figure 12 distribution whose provenance error was identified by Gee (2021). Core shortening does not repair that distribution universally. Modern directivity is supported only at 0–90 degrees from downstream; unsupported predictions are rejected.

The application does not simulate ignition overpressure, nonlinear propagation, actual launch motion, pad shielding, water suppression, ground impedance, coherent interference or structural response. “Overall” refers to the selected third-octave band edges. Band-center A-weighting is approximate. A user allowance is not a confidence interval.

Read [RESEARCH.md](RESEARCH.md) for the literature assessment, equations, source decisions and extrapolation rules. Read [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md) for the secondary audit and validation limits.

## Verification status

- 21 engine test groups cover physical scaling, power conservation, geometric spreading, reflection, core/bend behavior, convergence and invalid inputs.
- 992 DSM-I/modern band comparisons against an independent Python/SciPy reference: maximum difference **0.000102 dB**.
- An independent continuous-source DSM-II integration checks 124 additional band results against 960-slice predictions; see the saved result file for residuals.
- Browser tests cover all models, offline operation, charts, exports, import, stale results, invalid inputs and a 390-pixel mobile viewport.
- A published Stennis check reproduces **10.58 MW → 190.244857 dB**, consistent with the report's rounded **190.25 dB**. This checks the power-level conversion only.
- Published measured receiver cases were found, but incomplete public inputs prevent an exact end-to-end replication. No measured receiver-accuracy claim is made.

Results are saved in `reference/`. Numerical agreement verifies the documented calculations; it does not remove empirical model uncertainty.

## Development

```text
node build.mjs
node test_engine.cjs
node test_geometry.cjs
python verify_reference.py
python verify_dsm2.py
node test_browser.cjs
python test_workbook.py
```

Run from this directory. Python physics verification requires NumPy and SciPy. Workbook verification requires openpyxl and reads the browser-test downloads. Browser verification requires Playwright and Chromium; set `CHROMIUM_PATH` to a locally installed Chrome/Edge executable if necessary. These are development dependencies only.

- `engine.js`: calculation library, usable independently with Node.
- `app.template.html`, `app.js`: interface and SVG rendering.
- `geometry.js`: case-driven plume geometry illustration and summary.
- `approach-guide.html`, `approach.css`, `method-details.html`, `method-references.html`: illustrated guide, detailed assumptions and citations.
- `figures/`: six source excerpts and page/crop provenance. `extract_reference_figures.py` reproduces crops from the locally downloaded PDFs; ordinary builds use the checked-in PNGs.
- `workbook-export.js`, `workbook-template.json`: offline XLSX snapshot serialization and styled template. The template was authored with `@oai/artifact-tool`; `create_workbook_template.mjs` and `package_workbook_template.py` reproduce it. Template regeneration is not required for ordinary HTML builds.
- `model-data.json`: approximate NASA figure readings and provenance.
- `vendor/saturn-directivity.json`: original released SATURN directivity values, converted from MATLAB storage without numerical reduction.
- `reference/example-case.json`: importable initial case.
- `reference/atlas-stationary-case.json`: importable modern research example; published engine parameters, illustrative receiver geometry.
- `reference/example-report.html`: saved example output.
- `reference/audit-manifest.json`: release hashes and source provenance.

Build again whenever the engine, interface or data changes. The distributable is self-contained and can be copied anywhere. The local `research/` source downloads and `_qa/` screenshots are ignored by Git.

Version 1.0.0, 2026-10-11. SATURN-derived components retain their Apache-2.0 attribution and license; see [NOTICE.txt](NOTICE.txt) and [vendor/SATURN-LICENSE.txt](vendor/SATURN-LICENSE.txt).
