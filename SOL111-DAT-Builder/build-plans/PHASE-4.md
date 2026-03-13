# Phase 4: BDF Parser & Pre-Analysis Checks (Step 5)

## Goal

Implement a scoped BDF file parser that extracts model metadata to assist with wizard setup. Populate Step 5 (Pre-Check & Review) with validation checks that catch common mistakes before file generation.

## Dependencies

- Phase 3 complete (all wizard input fields exist, State fully defined)

## Estimated Size: ~1200 lines added

- BDF parser module: ~550 lines
- Pre-check logic: ~250 lines
- UI for import summary + check results: ~300 lines
- CSS for check result styling: ~100 lines

## BDF Parser Module

### Scope — Strictly Limited

We parse ONLY what's needed for SOL 111 setup assistance. This is a metadata extraction tool, not a full BDF interpreter.

### `BDFParser` Object

```javascript
const BDFParser = {
  parse(text) → BDFSummary,
  parseCard(lines) → { name, fields[] },
  detectFormat(line) → 'free' | 'small' | 'large',
  splitFixedFields(line) → string[],
  splitFreeFields(line) → string[],
  assembleContinuations(rawLines) → logicalCards[],
};
```

### BDFSummary Structure

```javascript
{
  gridIds: Set<number>,          // All GRID IDs found
  gridCount: number,
  elemTypes: Map<string, number>, // Element type → count
  elemCount: number,
  matIds: Set<number>,           // Material IDs
  spcSets: Map<number, { grids: Set<number>, dofs: string }>,  // SPC set ID → referenced grids
  existingEigrl: [],             // Any EIGRL/EIGR cards found (potential conflict)
  existingFreq: [],              // Any FREQi cards found
  existingDloads: [],            // Any DLOAD/RLOAD cards found
  properties: Map<number, string>, // Property ID → element type
  coordSystems: Set<number>,     // Coordinate system IDs
  includeFiles: string[],        // INCLUDE references found (not resolved)
  parseWarnings: string[],       // Non-fatal issues encountered
  rawLineCount: number,
  cardCount: number,
}
```

### Parsing Strategy

#### 1. Line Classification

```
$ comment line    → skip (store first few as model description)
INCLUDE 'file'    → log in includeFiles, warn user
BEGIN BULK         → switch to bulk data mode
ENDDATA           → stop parsing
other lines       → potential card data
```

#### 2. Card Assembly (Continuation Handling)

Nastran cards can span multiple lines via continuations:

**Explicit continuation** (small-field):
```
GRID    1               0.0     0.0     0.0             +G1
+G1     123456
```
Field 10 of parent matches field 1 of continuation.

**Free-format continuation**:
```
GRID,1,,0.0,0.0,0.0,,
,123456
```
Line starting with `,` continues the previous card.

**Automatic continuation** (no explicit marker):
Some implementations treat `+` in column 1 as continuation of previous card.

**Algorithm**:
1. Scan all lines, detect which are continuations
2. Group into logical cards (parent + continuations)
3. Parse each logical card into name + flat field array

#### 3. Format Detection

Per-line detection:
- **Free-format**: contains `,` in card data portion → split on commas
- **Large-field**: card name ends with `*` (e.g., `GRID*`) → 16-char fields
- **Small-field** (default): 8-char fixed fields

#### 4. Card-Specific Extraction

For each logical card, extract based on card name:

| Card Name | What to Extract |
|-----------|----------------|
| `GRID` | ID (field 1) |
| `CBAR`, `CBEAM`, `CBUSH`, `CELAS1-4`, `CQUAD4`, `CTRIA3`, `CHEXA`, `CPENTA`, `CTETRA`, `CROD`, `CONROD` | ID (field 1), element type (card name) |
| `MAT1`, `MAT2`, `MAT8`, `MAT9` | ID (field 1) |
| `SPC` | SID (field 1), grid (field 2), DOFs (field 3) |
| `SPC1` | SID (field 1), DOFs (field 2), grids (field 3+, may use THRU) |
| `EIGRL` | All fields — flag as existing |
| `EIGR` | All fields — flag as existing |
| `FREQ`, `FREQ1-5` | All fields — flag as existing |
| `DLOAD` | SID — flag as existing |
| `RLOAD1`, `RLOAD2` | SID — flag as existing |
| `PBAR`, `PBEAM`, `PBUSH`, `PSHELL`, `PSOLID`, `PELAS` | ID and type |

All other cards: skip silently.

### THRU Handling

SPC1 and SET cards use `THRU` ranges:
```
SPC1    1       123     1       THRU    100
```

Parse `THRU` keyword and expand to range (but store as `{start, end}` to avoid memory issues with large ranges). For grid ID sets, store both the explicit IDs and THRU ranges.

### Performance Considerations

- BDF files can be 100K+ lines
- Parse in a single pass, don't build an AST
- Use Set/Map for O(1) lookups
- Don't store coordinates, connectivity, or property values (just IDs)
- If file > 5MB, show progress indicator (use setTimeout chunking to keep UI responsive)

### Error Handling

- Unknown card: silently skip
- Malformed continuation: log warning, skip card
- Unrecognized format: try all three formats, take best guess
- INCLUDE files: log path, warn "INCLUDE files are not parsed"
- Empty file: return empty BDFSummary with warning

## BDF Import UI (Step 1 Enhancement)

Update Step 1 (from Phase 2) to add:

1. **Drop zone** for BDF file (below the path text field)
2. After file is loaded: "Parse Model" button
3. Parsing progress indicator (for large files)
4. **Model Summary Panel** (appears after parsing):

