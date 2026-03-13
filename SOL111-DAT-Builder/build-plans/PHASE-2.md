# Phase 2: Analysis Parameters — Executive Control, EIGRL, Frequency & Damping

## Goal

Populate wizard Steps 1 and 2 with real Nastran SOL 111 input fields. Implement the Nastran card formatting engine. Users will see their inputs rendered as properly formatted Nastran cards in real-time.

## Dependencies

- Phase 1 complete (HTML shell, wizard navigation, CSS)

## Estimated Size: ~1200 lines added

- HTML form fields: ~350 lines
- JS validation & state management: ~400 lines
- Nastran card formatting module: ~300 lines
- CSS for form elements: ~150 lines

## Step 1: Project Setup — Fields

| Field | Type | Default | Nastran Card |
|-------|------|---------|-------------|
| Job Name | text input | `"untitled"` | Used for filename |
| Analyst Name | text input | `""` | Comment in file header |
| Title | text input | `""` | `TITLE = ...` |
| Subtitle | text input | `""` | `SUBTITLE = ...` |
| Nastran Version | dropdown | `"msc"` | Affects card syntax variations |
| BDF File Path | text + file picker | `""` | `INCLUDE 'path.bdf'` |

### BDF File Handling (Step 1)

- File picker button OR manual text entry for path
- When file is selected via picker: store the `File` object for Phase 4 parsing, display filename
- The path entered/displayed is used in the INCLUDE statement
- Drag-and-drop zone for BDF file (reuse viewer pattern)
- Phase 4 will add the "Parse BDF" button and auto-population logic

## Step 2: Analysis Parameters — Fields

### Section A: Modal Extraction (EIGRL Card)

| Field | Type | Default | EIGRL Field |
|-------|------|---------|------------|
| Method | dropdown | `"Lanczos"` | Implied by card type (EIGRL = Lanczos) |
| Lower Frequency (Hz) | number | `0.0` | V1 (converted to rad/s if needed) |
| Upper Frequency (Hz) | number | `2000.0` | V2 |
| Number of Modes | number | `50` | ND |
| Normalization | dropdown | `"MASS"` | NORM |

**Note on EIGRL**: V1 and V2 are in Hz for EIGRL (cycles/sec). No conversion needed.

**Validation**:
- V1 < V2
- ND > 0
- If V1 < 0, warn (unusual but valid)

### Section B: Frequency Definition

**Type selector** (radio buttons):

| Type | Card | Fields |
|------|------|--------|
| Linear Spacing | FREQ1 | Start freq, delta freq, number of increments |
| Logarithmic Spacing | FREQ2 | Start freq, end freq, number of logarithmic increments |
| Spread Around Modes | FREQ4 | Start freq, end freq, spread factor, number of points per mode |
| Explicit List | FREQ | List of frequencies (comma or space separated) |

**FREQ1 fields**: SID (auto), F1 (start, Hz), DF (increment, Hz), NDF (count)
**FREQ2 fields**: SID (auto), F1 (start, Hz), F2 (end, Hz), NF (count)
**FREQ4 fields**: SID (auto), F1 (start, Hz), F2 (end, Hz), FSPD (spread), NFM (points per mode)
**FREQ fields**: SID (auto), list of F values

**Validation**:
- F1 > 0 for FREQ2 (log spacing requires positive start)
- DF > 0 for FREQ1
- NDF > 0, NF > 0
- FREQ list: at least one value, all positive

### Section C: Damping

| Field | Type | Default | Card |
|-------|------|---------|------|
| Structural Damping (G) | number | `0.0` | `PARAM,G,value` |
| KDAMP | dropdown | `1` | `PARAM,KDAMP,value` (1=structural, -1=viscous) |
| Modal Damping Table | toggle + table | off | `TABDMP1` |

**TABDMP1 table widget**:
- Editable table with columns: Frequency (Hz), Damping Value
- "Add Row" / "Remove Row" buttons
- Minimum 2 rows
- Type dropdown: `CRIT` (critical damping ratio), `G` (structural), `Q` (quality factor)
- Table must end with `ENDT` in generated card

**Validation**:
- If G = 0 and TABDMP1 is off, show warning: "No damping defined — resonant response will be infinite"
- Damping values should be positive (warn if negative)

## Nastran Card Formatting Module

### `NastranCards` Object

This is the core reusable module for formatting 80-character fixed-format Nastran cards.

