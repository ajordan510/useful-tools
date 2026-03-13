# Phase 1: HTML Shell, Wizard Navigation & CSS Design System

## Goal

Create the complete UI skeleton — all CSS theming, wizard step navigation, header/footer, layout containers, and the empty state management framework. No Nastran logic; this is purely the container that all subsequent phases plug content into.

## Deliverables

- `sol111_builder.html` — the main single-file application (skeleton)

## Estimated Size: ~1000 lines

- CSS: ~400 lines
- HTML structure: ~300 lines
- JavaScript (navigation + state): ~300 lines

## Design Decisions

### Wizard Steps

The wizard has 7 steps. Steps 1–6 are a linear flow; Step 7 (Job Queue) is accessible at any time via a header tab.

| Step | Name | Purpose |
|------|------|---------|
| 1 | Project Setup | Job name, analyst, title, Nastran version, BDF import |
| 2 | Analysis Parameters | EIGRL, frequency sets, damping |
| 3 | Boundary Conditions & Loads | SPC, DLOAD, RLOAD1 |
| 4 | Output Requests | DISP, ACCEL, STRESS, SETs, subcases |
| 5 | Pre-Check & Review | Validation, warnings, summary |
| 6 | Generate & Download | .dat preview, edit, download |
| 7 | Job Queue | Server connection, submit, monitor |

### Layout Structure

```
┌──────────────────────────────────────────────┐
│  HEADER (blue accent bar, title, Job Queue)  │
├──────────────────────────────────────────────┤
│  STEP PROGRESS BAR (1─2─3─4─5─6)            │
├──────────────────────────────────────────────┤
│                                              │
│  WIZARD CONTENT AREA                         │
│  ┌────────────────────┬─────────────────┐    │
│  │  INPUT PANEL       │ PREVIEW PANEL   │    │
│  │  (form fields)     │ (card preview)  │    │
│  │                    │                 │    │
│  └────────────────────┴─────────────────┘    │
│                                              │
├──────────────────────────────────────────────┤
│  FOOTER (Back / Next buttons, status bar)    │
└──────────────────────────────────────────────┘
```

- **Split-pane layout** for Steps 2–4: left side has form inputs, right side shows live Nastran card preview (populated in later phases)
- **Full-width layout** for Steps 1, 5, 6, 7
- Footer has Back/Next navigation buttons and a status message area

### CSS Design System

Mirror the `pch_plotter.html` conventions exactly:

```css
:root {
  --accent: #1a5fa8;
  --accent-hover: #174e8a;
  --accent-light: #e8f0fe;
  --bg: #f4f5f7;
  --surface: #ffffff;
  --border: #d1d5db;
  --text: #1f2937;
  --text-secondary: #6b7280;
  --success: #059669;
  --warning: #d97706;
  --error: #dc2626;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "Consolas", "Monaco", "Courier New", monospace;
  --radius: 6px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

Additional form-specific variables:
```css
  --input-height: 36px;
  --label-size: 0.85rem;
  --field-gap: 12px;
```

### State Object

```javascript
const State = {
  currentStep: 1,
  maxVisitedStep: 1,

  // Step 1: Project Setup
  jobName: '',
  analyst: '',
  title: '',
  subtitle: '',
  nastranVersion: 'msc',  // 'msc' | 'nx'
  bdfFilePath: '',
  bdfParsed: null,  // populated by Phase 4

  // Step 2: Analysis Parameters (populated by Phase 2)
  // Step 3: BCs & Loads (populated by Phase 3)
  // Step 4: Output Requests (populated by Phase 3)
  // Step 5: Check results (populated by Phase 4)
  // Step 6: Generated text (populated by Phase 5)
  // Step 7: Jobs (populated by Phase 7)

  serverUrl: 'http://localhost:8111',
  serverConnected: false,
};
```

### Navigation Module

```javascript
const Wizard = {
  STEPS: [
    { id: 1, name: 'Project Setup', icon: '1' },
    { id: 2, name: 'Analysis Parameters', icon: '2' },
    { id: 3, name: 'Boundary Conditions & Loads', icon: '3' },
    { id: 4, name: 'Output Requests', icon: '4' },
    { id: 5, name: 'Pre-Check & Review', icon: '5' },
    { id: 6, name: 'Generate & Download', icon: '6' },
  ],

  goToStep(n) { ... },
  next() { ... },
  back() { ... },
  canProceed() { ... },  // step-specific validation (stubbed in Phase 1)
  renderProgressBar() { ... },
  renderStep() { ... },  // dispatches to step-specific render functions
};
```

### App Object

```javascript
const App = {
  init() { ... },        // called on DOMContentLoaded
  onNext() { ... },
  onBack() { ... },
  onStepClick(n) { ... },
  onJobQueueTab() { ... },
};
```

### Utility Functions

```javascript
function el(id) { return document.getElementById(id); }
function escHtml(s) { ... }
function setStatus(msg, type) { ... }  // type: 'info' | 'success' | 'warning' | 'error'
function show(id) { el(id).classList.add('visible'); }
function hide(id) { el(id).classList.remove('visible'); }
```

## HTML Structure (High Level)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SOL 111 .dat Builder</title>
  <style>/* all CSS */</style>
</head>
<body>
  <header>
    <h1>SOL 111 .dat Builder</h1>
    <span>Nastran Frequency Response Setup Tool</span>
    <button id="btn-job-queue">Job Queue</button>
  </header>

  <div id="progress-bar">
    <!-- Step indicators rendered by JS -->
  </div>

  <main id="wizard-content">
    <div class="wizard-step" id="step-1">
      <div class="step-title">Step 1: Project Setup</div>
      <p class="step-placeholder">Content will be added in Phase 2</p>
    </div>
    <!-- steps 2-6 similar -->
  </main>

  <div id="step-7" class="wizard-step" style="display:none;">
    <!-- Job Queue panel, separate from linear flow -->
  </div>

  <footer>
    <button id="btn-back">Back</button>
    <div id="status-bar"></div>
    <button id="btn-next">Next</button>
  </footer>

  <script>/* all JavaScript */</script>
</body>
</html>
```

## Acceptance Criteria

1. Open `sol111_builder.html` in a browser — professional-looking interface appears
2. Progress bar shows all 6 steps with step names
3. Click on a step in the progress bar → navigates to that step (only if step ≤ maxVisitedStep)
4. Next button advances to next step, updates progress bar
5. Back button returns to previous step
6. Each step shows a placeholder message and its title
7. Job Queue button switches to the Job Queue panel (with a "back to wizard" button)
8. Steps 2–4 show the split-pane layout (left input area, right preview area — both empty)
9. Status bar displays messages via `setStatus()`
10. All CSS variables properly applied — blue header, white surfaces, proper typography
11. Responsive: works at 1024px+ width (no mobile needed)

## What NOT to Build

- No Nastran-specific form fields (Phase 2+)
- No BDF parsing (Phase 4)
- No file generation (Phase 5)
- No server communication (Phase 6-7)
- No input validation beyond step navigation
