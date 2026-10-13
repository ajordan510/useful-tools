# Workbench method review

Review date: 2026-10-12. This review precedes workbench implementation. The existing v2.2 calculation remains the baseline. The workbench changes scenario execution and presentation; it does not silently replace the fatigue or peak equations.

## Findings and decisions

1. Retain linear base-excited SDOF relative displacement, not absolute acceleration, as the common stress proxy. Full transfer-function integration is appropriate for sloping and notched PSDs; the flat-spectrum Miles approximation is not substituted.
2. Retain amplitude-based power-law fatigue and linear accumulation. The normalization length is arbitrary and cancels only within the same exponent and stress mapping. Raw indices across different exponents are not comparable. A matrix of b and Q is sensitivity, not a probability distribution.
3. Retain Dirlik as an empirical stationary Gaussian estimate and narrowband as a diagnostic alternative. Neither a small cross-method difference nor a numerical benchmark establishes applicability to hardware. Broadband/multimodal response, high exponents, mean stress, joints, and non-Gaussianity require particular attention.
4. Retain steady dwells and quasi-steady sweeps with existing transient-review indicators. Unknown-resonance screening remains independent per oscillator. Do not combine hypothetical dwells or divide one allowance among them.
5. Retain Irvine Revision H equation (4) as the explicitly named approximate extreme model, rather than describe it as an exact quantile. ECSS section 12.5.3.2.4 gives the independent-Rayleigh URS expression without Irvine's correction. Algebraically the implemented factor is that expression times (1 + 0.5772 / (2 ln N)). These are distinct models, not independently identical derivations. The source itself identifies damping dependence and remaining experimental uncertainty. Keep fixed k and exact legacy behavior. New studies select the approximate extreme model by default.
6. Use response zero-upcrossing rate, not automatically oscillator natural frequency. Moments in this implementation use Hz powers; ECSS uses angular-frequency powers. Therefore no additional 1/(2 pi) belongs in sqrt(m2/m0) here.
7. A high non-exceedance probability raises the random denominator and makes the proposed sine-over-random coverage test harder to satisfy. Reversing the test/requirement roles changes the direction of conservatism. Probability is per oscillator/event, not joint across the frequency bank. The 100-cycle cutoff and bandwidth alpha=0.9 flag are implementation review guards, not validated accuracy bounds.
8. Inputs must preserve configuration, axis, exposure, revisions, boundary choices and rationale for b, Q, k/probability and targets. Example values are illustrative. A numerical result cannot establish achieved historical exposure.

## Equation traceability and checks

| Calculation | Primary basis | Independent check / acceptance |
|---|---|---|
| SDOF relative displacement FRF and Q=1/(2 zeta) | Irvine Rev H Appendix B; ordinary linear dynamics | Resonance and low/high-frequency limits; 1e-10 relative algebraic checks |
| Dwell cycles and power-law accumulation | Direct harmonic cycle accounting; fatigue power law | Time/cycle-cap analytic examples; amplitude^b and duration scaling, 1e-10 |
| Sweep damage integral | Cycle rate f times dwell-time density | Independent quadrature; governing integration refinement review at 0.5% |
| PSD response and Hz spectral moments | ECSS 12.5.3.2, converted consistently from angular moments | Existing independent SciPy 96-case suite, tolerance 1e-6 |
| Dirlik expected damage | Dirlik & Benasciutti 2021; Zorman et al. 2023; pinned FLife implementation | Existing PDF integration and published regression; cached/uncached equality 1e-10 |
| Narrowband damage | Rayleigh amplitude moment and zero-upcrossing rate | Analytical gamma moment; synthesized narrowband histories, finite-record uncertainty reported |
| Peak estimate | Irvine Rev H eq (4), compared with ECSS URS | Published rounded k=5.34 example; corrected-Rayleigh inverse, stable tail arithmetic; simulated event maxima reported without asserting exact p calibration |
| Scenario minima and plotting | Cartesian scenario definition; assessment scope | Compare every scenario with baseline, no view-dependent assessment; b-independent peaks |
| Frequency resolution | Sampled oscillator-bank analysis | Double-density comparison; report shifts in minima and frequencies, not exact crossings |

## Input assumption register

| Input | Required meaning / evidence |
|---|---|
| Sine segment units | Peak, RMS or double amplitude explicitly identified; endpoint interpolation in the supplied unit |
| PSD | One-sided acceleration density in g²/Hz; strictly increasing positive frequencies; zero outside supplied band |
| Exposure | Actual/assumed credited dwell caps, repeats and sweep traversals; total random time includes repetitions |
| b | Positive amplitude-law exponent; same law for both exposures; material/detail-specific evidence or screening rationale |
| Q | Linear viscous damping at the amplitude/configuration of interest; same oscillator in both exposures |
| Peak p or k | Per-event/per-oscillator assumption and reason for selection; no automatic reliability interpretation |
| Target F | Required relative damage factor, separate from physical input scaling |
| Scope | Full sampled bank or only listed known modes; zoom never changes this |

## Research sources

- [Dirlik and Benasciutti, 2021, review by the method authors](https://doi.org/10.3390/met11091333), especially spectral definitions and Dirlik formulation. Empirical scope and limitations reviewed.
- [Zorman, Slavič and Boltežar, 2023, spectral-method review](https://doi.org/10.1016/j.ymssp.2023.110149); [author-hosted full text](https://www.ladisk.si/data/pdf/Vibration%20fatigue%20by%20spectral%20methods-A%20review%20with%20open-source%20support.pdf). Broadband and rainflow validation framework.
- [FLife source pinned for existing regression](https://github.com/ladisk/FLife/tree/f39ba53d608b3338b16c9ebb5bd52c86635898b0). Implementation cross-check, not independent physical validation.
- [Irvine, Peak Response to Random Vibration, Revision H, 2020](https://www.vibrationdata.com/tutorials2/peak_response_random_revisionH.pdf), equations (1)–(4), Table 4, conclusions, Appendices B and C. Full text reviewed.
- [ECSS-E-HB-32-25A, 14 July 2015](https://ecss.nl/wp-content/uploads/2015/07/ECSS-E-HB-32-25A%2814July2015%29.pdf), sections 12.5.3.2.2–12.5.3.3, printed pages 254–258. Full PDF retrieved and those sections inspected. Guidance is not treated as automatic certification or as a sine-specific validation.
- [pyYeti fatigue damage equivalent PSD documentation](https://pyyeti.readthedocs.io/en/stable/modules/fdepsd.html). Cross-check of oscillator-bank concept; its response options and equivalence formulas are not substituted for this implementation.

The wider environmental-criteria review also checked the 2001 dynamic environmental criteria handbook, section 7.1.2, for dependence of fatigue exponent on material, geometry, mean stress and environment. That historical guidance does not justify universal material presets. Agency-specific material is excluded from the shipped workbench and its embedded reference discussion as requested.

## Gate outcome

Proceed with the documented baseline and explicit limits above. No claim of formal approval or exact event-probability calibration is supported. Execute the listed numerical, simulation, browser and artifact checks before release; record outcomes in WORKBENCH_VALIDATION.md.
