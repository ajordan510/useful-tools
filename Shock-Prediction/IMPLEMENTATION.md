# Implementation and validation plan

20 October 2026 · proposed work, not executed software validation.

This plan implements the [technical framework](FRAMEWORK.md). Source IDs refer to the [research register](RESEARCH.md). Release gates below are proposed engineering controls; they are not presented as NASA/ECSS requirements.

## 1. Product boundaries and sequence

Build the evidence and comparison foundation before advanced source reconstruction. Keep the complete data model extensible to point, line, ring, and multiple-source inputs from the beginning. A source family can exist in the library without an automatic numerical predictor.

### Phase 0: freeze conventions and assemble the first evidence pack

Deliver:

- Versioned schemas for source evidence, paths, spectra, histories, transfers, components, and analysis runs.
- A method specification for every initial empirical correction, including precise figures/equations, units, frequency/geometry bounds, statistical basis, and permitted factor combinations.
- A controlled standards inventory. Obtain NASA-STD-7003, the applicable project standard, and any licensed normative texts needed for named profiles.
- Small public or user-owned validation inputs, acquisition metadata, redistribution status, hashes, and processing instructions.
- Explicitly illustrative teaching cases, clearly separated from measured validation cases.

Exit gate: each initial computation has an unambiguous input/output contract and a test oracle. No unverified chart coefficients, generic source levels, or implied compliance profiles.

### Phase 1: useful empirical and measurement workbench

Deliver:

- Time-history and SRS import, including CSV and versioned JSON; no mandatory spreadsheet dependency.
- Audited absolute-acceleration SRS, positive/negative/maximax options, residual response, and optional relative-displacement/PVRS metrics from histories.
- Source library with point, line/ring, release, impact, and incoming-interface metadata. Numerical support begins with user-supplied evidence.
- Path editor and receiver/component list, including structural path distance, existing upstream losses, and configuration identity.
- A small number of individually audited empirical methods and user-supplied paired SRS ratios.
- Multiple cases/events/axes, comparison plots, coverage checks, evidence gaps, and an explicit uncertainty/margin ledger.
- Immutable run manifests, case save/load, numerical CSV, and self-contained HTML reporting.

Exit gate: numerical kernels pass the independent verification suite, empirical rules reproduce their audited reference cases, and the app rejects incompatible comparisons. Reports preserve all inputs and qualifications. Physical prediction status remains “screening” until held-out data support stronger claims.

### Phase 2: measured dynamics and reduced-model propagation

Deliver:

- Complex accelerance and prescribed-base transfer imports with typed units/DOFs and frame transforms.
- Waveform propagation, input timing, multi-input support, FFT/time-domain consistency, and output SRS.
- Imported modal/reduced FE response workflows and simple mount/isolator models.
- Paired measured-versus-predicted validation dashboards and sensitivity to source, damping, timing, and mount properties.
- Optional constrained SRS synthesis for exploring admissible histories, explicitly separate from physical source identification.

Exit gate: complex phase, resonance resolution, damping, source timing, and output peaks agree with independent references; at least one held-out physical benchmark family has a complete report. A fit to the same sensors used for calibration is not an exit test.

### Phase 3: source/structure coupling and distributed inputs

Deliver:

- Distributed point/line/ring force and moment import, with spatial and temporal convergence checks.
- External explicit/implicit FE simulation adapters with configuration/mesh/time-step metadata.
- Impedance-aware source identification/TFE-style research implementation only after published-method reproduction inputs are obtained.
- Source waveform ensembles with repeatable seeds, constraint diagnostics, conditioning metrics, and output uncertainty summaries.
- Coupled receiver loading and nonlinear isolation/contact interfaces where justified.

Exit gate: compare point and distributed-source cases separately; verify source reconstruction and remote response. State which device/structure families are validated. A successful hammer case does not validate a frangible-joint source model.

### Phase 4: broader methods and a reusable evidence library

Deliver:

- External transient SEA/hybrid adapters and documented local-response/SRS recovery.
- Hierarchical source/path statistical models and domain-aware surrogates, if data volume and diversity justify them.
- Validated mitigation studies across representative configurations, temperatures, preloads, and component loading.
- Mature controlled requirement profiles and organization-specific evidence review workflow.

Exit gate: demonstrate held-out configuration performance and calibrated uncertainty. External model integration remains available even if a general in-browser solver is not justified.

## 2. Recommended software structure

```text
Shock-Prediction/
  README.md, FRAMEWORK.md, RESEARCH.md, IMPLEMENTATION.md
  src/                         # future implementation
    core/                      # units, frames, curves, histories, manifests
    response/                  # oscillator filters and metrics
    empirical/                 # audited method implementations
    propagation/               # complex FRF and transient interfaces
    assessment/                # compatibility, coverage, uncertainty, margins
    io/                        # import/export and schema migrations
    ui/                        # source/path/component editors and results
  reference/                   # future reproducible, redistributable small cases
  validation/                  # independent numerical and physical validation
```