```javascript
const NastranCards = {
  // Low-level formatters
  field8(value),       // Format value into 8-char field (right-justified numbers, left-justified strings)
  field16(value),      // Format value into 16-char field (large-field format)
  comment(text),       // Format as $ comment line
  continuationLine(fields, contId),  // Handle continuation

  // Card-specific formatters — each returns array of strings (lines)
  formatEIGRL(params),     // { sid, v1, v2, nd, norm }
  formatFREQ(params),      // { sid, frequencies: [] }
  formatFREQ1(params),     // { sid, f1, df, ndf }
  formatFREQ2(params),     // { sid, f1, f2, nf }
  formatFREQ4(params),     // { sid, f1, f2, fspd, nfm }
  formatTABDMP1(params),   // { sid, type, pairs: [{f, g}] }
  formatPARAM(name, value), // Generic PARAM card
};
```

### Fixed-Format Rules

- Standard card: 10 fields of 8 characters each (columns 1-8: card name, 9-16: field 1, ..., 73-80: continuation)
- Continuation cards: first field is `+` or blank, continuation ID in field 10
- Numbers: integers right-justified, reals in Nastran shorthand (e.g., `1.5+3` for `1.5e3`)
- Strings: left-justified within field

### Real Number Formatting

Nastran accepts several real number formats in 8-char fields:
- Standard: `1.5E+03` (takes 7 chars)
- Short: `1.5+3` (Nastran shorthand, saves space)
- Use shortest representation that fits in 8 characters
- Integers: no decimal point needed

```javascript
function formatNastranReal(value) {
  // Try integer if exact
  // Try fixed decimal if it fits
  // Try Nastran shorthand (1.5+3)
  // Fall back to scientific notation
}
```

## Live Preview Panel

The right-side preview panel (within the split-pane layout) shows:

```
$ ──── Executive Control ────
SOL 111
TIME 600
CEND
$ ──── EIGRL Card ────
EIGRL   1       0.0     2000.0  50                      MASS
$ ──── Frequency Definition ────
FREQ1   2       10.0    5.0     400
$ ──── Damping ────
PARAM   G       0.02
PARAM   KDAMP   1
```

- Updates in real-time as user types
- Syntax highlighted: card names in blue, comments in green, continuation markers in gray
- Monospace font (`var(--mono)`)

## State Additions

```javascript
// Add to State object:
// Step 2: Analysis Parameters
eigrl: {
  sid: 1,
  v1: 0.0,
  v2: 2000.0,
  nd: 50,
  norm: 'MASS',
},
freqType: 'FREQ1',  // 'FREQ' | 'FREQ1' | 'FREQ2' | 'FREQ4'
freq: {
  sid: 2,
  frequencies: [],  // for FREQ
  f1: 10.0,         // for FREQ1/FREQ2/FREQ4
  df: 5.0,          // for FREQ1
  f2: 2000.0,       // for FREQ2/FREQ4
  ndf: 400,         // for FREQ1
  nf: 200,          // for FREQ2
  fspd: 0.1,        // for FREQ4
  nfm: 3,           // for FREQ4
},
damping: {
  g: 0.0,
  kdamp: 1,
  useTabdmp1: false,
  tabdmp1: {
    sid: 3,
    type: 'CRIT',
    pairs: [
      { f: 0.0, g: 0.02 },
      { f: 2000.0, g: 0.02 },
    ],
  },
},
```

## Acceptance Criteria

1. Step 1 shows all project setup fields, values stored in State
2. Step 2 shows three collapsible sections: Modal Extraction, Frequency Definition, Damping
3. Changing frequency type shows/hides the appropriate fields
4. TABDMP1 toggle shows/hides the editable table
5. Preview panel updates in real-time as any field changes
6. Preview shows properly formatted 80-column Nastran cards
7. Validation errors shown inline (red border + message below field)
8. Warning for zero damping displayed when applicable
9. `NastranCards.formatEIGRL()` produces correct fixed-format output
10. `NastranCards.formatFREQ1/2/4()` produce correct output
11. `NastranCards.formatTABDMP1()` produces correct output with ENDT terminator
12. Real number formatting handles edge cases (0.0, very large, very small, negative)

## What NOT to Build

- Boundary conditions or loads (Phase 3)
- Output requests (Phase 3)
- Templates (Phase 3)
- BDF parsing (Phase 4)
- Full .dat file assembly (Phase 5)

## Reference: Correct Card Formats

### EIGRL Example
```
EIGRL   1       0.0     2000.0  50                      MASS
```
Fields: SID, V1, V2, ND, (blank), (blank), (blank), NORM

### FREQ1 Example
```
FREQ1   2       10.0    5.0     400
```
Fields: SID, F1, DF, NDF

### FREQ2 Example
```
FREQ2   2       10.0    2000.0  200
```
Fields: SID, F1, F2, NF

### TABDMP1 Example
```
TABDMP1 3       CRIT                                    +TDP
+TDP    0.0     0.02    500.0   0.03    1000.0  0.05    +TDP2
+TDP2   2000.0  0.02    ENDT
```
Fields: SID, TYPE, then pairs of (frequency, damping) on continuation lines, ending with ENDT