```
┌─────────────────────────────────────┐
│  Model Summary                       │
│  ─────────────────────────────────── │
│  Grids:     12,450                   │
│  Elements:  24,200                   │
│    CQUAD4:  18,000                   │
│    CTRIA3:   2,200                   │
│    CHEXA:    4,000                   │
│  Materials:  5                       │
│  SPC Sets:   2 (IDs: 1, 100)        │
│  ─────────────────────────────────── │
│  ⚠ Existing EIGRL card found (ID 10)│
│  ⚠ 3 INCLUDE files not parsed       │
│  ─────────────────────────────────── │
│  [Auto-fill Wizard Fields]           │
└─────────────────────────────────────┘
```

5. **Auto-fill button**: When clicked, populate:
   - Step 2: If existing EIGRL found, ask whether to use those values
   - Step 3: SPC Set ID dropdown populated with detected set IDs
   - Step 4: Grid ID lists available as SET options (e.g., "All grids: 1-12450")

## Step 5: Pre-Check & Review

### Check Categories

#### Required Checks (must pass)

| Check | Condition | Fix |
|-------|-----------|-----|
| EIGRL defined | `State.eigrl.v2 > State.eigrl.v1` | Go to Step 2 |
| Frequency set defined | At least one FREQi card configured | Go to Step 2 |
| At least one subcase | `State.subcases.length > 0` | Go to Step 3 |
| Each subcase has load | Every subcase has at least one load defined | Go to Step 3 |
| Load grids specified | All load grid IDs are non-null | Go to Step 3 |

#### Warning Checks (proceed with caution)

| Check | Condition | Message |
|-------|-----------|---------|
| No damping | G=0 and TABDMP1 off | "No damping defined — response at resonance will be infinite" |
| Few freq points | FREQ1 NDF < 100 | "Low frequency resolution may miss resonant peaks" |
| Freq range mismatch | FREQ range exceeds EIGRL range | "Frequency response requested beyond modal extraction range" |
| Large model, SORT2 | BDF has >10K grids and SORT2 selected | "SORT2 with many grids generates very large output" |
| Existing analysis cards | BDF has EIGRL/FREQ/DLOAD | "Model file contains analysis cards that may conflict" |

#### Info Checks (if BDF parsed)

| Check | Condition | Message |
|-------|-----------|---------|
| SPC grid coverage | Check SPC grid IDs exist in model | "SPC references grid X which is not in the model" |
| Load grid exists | Check load DAREA grid IDs exist in model | "Load applied to grid X which is not in the model" |
| Output SET validity | Check SET member IDs exist in model | "Output SET contains grid X not found in model" |

### Check Result UI

```
┌──────────────────────────────────────────────┐
│  Pre-Analysis Checks                          │
│                                               │
│  ✓ EIGRL defined (0-2000 Hz, 50 modes)       │
│  ✓ Frequency set: FREQ1 (400 points)          │
│  ✓ 1 subcase with loads defined               │
│  ⚠ No damping defined                    [Fix]│
│  ⚠ Freq points may be insufficient       [Fix]│
│  ✓ SPC Set 1: 24 grids constrained            │
│  ✓ Load grid 100 found in model               │
│                                               │
│  ──────────────────────────────────────────── │
│  Summary                                      │
│  ┌──────────┬──────────┬──────────┐          │
│  │ 5 Passed │ 2 Warnings│ 0 Failed│          │
│  └──────────┴──────────┴──────────┘          │
│                                               │
│  [Proceed to Generate]  [Review All Steps]    │
└──────────────────────────────────────────────┘
```

- Each check row: status icon (✓/⚠/✗), message, optional [Fix] button that jumps to the relevant step
- Summary counts at bottom
- "Proceed to Generate" enabled even with warnings (user's choice)
- "Proceed to Generate" disabled if any required check fails

### Review Summary

Below the checks, show a compact summary of all wizard selections:

```
Project: Job1 | MSC Nastran | BDF: model.bdf
Modal: Lanczos, 0-2000 Hz, 50 modes
Freq: FREQ1, 10-2000 Hz, Δ5 Hz (400 pts)
Damping: G=0.02, KDAMP=1
SPC: Set 1
Subcases: 1
  SC1: Grid 100, DOF 3, Mag 1.0
Output: DISP(PUNCH), ACCEL(PUNCH)
```

Clicking any section navigates to that step for editing.

## State Additions

```javascript
// Add to State:
bdfSummary: null,  // BDFSummary object after parsing
checkResults: [],  // Array of { id, category, status, message, fixStep }
```

## Acceptance Criteria

1. Can drop/select a BDF file in Step 1 and parse it
2. Model summary shows correct grid/element/material counts
3. INCLUDE files logged as warnings, not followed
4. SPC set IDs extracted and available as dropdown options in Step 3
5. Existing EIGRL/FREQ cards flagged with warnings
6. Step 5 runs all checks and displays results with status icons
7. Required check failures disable "Proceed to Generate"
8. Warning checks show [Fix] buttons that navigate to the correct step
9. Review summary accurately reflects all wizard selections
10. Parser handles both free-format and fixed-format cards
11. Parser handles continuation lines correctly
12. Large files (>50K lines) parse without freezing the UI

## What NOT to Build

- INCLUDE file resolution (out of scope)
- Coordinate extraction from GRID (just IDs)
- Element connectivity parsing (just type counts)
- Material property values (just IDs)
- Full BDF validation (we're extracting metadata, not validating the model)
- .dat file assembly (Phase 5)
