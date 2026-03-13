# Phase 3: Boundary Conditions, Loads, Output Requests & Templates

## Goal

Populate wizard Steps 3 and 4 with real Nastran form fields. Implement the template system that can pre-fill the entire wizard. After this phase, all user inputs for a complete SOL 111 analysis are captured.

## Dependencies

- Phase 2 complete (Step 1-2 fields, NastranCards module, preview panel)

## Estimated Size: ~1400 lines added

- HTML form fields: ~400 lines
- JS state/validation/rendering: ~600 lines
- Card formatters (DLOAD, RLOAD1, TABLED1, SPC, Case Control): ~250 lines
- Template definitions: ~150 lines

## Step 3: Boundary Conditions & Loads

### Section A: SPC (Single-Point Constraints) Reference

This step does NOT create SPC cards (those are in the model BDF). It sets up the Case Control `SPC = n` reference.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| SPC Set ID | number | `1` | References SPC/SPC1 cards in model BDF |
| Description | text | `""` | Comment only, for user reference |

**If BDF is parsed (Phase 4)**: dropdown populated with detected SPC set IDs.

### Section B: Dynamic Loads — Subcase-Based

The load definition is the most complex part of SOL 111 setup. The UI must make this approachable.

**Concept**: Each subcase has one DLOAD reference. Each DLOAD combines one or more RLOAD1/RLOAD2 entries. For MVP, we support RLOAD1 only.

#### Subcase Manager

- List of subcases (minimum 1)
- "Add Subcase" / "Remove Subcase" buttons
- Each subcase panel is collapsible
- Each subcase has:

| Field | Type | Default | Card |
|-------|------|---------|------|
| Subcase Label | text | `"Subcase 1"` | `SUBCASE n` / `SUBTITLE` |
| DLOAD Reference | auto-generated | — | `DLOAD = n` in Case Control |

#### RLOAD1 Definition (within each subcase)

Each subcase has a list of RLOAD1 entries (typically 1-3). Each RLOAD1 defines one frequency-dependent load.

**RLOAD1 card**: `{A(f)} = {A} * [C(f) + i*D(f)] * exp(i*2π*τ*f)`

| Field | Type | Default | RLOAD1 Field |
|-------|------|---------|-------------|
| Excitation Set ID | number | — | SID (references DAREA card set) |
| DAREA Grid ID | number | — | Grid where force is applied |
| DAREA DOF | dropdown (1-6) | `1` | Component (T1,T2,T3,R1,R2,R3) |
| DAREA Scale | number | `1.0` | Scale factor |
| Delay (τ) | number | `0.0` | DELAY field (seconds) |
| Phase (θ) | number | `0.0` | DPHASE field (degrees) |
| C(f) Table | dropdown | — | TC reference (TABLED1 ID) |
| D(f) Table | dropdown | — | TD reference (TABLED1 ID) |

**Simplification for common case**: Most users apply a unit load with a flat spectrum. Provide a "Simple Load" toggle:
- **Simple mode** (default): Grid ID, DOF, magnitude. Auto-generates DAREA + RLOAD1 + TABLED1 (flat spectrum, C(f)=1.0 across all frequencies)
- **Advanced mode**: Full control over all RLOAD1 fields and custom TABLED1 tables

#### TABLED1 Definition

When in Advanced mode, users need to define frequency-dependent tables.

| Field | Type | Purpose |
|-------|------|---------|
| Table ID | auto | SID |
| Table Name | text | Comment |
| X-Y Pairs | editable table | Frequency (Hz) vs. Value |
| Interpolation | dropdown | `LINEAR` / `LOG` |

**Table editor widget** (reuse from Phase 2 TABDMP1 pattern):
- Columns: Frequency, Value
- Add/Remove row buttons
- Must end with ENDT
- Can paste from spreadsheet (tab-separated values)

#### DLOAD Card

Auto-generated to combine RLOAD1 entries within each subcase:

```
DLOAD   SID     S       S1      L1      S2      L2      ...
```

- SID: unique per subcase
- S: overall scale factor (default 1.0)
- S1, L1: scale and load set ID for first RLOAD1
- Multiple RLOAD1s added as S2/L2, S3/L3, etc.

### Section A+B Preview

The right-side preview for Step 3 shows all generated cards:

```
$ ──── Subcase 1: Base Excitation ────
$ DAREA for Grid 100, DOF 3
DAREA   10      100     3       1.0
$ Flat spectrum table
TABLED1 20      LINEAR                                  +T1
+T1     0.0     1.0     5000.0  1.0     ENDT
$ RLOAD1: load definition
RLOAD1  30      10              20
$ DLOAD combining loads
DLOAD   40      1.0     1.0     30
```

## Step 4: Output Requests

### Section A: Output Type Selection

Grid of checkboxes with configuration for each output type:

| Output Type | Card Name | Available Options |
|-------------|-----------|-------------------|
| Displacement | `DISPLACEMENT` | Format, SORT, SET |
| Velocity | `VELOCITY` | Format, SORT, SET |
| Acceleration | `ACCELERATION` | Format, SORT, SET |
| SPC Forces | `SPCFORCES` | Format, SORT, SET |
| MPC Forces | `MPCFORCES` | Format, SORT, SET |
| Element Forces | `FORCE` | Format, SORT, SET |
| Element Stress | `STRESS` | Format, SORT, SET |
| Strain Energy | `ESE` | Format, SORT, SET |

Each enabled output type has a config row:

| Field | Type | Options |
|-------|------|---------|
| Format | dropdown | `PRINT` / `PUNCH` / `PLOT` / `PRINT,PUNCH` |
| Sort | dropdown | `SORT1` (by frequency) / `SORT2` (by grid/element) |
| Set | dropdown | `ALL` / custom SET reference |

