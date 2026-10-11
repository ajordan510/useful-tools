# Published DSM-II spectrum comparison: Smith (2013)

## Finding and status

A runnable **laboratory-jet reconstruction** was found, but not a clean, independently reproducible full-scale rocket verification case. The comparison is useful evidence of disagreement, not proof of accuracy. The workbench is deliberately left unchanged rather than calibrated to the publication.

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

## Results and secondary audit

For 21 equally weighted band differences, defined as workbench minus published:

- Mean difference: **+11.39 dB**.
- RMS difference: **13.11 dB**.
- Maximum absolute difference: **29.45 dB**, at 100 Hz.
- Seven centers exceed Figure 10's Sr=0.4 boundary; with those excluded, the remaining 14 centers still have **15.51 dB RMS difference**.

`published-comparison-results.json` retains unrounded outputs and diagnostics. Increasing slices from 240 to 960 changes a band by at most **0.000107 dB**. Disabling normalization changes levels by **0.84128 dB**; using 300 K instead of 311 K changes at most **0.15613 dB**. These checks do not explain the published discrepancy.

The independent continuous-plume SciPy integration also runs this physical input case at 960 slices. It checks the documented workbench implementation, not the correctness of the historical empirical curves. Its tolerance is 0.02 dB; actual residuals are in `dsm2-independent-results.json`.

Unresolved issues prevent an acceptance claim:

1. Smith uses different analytical curve fits and Wilby's third directivity. The workbench uses its documented digitized historical curves. Substituting a directivity formula merely to improve agreement would change the model under test.
2. The supplied Appendix D code has a special jet branch that reads `matlab.mat` and interpolates `Proudman_134_x` / `Proudman_134_y_fix` in place of the standard axial source-power formula (printed p. 261 / PDF p. 277). That external data is not supplied with the PDF. It is unclear whether the appended code version generated Chapter 3's Figure 53 or reflects later CFD investigations. Exact code-to-figure provenance cannot be established from the PDF alone.
3. The exact saved small-jet settings, source spacing/support and Figure 53 numeric output are not supplied as a replay package. General vehicle discretization settings should not be silently assigned to this much smaller jet.
4. This air jet is outside standard chemical-rocket velocity conditions. The 14 W power is an adopted empirical input, not an independent acoustic-efficiency validation.
5. Table 10's OASPL covers a broader range than the 100–10,000 Hz overlay. Comparing it directly with the workbench's restricted-band sum would be invalid.

**Disposition: unresolved published-model comparison. No new experimental or full-spectrum accuracy claim.** To close it, obtain the Figure 53 run configuration, numerical spectrum and required source-power data, or a different complete rocket test/replay dataset. No coefficients or offsets have been tuned against this curve.

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

Run `node test_published.cjs`, `python verify_dsm2.py`, and `node test_published_browser.cjs` from the NASA-SP-8072 directory (or use repository-relative paths shown in README). The standalone HTML embeds the fixture and source excerpt. In **Verification & audit**, use **Run published comparison**; **Load case + overlay in calculator** enables ordinary sensitivity work while preserving the published curve as a pinned reference. Dedicated CSV and HTML comparison exports preserve the fixed case independently of subsequent calculator edits.
