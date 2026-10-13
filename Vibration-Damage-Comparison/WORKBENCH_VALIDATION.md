# Workbench verification record

Release: workbench 3.0.0, calculation engine 2.2.0. Review date: 2026-10-12.

## Numerical verification

| Check | Outcome |
|---|---|
| Original engine suite | All 25 groups pass, including unit conversions, analytical dwells, amplitude/duration scaling, sweeps, assumed-resonance independence and published fatigue regressions. |
| Independent SciPy integration | All 96 cases pass; maximum moment/sweep/dwell relative discrepancy 6.43e-12. Independent Dirlik PDF integration agrees within 1e-6. |
| Existing report and extreme-response suites | Pass: paired-curve identities, normalization, displacement conversion, published rounded peak benchmark, tail arithmetic, legacy fixed-k behavior and unchanged fatigue. |
| Cached Cartesian scenarios | Nine b × Q cases, including sweeps, agree with uncached calculations at 1e-10 relative tolerance. Peak response is identical across b at fixed Q. |
| Frequency-bank refinement | Nine illustrative scenarios, b=4/8/12 and Q=5/50/100, compared at 24 and 48 points/octave. Maximum change in minimum fatigue coverage 0.1618%; peak coverage 0.00271%. See [full results](workbench/resolution-validation.json). |
| Simulation / rainflow comparison | Two Gaussian profiles, 32 histories of 120 s each, b=4 and 6, seeded reproducibly. RMS discrepancies below 0.3%; mean rainflow damage differs by 0.6–3.6% from Dirlik. See [ensemble results and uncertainty](workbench/history-validation.json). |

The history test's preselected acceptance criterion was 5% for RMS and max(35%, four ensemble standard errors) for expected damage in these two profiles. This is a model comparison, not a universal accuracy claim. The separate quadrature and algebraic checks use much tighter tolerances because they compare deterministic quantities.

The additional peak experiment uses 600 independent synthesized 5 s histories per profile. For the narrowband profile, the nominal 50% peak estimate produced 85.5% observed non-exceedance (95% Wilson interval 82.5–88.1%). For the broader profile it produced 56.5% (52.5–60.4%). Nominal 99% produced 99.67% (98.79–99.91%) and 99.33% (98.30–99.74%) respectively. These finite, sampled experiments do not precisely calibrate the high-probability tail. They demonstrate why the model must be described as approximate even when the 100-cycle guard is satisfied. The README includes this result; there is no claim that matching a published equation establishes an exact event probability.

## Study and browser verification

The standalone file was exercised in headless desktop Edge at 1600 × 1000. Tests cover:

- All Cartesian combinations and worker cancellation; incomplete cases are not published.
- Default requirement plots and all eleven charts, with source/coverage pairs.
- Wheel zoom, box zoom, pan, numeric/log axis limits, fit, expand/restore, linked pair axes, and category/color limits.
- Heatmap cell selection and persisted b/Q selection and view settings in downloaded study JSON.
- Overall/frequency-specific summaries, fatigue/peak heatmap switching, exact row agreement, frequency dropdown and keyboard-operated slider, with unchanged headline minima. Listed-mode frequency filtering, display validation and saved-display round trips are covered.
- Coverage envelopes agree with the pointwise minimum/maximum across all scenarios; the selected curve updates with b/Q. Frequency-specific and envelope choices propagate into report figures, HTML labels and PowerPoint notes.
- Unchanged governing results after viewport edits.
- Shared-profile invalidation and independent exposure settings.
- Actual Excel template import and preview, malformed inputs, duplicate keys, formula rejection, numeric validation and missing references.
- Legacy JSON import from the new default extreme mode, preserving the original selected-k model.
- A seven-case study with both shared and different profiles, 63 scenarios, and mixed peak models.
- Individual SVG/PNG, full numerical CSV, summary CSV, HTML report and 29-slide PowerPoint export.
- Technical README search, linked references and the calculated worked-example loader.
- No runtime errors or HTTP requests during offline operation.

The original browser, collection and peak suites also pass. The original standalone application is unchanged; the calculation engine retains its original call behavior while exposing optional caching and supplied-row analysis for the workbench.

## Artifact review

All seven template worksheets were rendered and visually inspected. Typed values and the three example comparisons were read back through the actual application importer. Desktop Excel also opened the delivered workbook read-only and confirmed seven sheets, retained numeric inputs, and all four dropdown types. The workbook uses list dropdowns for kinds, unit codes, inclusion and settings; the long setting list references cells rather than exceeding the inline Excel validation-list limit. Template creation includes recalculation and an error scan with no matches.

The seven-case PowerPoint opens in desktop PowerPoint and all 29 slides render at 1600 × 900. All shapes are within slide bounds. Representative summary, requirements, fatigue, peak and scenario slides were inspected visually, including scenario envelopes and frequency-specific summary charts. Chart labels were enlarged and titles separated from legends following this review. Full input and model provenance is retained in speaker notes; long visible names may be abbreviated with an ellipsis. Plots honor saved axis limits, so a cropped view does not restrict the separately reported assessment scope.

Generated test decks, screenshots and import fixtures are under ignored `_paper_build/workbench`. The template and standalone workbench are committed deliverables. The HTML technical reference is generated from the same source embedded in the application.

## Limits of this release

No hardware measurements, stress transfer functions or component fatigue data were supplied for experimental validation. The tool remains a relative linear-oscillator exposure comparison. Mean stress, nonlinearities, multiaxial interaction, nonstationarity, non-Gaussianity, endurance limits and consumed-life assessment are outside its calculation scope. Integration and grid checks cannot bound those physical/model errors.

The ERS option is explicitly the approximate Irvine Rev H method with nominal per-oscillator probability, not an exact joint confidence bound. Sweep and dwell results assume quasi-steady/steady response, subject to their transient-review warnings. Sampling the bank does not prove coverage at every continuous frequency.

Reproduction commands and environment requirements are documented in [the workbench README](workbench/README.md); equation decisions and source traceability are in [the research review](WORKBENCH_RESEARCH.md).
