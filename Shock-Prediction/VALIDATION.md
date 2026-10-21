# Executed verification — Shock Workbench 1.0

Executed 20 October 2026 (Pacific time; run timestamps are UTC). This document concerns implemented code, not completion of all gates in [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Results

| Check | Executed result |
|---|---|
| Domain/engine regression | 30 checks passed |
| Independent oscillator verification | 64 cases; 640 scalar comparisons passed |
| Maximum maximax SRS relative deviation | 0.396918% |
| Maximum material-metric relative deviation | 0.396918% |
| Mount waveform maximum error / reference peak | 8.92 × 10⁻¹⁵ in the specified smooth example |
| Teaching mount maximum relative travel | 0.808984 mm |
| Teaching mount maximum dynamic force | 2664.736 N for 2 kg |
| Browser workflow | 24 checks passed in Chrome 155 |
| Browser application errors / HTTP requests | 0 / 0 |
| Visual checks | Desktop results, mobile results and isolation plots inspected |

The machine-readable [validation-results.json](validation-results.json) records versions, coverage and code hashes. Rerunning the tests writes detailed comparisons, browser checks, screenshots and downloaded exports to ignored `_qa/` files. Small last-digit differences can occur between platforms.

## Independent numerical oracle

`test_numerical.py` sends specified histories to JavaScript, then independently solves the relative-displacement differential equation using SciPy 1.16.3 `solve_ivp` with DOP853. The oracle uses physical displacement and velocity coordinates, numerical integration and densely sampled extrema. It does not call the engine's transition coefficients, recurrence or analytic-extrema functions.

Four histories are exercised at 20, 100, 800 and 2000 Hz, each with Q = 0.51, 2, 10 and 50:

1. A 100 g, 5 ms half-sine followed by zero input, within a 25 ms record.
2. An exponentially damped combination of 310 Hz and 1400 Hz sinusoids.
3. A three-sample triangular pulse `[0, 100 g, 0]`.
4. A four-sample record `[0, 20 g, 40 g, 60 g]`, followed by an abrupt change to zero input.

All inputs use a 50 µs interval. The forced solve uses relative tolerance 2 × 10⁻¹⁰, absolute tolerance 10⁻¹², and maximum integration step of half the input interval. Response sampling is at least 16 times the input rate and 256 points per highest-frequency oscillator period. Residuals are integrated separately for two damped periods and evaluated at 8193 points with tighter tolerances.

The ten comparisons per oscillator are forced positive/negative acceleration peaks, residual positive/negative peaks, overall positive/negative peaks, maximax acceleration SRS, relative-displacement spectrum, pseudo-velocity and pseudo-acceleration. Acceptance is **1% relative error plus 10⁻⁷ of the relevant response scale**, avoiding meaningless relative-error failures for almost-zero signed tails. Material-metric reporting excludes values below 10⁻⁵ of that scale. Maximum normalized absolute error also remains 0.396918%.

An early 32-points-per-period implementation missed a heavily damped, very short pulse peak by approximately 3.5%. Production now uses at least 64 points per oscillator period and four substeps per input interval. Reported results include that correction. These are finite benchmark results, not a universal error bound across every accepted input.

Mount verification independently solves a 200 Hz, Q=2, 2 kg prescribed-base SDOF system driven by the half-sine. It checks sampled output acceleration and densely evaluated peak displacement and force, including ringdown. Waveform error must be below 10⁻⁶ of the reference peak; travel and force must agree within 1%. Near-machine-precision waveform agreement in this smooth, well-sampled example must not be generalized to arbitrary inputs.

## Engine and browser coverage

Engine checks cover parsing failures (including empty cells), units, interpolation, no extrapolation, frequency bounds, narrow imported spectrum notches, amplification, distance calibration limits, signed factors, band intersections, double counting, margins, MPE rationale, Q mismatch, comparison metadata, incomplete coverage, uniform sampling, mean removal, zero-input/scaling/polarity properties, residual inclusion, sample-rate limits, mount prerequisites/contact/mass dependence, envelope grouping/completeness, malformed projects, disabled cases, computation limits and input immutability.

Browser checks exercise the generated standalone HTML through a file URL: worker execution, provenance hashing, plot inspection/view limits, JSON round trip, CSV/run-manifest/SVG/HTML exports, stale-result invalidation, invalid-input feedback, invalid-project state preservation, distance/factor editing, teaching isolation, contact warnings, escaped imported text, CSV formula-prefix handling, 390 px mobile layout, setup/help accessibility, and absence of application errors or network requests. Desktop captures use a 1440 × 1000 viewport. Exported HTML is reopened and inspected separately.

## What is not established

- No measured source hardware, fixture, joint, panel, path attenuation or component survival prediction is validated. Teaching levels and transfer ratios are illustrative.
- No ShockSat dataset has been processed or held out as a physical validation case.
- No distributed source initiation, FRF/MIMO, FE/SEA solver, nonlinear mount, bypass path or statistical tolerance estimator is implemented.
- History-response peaks between oscillator frequencies require grid convergence checks. Input interpolation cannot recover unresolved measurement bandwidth or aliased information.
- Isolation assumes a linear mount, rigid payload and prescribed base motion. Force excludes gravity and preload. Clearance exceedance invalidates the extrapolated linear result.
- SRS test coverage does not establish equivalence of duration, waveform, repetition count, operating state, internal response or failure mechanisms.
- Desktop Chrome and a mobile viewport were exercised. Safari, Firefox, actual mobile file-opening workflows, assistive technologies and older browsers were not exhaustively tested.

No standard-compliance or flight-qualification claim follows from these numerical checks.
