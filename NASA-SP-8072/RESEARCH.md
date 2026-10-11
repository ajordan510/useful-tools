# Research and implementation basis

Research date: 2026-10-11. Application: Rocket Acoustics Workbench 1.0.0.

## Research question and evidence

The objective is a browser-based, inspectable implementation of SP-8072 with useful later research options. It is not defensible to label every modification as more accurate for every rocket. Evidence is divided into equations, empirical datasets, configuration-specific findings and independent verification opportunities.

| Source | Material reviewed | Implication for this tool |
|---|---|---|
| Eldred, NASA SP-8072 (1971) | Original report, Section 4.2 equations, rendered Figures 5, 10–14, discussion of efficiency and clustering | Baseline DSM-I/II equations and digitized curves |
| Haynes & Kenny (2009) | NASA conference paper, equations 1–10, core and deflector discussion, Saturn V comparison figures | Selectable 1.75 core coefficient and idealized core termination; no invented RSRM directivity dataset |
| James et al. (2016) | Published abstract and conclusions in the publisher's record | Evidence against assuming the shorter core is universally better; no inaccessible numerical data inferred |
| Gee (2021) | Primary publication abstract; corroborated by the 2022 review's accessible source excerpts | Warn that the historical axial power distribution inherited a plotting error |
| Lubert, Gee & Tsutsumi (2022) | Accessible indexed passages on axial source distribution and model limitations; full author PDF download redirected to login | Context for limitations; no missing numerical curves fabricated |
| Launcher prediction/mitigation review (2024) | Open publication abstract and scope | CFD, subscale tests and mitigation remain distinct fidelity levels; not reducible to a generic correction |
| Mathews (2025) | Full dissertation Chapter 6 and Appendix B; public MATLAB repository and binary directivity dataset | Implement separately labeled stationary modern components; inspect paper/code discrepancies |
| Perez & Allgood, NASA Stennis (2011) | Full NASA report, Tables 2–4 and validation discussion | Published numerical power check and candidate measured cases; record missing replication inputs |
| Margasahayam & Caimi, Rocket Noise Prediction Program (NTRS 19990040528) | NASA program overview | Historical software context; no complete reusable benchmark identified |

Searches also covered 2025–2026 SP-8072 and rocket-noise prediction literature. The 2025 SATURN dissertation and code were the most recent substantial, accessible implementation materials selected. This is a focused primary-source review, not a claim that every relevant paper has been exhausted. A 2025 conference paper repeating DSM-II was located but was not used for numerical inputs or accuracy claims.

## What changed after SP-8072

1. **Core reference length and fully expanded flow (Varnier, 2001; Haynes–Kenny, 2009).** Haynes–Kenny use 1.75 D(1+0.38M)^2 in place of 3.45 D(1+0.38M)^2, motivated by their flow conditions and supporting CFD. The distinction between potential and supersonic core terminology matters. The app calls the parameter an aerodynamic core reference length.
2. **Core termination at a deflector.** Their modified approach destroys the potential core at impingement and moves the modeled power closer to the vehicle. This tool implements Lc = min(free Lc, distance to bend) and a piecewise straight plume. It does not reconstruct the authors' facility or claim complete Ares I model equivalence.
3. **Motor-specific directivity.** RSRM measurements can improve RSRM predictions. They are not a justified generic replacement for liquid engines, and complete numerical RSRM data were not obtained. The modern option instead uses the released Atlas V dataset with explicit domain limits.
4. **Full-scale core evidence (2016).** James et al.'s comparison supported the original length on an overall-level basis while both formulations had spectral limitations. Core selection remains a sensitivity choice.
5. **Source-distribution provenance (2021).** Gee identified a plotting error propagated into SP-8072 Figure 12, leading to excessive attribution of radiated power to downstream subsonic flow. Correcting a historic unheated nitrogen-jet curve does not independently validate its use for hot rocket plumes. We preserve Figure 12 for transparent legacy comparison, warn about it, and provide a separate measured-location model instead of inventing a corrected rocket distribution.
6. **Modern source spectrum, location and directivity (2025).** SATURN uses an Atlas V-derived spectrum and directivity, a Gee-derived location fit, and empirical loss. These components are accessible and reproducible; they are implemented as a stationary adaptation. Launch trajectories, retarded time, emergence masking and published launch accuracy are outside this implementation.
7. **Propagation and installation physics.** Atmospheric absorption competes with nonlinear spectral transfer. A linear absorption-only correction can misrepresent far-field rocket spectra. The app offers the published empirical loss option with version disclosure; it does not simulate weather, nonlinear waveform propagation, terrain, impingement sources, suppression water or diffraction.

