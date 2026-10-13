# Vibration comparison workbench

The standalone deliverable is `../vibration_workbench.html`. Open the downloaded file in a current desktop browser. No server or network is required for calculations, workbook import or reports. External reference links require internet access.

## Working with a study

1. Use **Inputs → Spectrum library** to edit or create reusable sine and random profiles. Give each specification a name and revision. Changes to a shared profile invalidate every referencing case.
2. Use **Inputs → Comparison & exposure** for case identity, configuration, axis, profile references, dwell interpretation, sweep and random exposure. Table editors accept pasted rows. Dialog edits apply only after validation.
3. Use **Analysis → Scenario & method settings** for b/Q lists, scope, target, peak model, frequency range and inspection frequency. All combinations are evaluated. b=4,6,8 and Q=5,10,20 are illustrative screening values, not material or damping recommendations.
4. Run the active case or all included cases. Worker computation keeps the interface responsive; cancellation discards only the incomplete case. Earlier completed cases remain available.
5. Inspect requirement plots first, then the fatigue and peak pairs. **Selected b / Q** chooses one pair for the source spectra and coverage curves. **Coverage display** can instead shade the pointwise minimum–maximum coverage across all calculated pairs, with the selected pair overlaid. This is a scenario range, not a confidence interval. Raw fatigue indices remain specific to one exponent. **Scenario comparison → Summary** switches between overall assessed minima and one calculated frequency; use its dropdown or slider (release to update). The selector contains only assessed frequencies, including only listed modes when that scope is active. **Heatmap** selects fatigue or peak coverage. The selected cell is outlined. A heatmap cell selects a scenario. Columns compare minima by Q at the selected b. The heatmap color scale defaults to 0–2 with saturation above 2; numeric labels retain the actual coverage. Edit color limits to explore other ranges.
6. Every plot has Axes, Fit, Expand, SVG and PNG controls. Wheel/box zoom and toolbar pan are available. Frequency linking applies to each source/coverage pair. Axis ranges, scenario selection, summary frequency/metric and coverage display are saved with the study. Changing coverage display refits its vertical axes; changing summary frequency refits the bar chart vertically. Saved frequency selections snap to the nearest assessed calculated point after input changes, without interpolation. Zoom does not change assessment scope, minima or CSV data.
7. Save study JSON before closing. Reopening restores inputs, references and views; results are recalculated with the released engine. Up to 30 cases, 120 library profiles and 72 b × Q scenarios per case are supported.
8. Use **Export → Report & export selection** to choose cases and either one selected scenario per case or all scenarios. Requirement plots are always included. One summary plus four slides per scenario gives 29 slides for seven selected cases. Reports use an input/view snapshot; all selected results must be current. Exact inputs, full names, assumptions and provenance are in slide notes. HTML and PowerPoint inherit the case’s summary frequency/metric and coverage display, with explanatory labels. Headline takeaways and summary CSV always retain overall minima over assessed frequencies. Long visible labels may be shortened with an ellipsis for readability.

**Help → Technical README** provides the method, sources and worked example. The example adds a new case without replacing existing cases. The original application remains a separate downloadable file.

## Excel input contract

`../vibration_spectra_template.xlsx` includes three examples: two random specifications sharing one sine profile, and a different sine/random pairing. Data sheets use one header row and literal values. Formulas are rejected rather than relying on cached workbook results.

- **Profiles:** unique `profile_id`, `kind` (`sine`/`random`), `name`, `revision`.
- **Sine:** profile ID, low/high Hz, unit code, low/high level. Ordered, contiguous segments per profile.
- **Random:** profile ID, frequency Hz, one-sided PSD in g²/Hz. Strictly increasing frequencies per profile.
- **Cases:** unique case ID, name, sine/random profile IDs, comma-separated b/Q lists, inclusion flag.
- **Settings:** case ID, setting key, value. Defaults and units are listed in Instructions; review any omitted setting's default.
- **Dwells:** case ID, Hz, peak-g override, hour cap, cycle cap, repeats. Zero override uses the sine profile. Zero cap disables that cap. Ignored during assumed-resonance analysis.

Import validates identifiers, units, values, profiles and full cases before presenting an atomic replacement preview. Files over 20 MB or worksheets over 10,000 rows are rejected. Import errors identify the sheet/row directly for structural errors and the owning case plus referenced sheets for physics validation. JSON schemas `vdc-case-1` and `vdc-study-1` migrate into `vdc-workbench-1`; missing legacy peak mode means fixed k, not the new extreme default.

## Source organization

- `model.js`: validated study schema, migration and Cartesian scenario execution.
- `app.js` / `workbench.template.html`: menu/dialog workspace and view state.
- `plots.js`: shared Plotly definitions and exported figures.
- `excel.js`: workbook schema, parser and example rows.
- `exports.js`: CSV, HTML and offline PowerPoint reports.
- `method.html`: editable textbook-style method discussion, embedded and published standalone by the build.
- `../engine.js`: audited calculation engine. Optional per-oscillator caching reuses integration across b; original calls remain compatible.

Cache lifetime is one frequency/Q evaluation, so data cannot leak between cases. A worker builds rows for all requested exponents and calls the existing analysis summary with its implicit sensitivity loop disabled. Peak values are independent of b. Integration refinement is checked separately at the governing fatigue and peak frequencies. The interface does not treat bank-frequency sampling as continuous minimization.

## Build and verification

From `Vibration-Damage-Comparison`:

```text
node workbench/build.mjs
node workbench/test_model.cjs
node workbench/test_resolution.cjs
python workbench/validate_histories.py
node workbench/test_browser.mjs
powershell -NoProfile -File workbench/render_powerpoint.ps1
powershell -NoProfile -File workbench/test_excel.ps1
```

The model test creates simulation fixtures under ignored `_paper_build/workbench`. The history script records reproducible ensemble results in `history-validation.json`; the resolution test records `resolution-validation.json`. Browser tests need Playwright and JSZip, resolved through `NODE_PATH` when using the bundled development runtime. `CHROMIUM_PATH` can select the browser executable. PowerPoint rendering is an optional Windows integration check requiring installed PowerPoint; it closes only the generated deck it opened.

Run the original engine, reporting, extreme-response and independent SciPy tests after engine changes. The existing browser/collection/peak suites protect original-interface compatibility. A normal workbench build does not overwrite the original standalone HTML.

To rebuild the workbook, set `RUNTIME_NODE_MODULES` to the bundled artifact runtime's `node_modules` directory and run `workbench/build-template.mjs` with the bundled Node executable, then rebuild the application. That development dependency is not needed by end users. Preview images and the inspect sidecar are development artifacts, not deliverables.

Research scope, method decisions and tolerances are in [the research record](../WORKBENCH_RESEARCH.md). Verification outcomes and physical-model limitations are in [the validation record](../WORKBENCH_VALIDATION.md). Numerical agreement is not experimental hardware validation or a formal approval.
