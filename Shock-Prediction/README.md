# Shock Prediction and Attenuation Workbench

Research and proposed technical framework, 20 October 2026. This package specifies a future tool; it does not contain an implemented or validated prediction engine.

## Recommended direction

Build a **source–structure–component workbench** with two calculation tracks:

1. **Empirical spectrum prediction:** measured source or interface spectra, qualified heritage analogs, and explicitly selected attenuation models for preliminary component environments.
2. **Dynamic response prediction:** measured or synthesized waveforms propagated through complex frequency response functions, reduced models, or externally supplied transient simulations.

Both tracks feed the same component assessment, uncertainty accounting, evidence library, and reporting workflow. Keep an SRS correction factor distinct from a physical transfer function. Keep predicted environment, qualification requirement, demonstrated test coverage, and component fragility distinct.

## Read the framework

| Document | Purpose |
|---|---|
| [Technical framework](FRAMEWORK.md) | Source taxonomy, physics, prediction methods, equations, attenuation studies, component assessment, data contracts, and user experience |
| [Research and evidence register](RESEARCH.md) | Primary-source findings, exact references and sections, access limitations, and recent developments through 2026 |
| [Implementation and validation plan](IMPLEMENTATION.md) | Staged scope, acceptance criteria, benchmark campaign, risks, and initial data priorities |

The highest-value first release is an offline workbench for **measured SRS/time-history import, source and path records, empirical method comparison, component environment envelopes, and transparent margins**. Complex FRF propagation is the next substantial capability. A complete explicit solver, source hydrocode, and general transient SEA implementation should remain external integrations until the core is demonstrated.

The proposed scope is spacecraft and launch-vehicle **structural shock**, including separation bolts/nuts, linear shaped charges, frangible joints, clampbands, non-explosive releases, and mechanical impact events. Source characterization starts at the mechanical input or measured response interface. Source-device design and manufacture are outside this tool's calculation scope.

The research identified NASA ShockSat as a particularly useful validation resource. Its public [file browser](https://nescacademy.nasa.gov/workshops/ShockSat/ShockSat1) lists impact, point-source, frangible-joint, model, and instrumentation packages. Dataset contents and numerical results have not been independently reproduced in this study.

## Decisions to preserve during development

- A device name alone never supplies a validated source level.
- Structural path length and load-path topology matter; straight-line distance is insufficient.
- Amplification is allowed. Attenuation factors cannot be stacked indefinitely or applied twice.
- SRS has neither Fourier phase nor a unique inverse waveform.
- Simultaneous inputs require timing/correlation treatment; separate events can be enveloped but retain their identities and counts.
- Measurement bandwidth, model bandwidth, statistical meaning, and qualification margin travel with every curve.
- A favorable SRS coverage ratio is evidence of environment coverage, not proof of component survival.

The architectural decisions and proposed numerical release gates are engineering recommendations from this study. They are not additional requirements attributed to NASA or ECSS. The research register distinguishes reviewed technical content from metadata-only and inaccessible references.