The tree describes future files; only the four research/framework documents exist in this delivery. Keep formulas and numerical decisions out of chart components. Plotting must respect validity masks and display missing bands as missing. Case exports should reopen independently of browser local storage. Large simulation jobs belong in worker/external processes with cancellation and progress reporting.

An existing repository SOL111 workflow may supply useful complex frequency-response data, but inspect its actual channels, units, modal bandwidth, and phase convention before reuse. A viewer plot is not sufficient evidence that the underlying data are ready for transient propagation.

## 3. Numerical verification matrix

Use an independent Python reference based on analytical solutions, state-space integration, or direct convolution rather than a line-for-line translation of the production algorithm.

| ID | Check | Required outcome |
|---|---|---|
| N01 | Zero input; scaled input; polarity reversal | Zero response; linear scaling; positive/negative swap with unchanged maximax |
| N02 | Half-sine, rectangular, ramped, and decaying-sinusoid inputs | Agreement with analytical/high-accuracy independent oscillator solutions |
| N03 | Primary versus residual response | Correct maxima when the largest response occurs after the input ends |
| N04 | Low oscillator frequency, high Q, and long decay | Stable calculation and convergence under time-step/ringdown refinement |
| N05 | Absolute SRS versus pseudo-acceleration/PVRS | Exact definitions preserved; no accidental equality assumed |
| N06 | Peak between samples | Peak search/refinement error measured independently from filter error |
| N07 | Damping and frequency grid | Hz/rad/s and Q/zeta consistency; dense-grid comparison near sharp features |
| N08 | g/SI, inch/mm, N/lbf and force density | Unit changes produce identical physical results after conversion |
| N09 | Amplitude dB and percent attenuation | +3 dB = 1.41254 amplitude ratio; 40% reduction = 0.60 remaining |
| N10 | Empirical source-reference distance | Moving from r0 to r uses the chosen curve's relative/absolute convention exactly |
| N11 | Joint counting and factor applicability | Ramp/plateau rules and count caps match the audited method; duplicate effects rejected |
| N12 | Identity and constant-gain dynamic models | Propagation returns original/scaled histories and response metrics |
| N13 | Complex phase and pure delay | Correct time shift with unchanged SRS when the full record is retained |
| N14 | Two-mode/closely spaced-mode model | Independent time and frequency solutions agree, including phase interference |
| N15 | Opposite equal simultaneous responses | Combined history cancels; summing SRS magnitudes is correctly rejected as exact response |
| N16 | FFT normalization and padding | Parseval/round-trip checks; no circular convolution contamination |
| N17 | Coordinate transformation | Rotated histories/matrices agree with independent vector transformation |
| N18 | Distributed source discretization | Segment refinement preserves integrated load and converges response |
| N19 | Isolator transient | Response, travel, and transmitted force match independent dynamics; bottoming invalidates linear result |
| N20 | Statistical tolerance factors | Independent known-factor/reference cases; insufficient data and invalid assumptions flagged |
| N21 | Validity and compatibility | Unsupported frequency, Q, axis, location, or curve type never yields an unqualified pass |
| N22 | Persistence and reporting | Reloaded cases reproduce results/settings; stale outputs cannot be exported as current |

Initial proposed numerical targets: relative error no greater than 1% for non-negligible SRS peaks within the declared processing domain, plus a separately defined absolute tolerance near zero; near-machine precision for simple unit/dB bookkeeping; convergence under time-step, peak-search, and grid refinement. Fix exact test cases and tolerances before implementation. These numerical targets say nothing about the physical prediction error of an empirical or FE model.

## 4. Physical validation campaign

### 4.1 Candidate evidence families

| Family | Purpose | Availability established by this research | Additional work needed |
|---|---|---|---|
| NASA ShockSat impact tests | Complex transfer, propagation, joints and multiple output locations | Public archive inventory and testbed description located (R07/R18) | Acquire subset; verify units, hammer force, channel orientation, model revision and boundaries |
| ShockSat point pyro tests | Source variability and remote environment prediction | Public point-source package listed | Confirm event identities/replicates and available source measurements |
| ShockSat frangible-joint tests | Distributed sources and changed boundary states | Public package listed; 2026 author comparison reviewed (R10) | Distinguish successful/failed/modified events; do not pool unlike configurations |
| NASA composite panel campaign | Construction-specific empirical behavior and reflections | Full report reviewed (R08) | Locate usable raw histories and configuration mapping; published curves alone are insufficient for waveform checks |
| Sandia cylinder/bulkhead study | Structural-feature and energy-flow interpretation | Full computational paper reviewed (R09) | Obtain enough model/source details to reproduce before claiming a numerical benchmark |
| User's flight-like source/mount tests | Intended deployment domain | Not supplied | Establish source/interface acquisition and repeatability campaign |

