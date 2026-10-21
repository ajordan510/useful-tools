# Research and evidence register

Research date: **20 October 2026**. Scope: structural shock from aerospace separation, release, and impact events, its transmission to equipment, and verification of component environments.

## Research conclusion

There is no defensible universal mapping from device type, distance, and joint count to component shock. Those inputs support preliminary estimates when tied to an applicable empirical database. A useful tool should make those estimates inspectable and give the analyst a path to measured-response and physics-based methods as evidence matures.

The literature also separates three difficult problems: describing the source on its actual mounting structure, propagating that excitation, and interpreting the environment at a susceptible component. Improving only the propagation solver does not resolve an unknown source or an inadequate component model.

## Review method and limits

Searches covered NASA standards and NTRS, ECSS, Sandia/OSTI, original research publications, and authors' technical releases. Full documents were downloaded when available; relevant sections were read rather than treating search summaries as verified numerical methods. The ECSS point-source chart and the finite-energy forcing-function equations were also visually inspected because extracted PDF equations were unreliable.

This is a focused technical review, not a systematic-review claim of exhaustive coverage. No flight dataset was analyzed, no proprietary attenuation library was obtained, and no predictive accuracy was independently demonstrated. Large ShockSat archives were located but not downloaded. Commercial standards were not purchased. Publication dates below refer to the document itself; search-engine crawl/upload dates were not treated as publication dates.

Repository documents are original recommendations and synthesis. Source findings below are deliberately concise; consult the linked documents before implementing their numerical methods.

## Findings that change the tool design

| Finding | Consequence | Evidence |
|---|---|---|
| Legacy attenuation estimates remain useful but depend on structural context | Versioned, selectable screening methods with applicability checks | R01, R02, R07, R09 |
| A source SRS is itself a structural response | Store source fixture, observation location, directions, and loading condition | R05, R06, R10 |
| Line-source forcing is a distinct challenge | Distributed source support and external equivalent-load imports | R10 |
| Non-explosive mechanisms can still generate release and impact shocks | Separate release and secondary-impact events in the source model | R11 |
| SRS filtering has numerical and peak-detection subtleties | Independent oscillator-kernel verification and bandwidth controls | R12, R13 |
| Test compatibility includes waveform characteristics | Retain time histories, duration, and measurement quality alongside SRS | R03, R04, R12 |
| Composite behavior is construction dependent | No generic metal-to-composite attenuation multiplier | R08 |
| Open benchmark infrastructure exists | Validate against held-out physical events and locations | R07, R18 |

## Source register

### R01

**Kacena, McGrath, and Rader, _Aerospace Systems Pyrotechnic Shock Data, Volume VI: Pyrotechnic Shock Design Guidelines Manual_, Revision A, 1970. NASA-CR-116406.**