## Exact implementation contract

### Source power and reference levels

Input thrust is per engine in N. Eta is entered in percent. Total acoustic power:

`W = (eta_percent / 100) * N * F * U / 2`.

SP-8072 Eq. 1 uses `0.005 * N * F * U`, corresponding to **1%**, not 0.5%, acoustic efficiency. The default 0.5% gives half that power. The approximation neglects pressure-thrust complications and assumes supplied flow properties are consistent. A nozzle expansion solver is not included.

`Lw = 10 log10(W / 1e-12)`.

The propagation kernel uses `10 log10(4*pi*r*r)` rather than `20 log10(r)+11`; the difference is 0.007901 dB. The SP-8072 standard reference convention corresponds to rho*c near 400 Pa s/m. Ambient c0 is used for DSM-II modified Strouhal scaling only; the tool does not claim an impedance-corrected atmospheric pressure solution.

### Frequency bands and integration

Exact base-10 third-octave centers are `1000 * 10^(k/10)` Hz. Band edges are center times `10^(±0.05)`. Adjacent edges touch. The UI limits select centers, so actual integration edges extend beyond those limits. Every result and export identifies the true edge scope.

Spectral curves are **densities**, not band powers. Each is integrated in linear power across the band, using log-frequency midpoint quadrature (24 subintervals for DSM-I/modern, 16 for each DSM-II slice spectrum). The independent Python references use adaptive or exact piecewise integration instead.

The optional normalization divides densities by their integrated full-range area, approximated over dimensionless frequency 1e-9–1e7. This numerical range captures the modeled tails, not a physical claim of validity at every frequency. It never renormalizes the displayed bands. Raw-area values are approximately 1.22444344 for the digitized Figure 5 density, 0.96563596 for the modern density, and 0.89855618 for Figure 13. Energy normalization removes those calibration offsets while leaving shape intact.

### SP-8072 DSM-I

- Figure 5 density evaluated at Sr = f D/U; dB interpolated linearly in log(Sr).
- Tails: +20 dB/decade below the first point, -20 above the last. Extrapolation is a declared modeling assumption.
- Figure 14 preferred solid curve: source x/D interpolated in log-log coordinates; values held at the endpoints outside Sr 0.0012–1.5. This is the report's preferred curve, including open-scoop data, not a newly established free-plume fit.
- Each band has one source at its center-frequency position. Geometry and directivity are evaluated at the center; the spectral power is integrated over the band.

### SP-8072 DSM-II

- Lc = C D(1+0.38M)^2, C=3.45 or 1.75.
- Integrate the historical Figure 12 over 0.1–5 Lc using evenly spaced midpoint slices, with a cell split at any bend so no slice straddles the tangent discontinuity; truncate outside this domain. If enabled, normalize all slice weights to unit total power.
- At source arc length x, modified Strouhal number is `f*x/(M*c0)`, from `f*x*ae/(U*c0)` and `ae=U/M`.
- Figure 13 density uses +10/-30 dB-per-decade tails, log-frequency/dB interpolation and full-density normalization if selected.
- Source spectra are multiplied by slice power and summed at the receiver in linear mean-square pressure.
- Idealized bend path is (x,0) before the bend, then turns toward +y by the specified angle. Source-to-receiver angle uses the local downstream tangent. Core termination changes the reference core and consequently the spectral scale through actual source distance.
- Default 240 slices; the map uses 60 for responsiveness. Exact receiver results retain the selected slice count. Refinement checks document the numerical residuals.

### Modern stationary components

For z=ln(Sr), normalized spectral density in dB is:

```text
8.686*z + 58.6                      Sr < 0.0036
0.26*z^3 - 15.98*z - 33.88          0.0036 <= Sr <= 0.048
-8.686*z - 19                       Sr > 0.048
```

Small discontinuities from the published rounded coefficients are retained; they are not silently smoothed. Apparent source distance is `9.85*Sr^(-0.21)*D`.

The dataset `DI_v1_SATURN.mat` was converted without rounding from MATLAB v7.3 HDF5 to JSON. Shape: 200 Strouhal values by 91 angles. Linear interpolation is performed in Sr and angle, matching the original code (not log Sr). Angle domain is 0–90 degrees. Out-of-angle point predictions fail; map cells are masked. Sr values are clamped to the actual table endpoints, approximately 0.000639369–15.984235, and warned. This intentionally avoids the released code's unrestricted extrapolation.