Do not treat reported agreement in a paper as agreement achieved by this implementation. Store the status of every candidate as `located`, `obtained`, `parsed`, `reproduced`, or `validated application`, with dated evidence.

### 4.2 Split and score honestly

Freeze calibration and held-out sets by **physical event, article, and configuration** before fitting. Separate sensors from the same firing can help test spatial prediction but do not constitute independent source repeats. Where possible include a genuinely new configuration to test extrapolation.

For frequency/axis/location residuals use

\[
e(f)=20\log_{10}\left[S_{pred}(f)/S_{meas}(f)\right].
\]

Predeclare valid bands, exclusion criteria, and aggregation. Report median bias, absolute-error percentiles, worst underprediction and its location/frequency, and the fraction of measured curves covered by the declared environment bound. Use log-frequency weighting if aggregating across frequencies so that a densely sampled band does not dominate by accident.

Also compare histories where available: peak, duration, timing, waveform envelope, ringdown, and relevant displacement/force response. A model that matches SRS while producing implausible duration should not pass a waveform validation claim.

Provisional physical development targets may include “most held-out ordinates within ±6 dB” and a separately controlled underprediction rate, but these must be negotiated for each intended use and sample basis. **Do not use ±6 dB test execution tolerance as proof of prediction accuracy.** Report raw residual distributions and confidence; small samples cannot demonstrate a rare-event tail.

If a source model is calibrated using a sensor, score source reconstruction there separately from remote predictive validation. Record all tuning after looking at held-out results and create a new holdout when needed.

## 5. First data collection priorities

The largest practical asset is likely to be a curated evidence library rather than another uncalibrated attenuation equation. Prioritize:

1. Repeated source/assembly histories with configuration, fixture, axes, and acquisition metadata.
2. Paired source-region and component-interface measurements from the same events.
3. Representative structural and mount transfer data, including loading and boundary conditions.
4. Mounted-component achieved qualification histories/SRS, operating state, and functional outcomes.
5. Configuration differences that commonly invalidate heritage: source location, joints/preload, equipment mass, brackets, composite construction, and release/capture geometry.

Use simultaneous channels where timing and cross-axis information matter. Select acquisition bandwidth and sensor mounting for the intended shock regime; a fixed sample-rate default cannot replace a measurement plan. Maintain the unfiltered records and all rejection decisions.

Start with one point-source family and one distributed-source family on a well-defined structural family. Demonstrate the entire evidence-to-report chain before multiplying the number of selectable models.

## 6. Risks and design responses

| Risk | Consequence | Design response |
|---|---|---|
| Generic source levels look authoritative | False confidence before any representative data exist | Require source evidence; teaching cases visibly labeled |
| Percent/dB or already-included loss confusion | Large hidden prediction error | Typed factors and inclusion ledger |
| SRS/FRF multiplication | Unsupported remote response | Separate empirical and dynamic APIs |
| Source fixture differs from flight structure | Incorrect input despite a good propagation model | Fixture metadata and impedance/configuration assessment |
| Missing mounting/parallel path | Isolation benefit overstated | Loaded receiver model and connectivity review |
| Automatic filtering hides measurement problems | Invalid low-frequency or high-frequency environment | Immutable raw data, processing preview and dispositions |
| Too little independent test evidence | Unjustified tail/confidence claim | Explicit scenarios and visible sample basis |
| Calibration leaks into validation | Optimistic accuracy report | Event/article/configuration holdout rules |
| Numerical solver labeled physically validated | Misleading maturity | Separate numerical verification from physical validation |
| Standards drift or incomplete access | Incorrect qualification profile | Controlled revisions and audited profile release |

## 7. Scope decisions for the initial build

Recommended defaults, subject to the actual intended hardware:

- Offline browser workbench with local case files, following this repository's existing distribution pattern.
- Three-direction metadata from the outset, while allowing a clearly scoped one-axis initial calculation.
- Measured/user-supplied source spectra first; no universal device amplitude library.
- Explicit regime and bandwidth inputs; no near/mid/far classification based on distance alone.
- Empirical methods compared side by side; no automatic averaging of disagreeing methods.
- Interface coverage first; component stress/fragility only through supplied valid models/evidence.
- External FE/SEA integration rather than implementing a general-purpose solver.

The initial project setup should capture whether the intended use is preliminary layout, environment specification, or verification support; the component classes and bands that matter; available test/FE data; and the governing project standard. These are deployment inputs, not prerequisites to completing this research framework.

## 8. Verification status of this delivery

This delivery contains research and design documentation only. The checks appropriate to it are reference/section consistency, local-link integrity, arithmetic and equation review, source-access disclosure, Markdown structure, and Git whitespace review. No future numerical or physical validation result listed above is claimed as completed.
