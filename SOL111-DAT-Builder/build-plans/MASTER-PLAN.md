# Nastran SOL 111 .dat File Builder — Master Build Plan

## Overview

A wizard-style web app that guides users through creating Nastran SOL 111 (Frequency Response) `.dat` input files, with an optional Python backend for job submission and monitoring.

**Architecture**: Single-file HTML front-end + optional Python server back-end, matching the `SOL111-HTML-Viewer` conventions (vanilla JS, CSS custom properties, object-based state).

## Why This Tool Exists

Creating SOL 111 `.dat` files is manual, error-prone, and requires deep knowledge of Nastran card syntax. This tool:
- Encapsulates best practices into a guided wizard
- Validates inputs before generating files
- Provides real-time card preview so users learn as they go
- Optionally manages job submission/monitoring via a local Python server

## Phase Summary

| Phase | Scope | Est. Lines | Milestone |
|-------|-------|-----------|-----------|
| **1** | HTML shell, wizard navigation, CSS design system | ~1000 | Navigable skeleton |
| **2** | Analysis parameters (EIGRL, FREQ, damping) | ~1200 | Cards preview working |
| **3** | Boundary conditions, loads, output requests, templates | ~1400 | Full wizard inputs |
| **4** | BDF parser + pre-analysis checks | ~1200 | Model-aware setup |
| **5** | .dat file assembly, preview, download | ~900 | **MVP — standalone tool complete** |
| **6** | Python backend server | ~600 (py) | API for job management |
| **7** | Job queue UI + final integration | ~1000 | Full tool delivered |

## Dependency Graph

```
Phase 1 (Shell)
    │
    ▼
Phase 2 (Analysis Params)
    │
    ▼
Phase 3 (BCs, Loads, Output, Templates)
    │
    ▼
Phase 4 (BDF Parser + Pre-Checks)
    │
    ▼
Phase 5 (.dat Generation) ──── MVP MILESTONE ────
    │
    ▼
Phase 6 (Python Server)
    │
    ▼
Phase 7 (Job Queue UI + Integration)
```

## Conventions (from SOL111-HTML-Viewer)

- **Single-file HTML delivery** — all CSS, HTML, and JS in one `.html` file
- **CSS custom properties**: `--accent: #1a5fa8`, `--bg: #f4f5f7`, `--surface: #ffffff`
- **System font stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **State pattern**: `const State = { ... }` for all mutable state
- **App pattern**: `const App = { ... }` for all event handlers/public API
- **Utilities**: `el(id)`, `escHtml()`, `setStatus()`
- **Modals**: Hidden `<div>` toggled via `.visible` class
- **No build step** — open HTML file directly in browser

## File Structure (Final)

```
SOL111-DAT-Builder/
├── sol111_builder.html    # Main single-file application
├── server.py              # Python backend (Phase 6)
├── README.md              # User documentation
└── build-plans/           # Development planning docs
    ├── MASTER-PLAN.md     # This file
    ├── PHASE-1.md         # Shell + wizard nav
    ├── PHASE-2.md         # Analysis parameters
    ├── PHASE-3.md         # BCs, loads, output, templates
    ├── PHASE-4.md         # BDF parser + pre-checks
    ├── PHASE-5.md         # .dat generation + download
    ├── PHASE-6.md         # Python server
    └── PHASE-7.md         # Job queue UI + integration
```

## Critical Reference Files

- `SOL111-HTML-Viewer/pch_plotter.html` — UI patterns, CSS, State/App structure
- `SOL111-HTML-Viewer/pch_parser.js` — Parser architecture pattern (two-pass, DOM-independent)
- `SOL111-HTML-Viewer/README.md` — Documentation depth/style reference
