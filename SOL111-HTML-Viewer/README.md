# Nastran PCH Plotter

A single-file, self-contained HTML tool for interactively plotting Nastran `.pch` (punch) output files. No server, no installation — open the file in any modern browser and drag-and-drop your PCH files.

---

## Quick Start

1. Open `pch_plotter.html` in Chrome, Edge, or Firefox (latest stable).
2. Drag one or more `.pch` files onto the **Import Files** drop zone, or click to browse.
3. Expand the **Trace Selector** tree: Run → Subcase → Result Family → Entity ID → Component.
4. Check the component checkboxes (e.g., T3) to add traces to the plot.
5. Use the toolbar to change representation, axis scales, title, and labels.
6. Export the plot as SVG or PNG.

---

## Supported PCH Formats

| Feature | Support |
|---|---|
| SORT1 (frequency/time as outer loop) | ✓ |
| SORT2 (entity as outer loop) | ✓ |
| Real / Imaginary complex representation | ✓ |
| Magnitude / Phase complex representation | ✓ |
| XYPUNCH curves (RM and IP components) | ✓ |
| CONT continuation lines (CBUSH, CELAS) | ✓ |
| Frequency response results | ✓ (primary) |
| Transient (time history) results | ✓ |
| Acceleration (ACCELERATION) | ✓ |
| SPC Forces (SPCFORCES) | ✓ |
| CBUSH / CELAS element forces | ✓ (Tier 1) |
| Multiple files / runs overlaid | ✓ |

---

## UI Reference

### Toolbar Controls

| Control | Description |
|---|---|
| **Representation** | Magnitude, Magnitude (dB), Real, Imaginary, Phase (deg), Phase Unwrapped |
| **X axis** | Log (default) or Linear |
| **Y axis** | Linear (default) or Log |
| **Title / X label / Y label** | Click to edit inline |
| **Export SVG / PNG** | Download the current plot |

### Sidebar

- **Loaded Runs**: lists all imported files; click **×** to remove a run.
- **Trace Selector**: hierarchical tree — Run → Subcase → Result Family → Entity ID → Component. Each leaf node has a checkbox to toggle the trace and an **i** button to open the Data Inspector.
- **Clear**: removes all active traces from the plot.

### Data Inspector

Click the **i** button next to any component to open the Data Inspector modal. It shows:

- **Raw Source Lines**: the exact PCH text lines that contributed to this trace, with syntax highlighting (comments, headers, data rows, CONT lines).
- **Parsed Token Table**: the extracted numeric table (index, x-axis value, real part, imaginary part) for debugging parser output.

---

## Representations

All representations are computed from the stored complex pair `(re, im)` which is always in **Real / Imaginary** form internally, regardless of the source format. When the source is Magnitude/Phase, the parser converts to Re/Im on load.

| Representation | Formula |
|---|---|
| Magnitude | `sqrt(re² + im²)` |
| Magnitude (dB) | `20 × log₁₀(sqrt(re² + im²))` |
| Real | `re` |
| Imaginary | `im` |
| Phase (deg) | `atan2(im, re) × 180/π`, wrapped to `(-180, 180]` |
| Phase Unwrapped | Phase with 2π discontinuities removed (Itoh algorithm) |

**Note on dB scale**: zero-magnitude points produce `-Infinity` in dB and are excluded from the plot (Plotly renders them as gaps). This is intentional and correct behaviour.

**Note on Phase Unwrapped**: the unwrapping algorithm operates on the discrete phase sequence using a threshold of π radians. For frequency response data with a resonance, the phase will show a smooth monotonically decreasing curve rather than the wrapped ±180° jumps.

---

## complexRep Inference

When the PCH file does not explicitly state whether complex data is in Real/Imaginary or Magnitude/Phase format (which is the common case — Nastran does not write this to the punch file), the parser infers it by scanning **all** data row pairs in the block:

- If **any** first-row component value is negative → `REAL_IMAG` (magnitudes are always ≥ 0).
- If **all** first-row values are non-negative **and** all second-row values are in `[-360, 360]` → `MAG_PHASE`.
- Otherwise → `REAL_IMAG` (conservative default).

This full-block scan is essential because near DC, all values in a REAL_IMAG block may be positive, making a partial scan unreliable.

---

## Architecture

The tool is assembled from three source files by `build.py`:

```
src/
  pch_parser.js        — Pure JS parser module (no DOM dependencies)
  app_template.html    — HTML/CSS/JS application shell
build.py               — Assembler: inlines Plotly + parser into the template
```

### Switching from Inline to CDN

The `build.py` assembler has a `CDN_MODE` flag at the top. Set it to `True` to replace the inlined Plotly bundle with a CDN `<script>` tag, reducing the file size from ~4.5 MB to ~50 KB. This requires an internet connection at runtime.

```python
# build.py
CDN_MODE = False   # set True for CDN version
```

### Parser Module (`pch_parser.js`)

The parser is fully isolated from the DOM and can be loaded in Node.js for unit testing:

```js
const PCHParser = require('./src/pch_parser.js');
const run = PCHParser.parsePCH(fileText, 'filename.pch');
const block = run.blocks[0];
const td = PCHParser.extractTraceData(block, entityId, 'T3');
const { x, y } = PCHParser.computeRepresentation(td, 'MAGNITUDE');
```

**Key exported functions:**

| Function | Signature | Description |
|---|---|---|
| `parsePCH` | `(text: string, name: string) → RunData` | Parse a full PCH file into blocks |
| `extractTraceData` | `(block: BlockMeta, entityId: number, component: string) → TraceData\|null` | Extract x/re/im arrays for one entity+component |
| `computeRepresentation` | `(td: TraceData, repr: string) → {x, y}` | Compute the requested representation |

---

## Running the Unit Tests

Requires Node.js ≥ 18.

```bash
cd /path/to/pch_plotter
node test_parser.js
```

Expected output: **78 passed, 0 failed**.

The tests cover all six synthetic fixtures:
- Fixture A: SORT2, Real/Imaginary (ACCELERATION + SPCFORCES)
- Fixture B: SORT1, Real/Imaginary
- Fixture C: SORT2, Magnitude/Phase
- Fixture D: XYPUNCH curves
- Fixture E: CBUSH element forces with CONT lines
- Fixture F: Transient (time history)

---

## Known Limitations and Future Work

- **Tier 2 element types** (CBAR, CBEAM, CROD, shells, solids) are not yet supported. The parser will ignore blocks with unrecognised result families.
- **Multiple subcases in a single block** are not yet supported; each subcase must be a separate block.
- **SORT1 with mixed entities per frequency step** is supported but the entity ID list is built from data rows, which may be slower for very large files.
- **GB-scale transient files**: the parser reads the entire file into memory as a string. For multi-GB files, consider splitting into subcases before loading.