### Section B: SET Definition

- "Add SET" button creates a new SET entry
- Each SET has:
  - SET ID (auto-incremented)
  - Name/description (comment)
  - Member list: text area accepting Nastran SET syntax (`1,2,3,10 THRU 100,200 THRU 500 BY 10`)
- SETs appear as options in the output type "Set" dropdowns

### Section C: Output Format

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| Generate .pch file | checkbox | checked | `PARAM,POST,-1` or output request format |
| Generate .op2 file | checkbox | checked | `PARAM,POST,0` |

### Section D: Per-Subcase Output Overrides

By default, output requests apply to all subcases. Advanced option to customize per-subcase.

- Toggle: "Same outputs for all subcases" (default: on)
- When off: each subcase gets its own output request panel (copy of Section A)

## Template System

### Template Structure

```javascript
const Templates = {
  list: [
    {
      id: 'base-excitation',
      name: 'Simple Base Excitation',
      description: 'Enforced acceleration at base grids, measure response at selected nodes',
      config: { /* full State override object */ }
    },
    {
      id: 'point-force',
      name: 'Point Force Excitation',
      description: 'Unit force applied at a single grid point, frequency sweep response',
      config: { ... }
    },
    {
      id: 'white-noise-random',
      name: 'White Noise Random Vibration',
      description: 'Flat PSD input spectrum for random vibration analysis',
      config: { ... }
    },
  ],

  apply(templateId) {
    // Deep-merge template config into State
    // Re-render all steps
  },

  saveCurrentAsTemplate() {
    // Serialize current State to JSON
    // Download as .json file
  },

  loadTemplate(jsonFile) {
    // Parse uploaded JSON
    // Apply to State
  },
};
```

### Template UI

- Step 1 gets a "Start from Template" section at the top
- Dropdown to select a built-in template, or "Upload saved configuration"
- "Apply Template" button with confirmation (overwrites current values)
- Step 6 gets a "Save Configuration" button (Phase 5 adds it, but the save logic lives here)

### Save/Load Configuration

- Save: serialize relevant State fields to JSON, download via Blob
- Load: file picker for `.json`, parse and apply to State
- JSON schema includes a version field for forward compatibility

## State Additions

```javascript
// Add to State object:

// Step 3: Boundary Conditions & Loads
spcSetId: 1,
subcases: [
  {
    id: 1,
    label: 'Subcase 1',
    dloadSid: null,  // auto-generated
    loads: [
      {
        type: 'simple',  // 'simple' | 'advanced'
        gridId: null,
        dof: 3,
        magnitude: 1.0,
        delay: 0.0,
        phase: 0.0,
        // Advanced mode fields:
        dareaSid: null,
        rload1Sid: null,
        tcTableId: null,
        tdTableId: null,
        tcTable: null,  // { pairs: [{x,y}], interp: 'LINEAR' }
        tdTable: null,
      }
    ],
  }
],

// Step 4: Output Requests
outputRequests: {
  displacement:  { enabled: true,  format: 'PUNCH', sort: 'SORT1', set: 'ALL' },
  velocity:      { enabled: false, format: 'PUNCH', sort: 'SORT1', set: 'ALL' },
  acceleration:  { enabled: true,  format: 'PUNCH', sort: 'SORT1', set: 'ALL' },
  spcforces:     { enabled: false, format: 'PRINT', sort: 'SORT1', set: 'ALL' },
  mpcforces:     { enabled: false, format: 'PRINT', sort: 'SORT1', set: 'ALL' },
  force:         { enabled: false, format: 'PRINT', sort: 'SORT1', set: 'ALL' },
  stress:        { enabled: false, format: 'PRINT', sort: 'SORT1', set: 'ALL' },
  ese:           { enabled: false, format: 'PRINT', sort: 'SORT1', set: 'ALL' },
},
sets: [],  // { id, name, members: "1 THRU 100" }
sameOutputsAllSubcases: true,
generatePch: true,
generateOp2: true,

// Templates
activeTemplate: null,
```

## Card Formatters to Add

```javascript
// Add to NastranCards:
formatDAREA(params),    // { sid, gridId, dof, scale }
formatRLOAD1(params),   // { sid, dareaSid, delaySid, dphaseSid, tcSid, tdSid }
formatDLOAD(params),    // { sid, scale, loads: [{scale, sid}] }
formatTABLED1(params),  // { sid, interp, pairs: [{x,y}] }
formatSET(params),      // { sid, members: "1 THRU 100" }
formatCaseControl(params), // Subcase + output requests → Case Control lines
```

## Acceptance Criteria

1. Step 3 shows SPC reference field and subcase manager
2. Can add/remove subcases (minimum 1)
3. Each subcase has Simple and Advanced load modes
4. Simple mode: grid ID, DOF dropdown, magnitude → auto-generates DAREA + RLOAD1 + TABLED1
5. Advanced mode: full RLOAD1 fields and custom TABLED1 table editor
6. Preview panel shows all load cards formatted correctly
7. Step 4 shows output type checkboxes with config dropdowns
8. Can define custom SETs with Nastran syntax
9. SET references appear in output type dropdowns
10. Templates can be selected and applied — all wizard fields update
11. Configuration can be saved to JSON and loaded back
12. All new card formatters produce correct 80-column output

## What NOT to Build

- BDF auto-population of grid IDs / element IDs (Phase 4)
- Full .dat file assembly (Phase 5)
- RLOAD2 support (deferred)
- DPHASE / DELAY as table references (use scalar values only)
- Per-subcase output overrides in Advanced mode (future enhancement — track in State but hide UI)