Empirical loss in dB follows the pinned MATLAB code:

```text
A(f,r) = -10*[sqrt(r/12000)*log10(1+f/16)
             + (r/3000)^1.5*log10(1+f/8000)]
```

The dissertation prints an 8 Hz first corner and a different description of filter order. The code uses 16 Hz and exponent 1.5 in its second distance factor. This release explicitly follows the code, not a hybrid of the two.

### Directivity, reflection and summation

- Heritage Figure 10: five Sr curves, approximate dB readings every 10 degrees from 20–180 degrees. Linear angle interpolation followed by log(Sr)/dB interpolation; boundaries held outside the table and flagged.
- Omnidirectional diagnostic option: DI=0.
- Reflection is an explicitly selected single constant: 0, 10log10(2) or 20log10(2) dB. No automatic double-counting of hemispherical radiation and pressure doubling.
- Uncorrelated source energies are summed. OASPL is the energy sum of bands. RMS pressure is `20e-6 * 10^(OASPL/20)` Pa.
- A weighting uses the conventional rational frequency weighting evaluated at band centers. It is not an exact within-band weighted integration or a transient exposure metric.
- User allowance changes only design levels and the illustrative ± allowance envelope. It does not change baseline physics or imply a statistical confidence interval.

## Verification cases and what can be reproduced

NASA Stennis Table 3 directly publishes W=10.58 MW and Lw=190.25 dB. Applying the reference-level equation produces 190.244856677 dB; the 0.00514 dB difference is compatible with rounded table inputs. This is a real published numerical checkpoint, but it exercises only one part of the engine.

The Stennis paper also reports measured receiver spectra and predictions. Its near-field case gives a 400 klbf thrust class, M=3.4, U/D=1982 Hz, eta=0.425% and normalized receiver coordinates. It does not fully specify independent U and D, exact deflector geometry and source placement. Its DSM-I setup is explicitly described as ad hoc; far-field custom directivity and water/shielding effects further limit reproduction. A claimed exact match would be misleading.

Haynes–Kenny Saturn V figures and Mathews' Firefly/Starship launch comparisons supply valuable physical evidence but not a complete released input/measurement package for this application. The delivered fixed stationary cases are therefore **independent numerical cross-checks**, not substitutes for flight or static-firing validation.

## References

1. Eldred, K. M. (1971). *Acoustic Loads Generated by the Propulsion System*, NASA SP-8072. https://ntrs.nasa.gov/citations/19710023719
2. Varnier, J. (2001). *Experimental Study and Simulation of Rocket Engine Freejet Noise*. AIAA Journal 39(10). https://doi.org/10.2514/2.1199 (relationship reviewed through Haynes–Kenny).
3. Haynes, J., and Kenny, R. J. (2009). *Modifications to the NASA SP-8072 Distributed Source Method II for Ares I Lift-off Environment Predictions*. https://ntrs.nasa.gov/citations/20090023640
4. James, M. M., Salton, A. R., Gee, K. L., and Neilsen, T. B. (2016). *Comparative Analysis of NASA SP-8072's Core Length with Full-Scale Rocket Data*. https://doi.org/10.2322/tastj.14.Po_2_17
5. Gee, K. L. (2021). *A tale of two curves and their influence on rocket and supersonic jet noise research*. JASA 149, 2159–2162. https://doi.org/10.1121/10.0003938
6. Lubert, C. P., Gee, K. L., and Tsutsumi, S. (2022). *Supersonic jet noise from launch vehicles: 50 years since NASA SP-8072*. https://doi.org/10.1121/10.0009160
7. *Review of launcher lift-off noise prediction and mitigation* (2024). Results in Engineering 23, 102679. https://doi.org/10.1016/j.rineng.2024.102679
8. Mathews, L. T. (2025). *Acoustic Characterization and Modeling of Heated Supersonic Tactical Jet Aircraft and Launched Rockets*. Dissertation, Chapter 6 and Appendix B. https://scholarsarchive.byu.edu/etd/11034/
9. Mathews, L. T. *SATURN*, code commit `7c6d1c3b38ebb32512f704fb281d7516b73fd9d6`. https://github.com/logmath/saturn/tree/7c6d1c3b38ebb32512f704fb281d7516b73fd9d6
10. Perez, L., and Allgood, D. C. (2011). *Prediction of Acoustic Loads Generated by Propulsion Systems*. https://ntrs.nasa.gov/citations/20110012036
11. Margasahayam, R., and Caimi, R. *Rocket Noise Prediction Program*. https://ntrs.nasa.gov/citations/19990040528