- [NTRS record](https://ntrs.nasa.gov/citations/19710008430); [original report](https://ntrs.nasa.gov/api/citations/19710008430/downloads/19710008430.pdf).
- Reviewed: source-environment families and structural transmission guidance; scan text is imperfect.
- Finding: this is historical empirical design guidance, not a source-independent wave solver. Its source classes and attenuation curves are useful as traceable legacy options.
- Tool decision: digitize only individually verified figures, with original axes, units, damping, and applicable structural class. No numerical curves were digitized for this framework.

### R02

**ECSS-E-HB-32-25A, _Mechanical shock design and verification handbook_, 14 July 2015.**

- [Official record](https://ecss.nl/hbstms/ecss-e-hb-32-25a-mechanical-shock-design-and-verification-handbook-14-july-2015-good-one/); [handbook](https://ecss.nl/wp-content/uploads/2015/07/ECSS-E-HB-32-25A%2814July2015%29.pdf).
- Reviewed: selected passages in sections 4, 8.2–8.3, 9, 11, and 12.3, plus the contents of 14/18; especially printed pp. 94–95, 116–124, and 235. This is advisory guidance, not a requirements standard.
- Finding: section 8.3 differentiates point-source, clampband, launcher-interface, unified-path, and instrument treatments. Generic path rules concern the main structure, with explicit cautions about modal response and accumulating joint corrections.
- Implementation implication: preserve each named method and its qualifications. For example, Figure 8-15's ESTEC point-source rule distinguishes plateau and ramp joint counting and caps the count; it is not a universal reduction per joint. Figure coefficients and domain limits require a separate implementation audit.
- Status: listed among active ECSS engineering handbooks when checked.

### R03

**Kolaini, Kinney, and Johnson, _Guidance on Shock Qualification and Acceptance Test Requirements_, SCLV, June 2023.**

- [NTRS record](https://ntrs.nasa.gov/citations/20230009008); [presentation](https://ntrs.nasa.gov/api/citations/20230009008/downloads/Shock-Qual_Acceptance%20SCLV2023_rev2.pdf).
- Reviewed: all 14 slides, particularly 5–8 and 11–14.
- Finding: distinguishes design qualification, workmanship screening, system functionality, and environment validation. Discusses configuration-dependent transmission, shaker limitations, and proposed changes to NASA-STD-7003B.
- Concrete example: slide 5 describes externally induced qualification on nonflight hardware at MPE +3 dB with two shocks per orthogonal axis. This is context-specific; it is not a universal setting for every test category.
- Tool decision: implement versioned requirement profiles and separate magnitude margin, repetitions, and test tolerance. Recommendations for a future revision must not silently become requirements.

### R04

**NASA NESC, _Mentoring the Next Generation of Engineers and Improving Shock Testing Standards_, 2024.**

- [NASA article](https://www.nasa.gov/general/mentoring-the-next-generation-of-engineers-and-improving-shock-testing-standards/).
- Reviewed: section on updating shock qualification and acceptance guidance.
- Finding: reiterates that random-vibration workmanship screening does not establish full high-frequency shock coverage; configuration changes limit reuse of transmission information. It describes proposed tolerance changes as recommendations.
- Tool decision: do not equate a passed random-vibration test with shock qualification. Label the exact scope of test evidence.

### R05

**Kaufman, Majed, Kolaini, Sills, and Henkel, _Applications of Finite Energy Methods to Transient, Random, and Shock Predictions_, SCLV 2022.**

- [Presentation](https://ntrs.nasa.gov/api/citations/20220008193/downloads/SCLV_2022_Finite_Energy_Methods_Rev1.pdf).
- Reviewed: TFE section, slides 12–31; slide 14 equations visually checked.
- Finding: the Transient Finite Energy (TFE) approach constructs an ensemble of forcing functions using synthesized driving-point acceleration and driving-point apparent mass, then uses transfer accelerances to obtain remote responses.
- Tool decision: reserve an impedance-aware synthesis/propagation module. A synthesized history that matches SRS is one admissible realization, not recovered physical phase. Full reproduction needs documented synthesis constraints, matrix conventions, and validation inputs.

### R06

**NASA NESC, _New Transient Finite Energy Shock Prediction Methodology_, 27 April 2023; Technical Bulletin 23-03.**

- [NASA technical overview](https://www.nasa.gov/centers-and-facilities/nesc/new-transient-finite-energy-shock-prediction-methodology/).
- Reviewed: complete public overview.
- Finding: describes analysis-based and test-based TFE workflows and reports comparison with tests using dynamic uncertainty factors. Those reported factors do not establish a transferable uncertainty bound for a new vehicle.
- Tool decision: keep source identification, transfer response, synthesized realization spread, and residual model discrepancy separately visible. Do not advertise a TFE module as NASA-validated merely because its architecture resembles this method.

### R07

**NASA NESC Academy, _ShockSat_ project and released materials.**

- [Project](https://nescacademy.nasa.gov/workshops/ShockSat).
- Reviewed: objectives, structure, test types, and release description.
- Finding: a spacecraft-like testbed was created specifically to advance shock prediction. NASA identifies shortcomings in legacy distance/joint approaches and provides model and test resources spanning hammer and pyrotechnic excitation.
- Tool decision: use ShockSat as a benchmark family; freeze the configuration and withhold events and locations before fitting a model. Publication of data alone is not proof that a new algorithm works.

### R08

**Gentz et al., _Empirical Model Development for Predicting Shock Response on Composite Materials Subjected to Pyroshock Loading_, NASA/TM-2015-218781, Volume I, July 2015.**

- [NTRS record](https://ntrs.nasa.gov/citations/20150017050); [report](https://ntrs.nasa.gov/api/citations/20150017050/downloads/20150017050.pdf).
- Reviewed: test configuration, processing, and findings/recommendations, especially report pp. 118–120 (PDF pp. 122–124).
- Finding: tested sandwich and monolithic constructions differed in shock attenuation; boundary reflections affected observations. Some variables were not statistically significant within this particular campaign, which does not establish their irrelevance in every composite structure. The report calls for more flight-like characterization and review of data quality.
- Tool decision: retain layup, thickness, core, boundary conditions, sensor placement, and test family. Neither charge loading nor material label alone is a reliable universal source/attenuation scaling parameter.

### R09

**Lee, Babuška, and Soine, _Perspectives on Pyroshock Attenuation in Cylindrical Space Structures with a Bulkhead_, SAND2020-13482C; AIAA SciTech 2021, paper 2021-1616.**

- [Sandia paper through OSTI](https://www.osti.gov/servlets/purl/1835010).
- Reviewed: computational setup, SRS/structural-intensity comparison, and conclusions on p. 14.
- Finding: attenuation depends on the structural feature and on how SRS attenuation is summarized. Structural intensity helps distinguish energy diversion from simple loss. The reported bulkhead reductions belong to that simulated geometry.
- Tool decision: show frequency-resolved ratios and structural configuration; do not convert a dramatic case-study reduction into a universal bulkhead factor.

### R10

**Gorfain, _Hydrocode-Explicit Dynamics Prediction of NASA ShockSat Frangible Joint Shock Environments_, SCLV, 2 June 2026.**

- [Author's publication page](https://quartus.com/resource-type/presentation/hydrocode-explicit-dynamics-prediction/); [presentation](https://quartus.com/wp-content/uploads/2026/06/SCLV2026_Joshua_Gorfain_Quartus_ShockSat_FJ_FEA_final.pdf).
- Reviewed: all 18 slides; source/structure separation, varied test outcomes, response comparisons, and limitations.
- Finding: demonstrates an external source-model-to-structural-model workflow for distributed frangible-joint loading. Comparisons include source and configuration variability; the study does not establish generic forcing functions for all line devices.
- Tool decision: provide a distributed equivalent-load import contract and preserve source-model provenance. An LSC and a frangible joint can share geometric support without sharing the same source physics or calibration.

### R11

**Gorfain, _Characterization and Insights on the Shock Environment Induced by a Micro Release Nut Actuator_, 2025.**

- [Author's page](https://quartus.com/resource-type/presentation/characterization-and-insights-on-the-shock-environment/); [paper](https://quartus.com/wp-content/uploads/2025/11/JGorfain_ATS2025_uHDRM.pdf).
- Reviewed: experimental configurations, release versus impact observations, and conclusions.
- Finding: a non-explosive SMA hold-down release mechanism still produces configuration-sensitive shock, with release and subsequent impact contributing separately.
- Tool decision: source events need mechanism state, preload metadata, and secondary-contact timing. “Non-explosive” must not imply a zero-shock source.

### R12

**Smallwood, _An Improved Recursive Formula for Calculating Shock Response Spectra_, Shock and Vibration Bulletin 51(2), 211–217, 1981.**

- [Original paper, public mirror](https://www.vibrationdata.com/tutorials_alt/DS_SRS1.pdf).
- Reviewed: absolute-acceleration and relative-displacement models, ramp-invariant formulation, low-frequency numerical conditioning, and residual response discussion.
- Finding: an established foundation for digital SRS computation. Filter accuracy, sampled peak detection, and input measurement bandwidth are different questions.
- Tool decision: independently verify the production oscillator filter, preserve the ringdown, and avoid implying that a mathematically calculable high-frequency SRS certifies unmeasured high-frequency input.

### R13

**ISO 18431-4:2007, _Mechanical vibration and shock — Signal processing — Part 4: Shock-response spectrum analysis_.**

- [Official ISO record](https://www.iso.org/standard/35833.html?browse=ics).
- Reviewed: metadata, scope, and lifecycle only; paid normative text was not obtained.
- Finding: digital SRS computation is the stated subject. The official record lists confirmation in July 2026.
- Tool decision: use as a standards-conformance audit target after obtaining the applicable text. No claim of ISO compliance is made here.

### R14

**GSFC-STD-7000B, _General Environmental Verification Standard (GEVS) for GSFC Flight Programs and Projects_, 28 April 2021.**

- [Official record](https://standards.nasa.gov/standard/GSFC/GSFC-STD-7000).
- Reviewed: current record and applicability, not a clause-by-clause shock implementation audit. Record shows version B active, with administrative extension.
- Tool decision: support a distinct GSFC project profile. Do not treat GEVS as a generic replacement for project requirements or NASA-STD-7003.

### R15

**_Pyroshock Response Prediction of Spacecraft Structure in Wide Frequency Domain Based on Acceleration FRF_, Aerospace 9(2), 54, 2022.**

- [Original research article](https://www.mdpi.com/2226-4310/9/2/54); DOI 10.3390/aerospace9020054.
- Reviewed: indexed publisher passages on method taxonomy; direct full-page access was rate-limited.
- Finding used: evidence of active FRF-based research alongside empirical, explicit, TSEA, and virtual-mode approaches.
- Limitation: no numerical performance claim or implementation coefficients are taken from this article.

### R16

**Lee and Henricks, _Pyroshock Analysis and Test of Composite Satellite Structure_, DGLR/AIAA Aeroacoustics Conference, 1992.**

- [Publisher's conference record](https://publikationen.dglr.de/?tx_dglrpublications_pi1%5Bdocument_id%5D=51703111).
- Reviewed: original abstract only.
- Finding: transient statistical-energy and signal-envelope approaches have a long research history, including comparison to a composite satellite test.
- Tool decision: retain an energy-method integration tier, but do not treat band energy as an SRS without a documented transient reconstruction/peak model.

### R17

**Bateman and Brown, _In-Axis and Cross-Axis Accelerometer Response in Shock Environments_, Sandia, 1999.**

- [Original conference paper through OSTI](https://www.osti.gov/servlets/purl/4277).
- Reviewed: abstract and description of sensor characterization.
- Finding: cross-axis response, mounting strain, and cable response are relevant measurement concerns.
- Tool decision: make sensor and acquisition metadata first-class evidence; an extreme measured peak is not automatically a valid structural response.

### R18

**NASA ShockSat1 public file browser, accessed 20 October 2026.**

- [Dataset inventory](https://nescacademy.nasa.gov/workshops/ShockSat/ShockSat1).
- Reviewed: archive listing only. It includes instrumentation/test log, FEM/CAD, impact, parametric, point-source, and frangible-joint packages. Several archives are gigabytes in size.
- Tool decision: acquire a documented subset first, with manifest and channel mapping. Distinguish “located” from “downloaded,” “parsed,” and “independently reproduced.”

## Recent literature located but not used to claim accuracy

The 2026 Journal of Spacecraft and Rockets ShockSat papers are relevant follow-up reading. Publisher access returned HTTP 403 for the attempted TFE and hybrid papers. Their metadata were located, but their full validation details were not reviewed, so this framework does not rely on their reported accuracy:

- Kaufman and Majed, [TFE validation, DOI 10.2514/1.A36550](https://doi.org/10.2514/1.A36550).
- Gorfain, [explicit dynamics, DOI 10.2514/1.A36535](https://doi.org/10.2514/1.A36535).
- Van Damme and Yang, [transient hybrid FE/SEA, DOI 10.2514/1.A36586](https://doi.org/10.2514/1.A36586).
- Yunis and Yunis, [ShockSat testbed, DOI 10.2514/1.A36538](https://doi.org/10.2514/1.A36538).

R10 supplies directly reviewed 2026 author material. R05–R07 and R18 provide accessible NASA material for the proposed architecture and benchmark plan.

## Standards/access gaps to close before implementation

1. **NASA-STD-7003B:** official NASA 2023/2024 material above identifies revision B, dated 11 June 2020. The [standard landing page](https://standards.nasa.gov/standard/nasa/nasa-std-7003) returned 403 and the attempted direct PDF was unavailable. Its current revision/status and complete clauses were **not independently verified**. Obtain the controlled copy before shipping a named compliance profile.
2. **NASA-HDBK-7005:** historical attenuation guidance is discussed by R09, but the official handbook endpoint was inaccessible. Obtain the controlled edition before implementing its specific figures.
3. **MIL-STD-810 Method 517:** related legacy methods appear in the reviewed literature. No current controlled military-standard text was retrieved; do not label the proposed tool compliant with a particular current revision.
4. **IEST and ISO:** acquire applicable licensed texts if their exact processing/test requirements are to be implemented.
5. **Source library:** no broadly validated open library of fixture-independent source waveforms was identified. Begin with user-owned measured data and labeled heritage examples, not invented default levels.
6. **TFE and recent hybrid methods:** obtain the detailed method and benchmark inputs before presenting an implementation as a reproduction of the published technique.

These gaps limit standards automation and numerical model release. They do not prevent building the evidence library, SRS processor, comparison workflow, or interfaces specified in the accompanying framework.
