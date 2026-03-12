/**
 * pch_parser.js
 * =============
 * Nastran PCH (punch) file parser for the PCH Plotter tool.
 *
 * Architecture
 * ------------
 * This module is intentionally isolated from the GUI so it can be unit-tested
 * independently and run inside a Web Worker without DOM access.
 *
 * The parser operates in two passes:
 *   Pass 1 – Line scan: split the file text into logical records, detect block
 *             boundaries, and emit a lightweight "block index" (metadata only,
 *             no numeric arrays yet).
 *   Pass 2 – On-demand numeric extraction: when the user selects a trace to
 *             plot, the relevant block's raw lines are parsed into Float64Arrays.
 *
 * Supported result families
 * -------------------------
 *   • ACCELERATION   – grid vector, 6 DOFs
 *   • DISPLACEMENT   – grid vector, 6 DOFs
 *   • VELOCITY       – grid vector, 6 DOFs
 *   • SPCF / SPCFORCES – SPC force/moment vector, 6 DOFs
 *   • MPCF           – MPC force/moment vector, 6 DOFs
 *   • ELEMENT FORCES (CBUSH, CELAS1/2/3/4) – element-type-aware parsing
 *   • XYPUNCH curves – ACCE and FORCE, RM/IP component conventions
 *
 * DOF labelling
 * -------------
 * For grid-point motion results (ACCELERATION, DISPLACEMENT, VELOCITY):
 *   Components are labelled T1, T2, T3, R1, R2, R3
 *
 * For force/reaction results (SPCF, MPCF):
 *   Components are labelled Fx, Fy, Fz, Mx, My, Mz
 *
 * For element force results:
 *   CBUSH components are labelled F1, F2, F3, M1, M2, M3
 *   CELAS1/2/3/4 components are labelled F
 *
 * ============================================================================
 * Row format variants handled
 * ============================================================================
 *
 * FORMAT A – Real MSC Nastran SORT2 (x-value first, no entity ID in data row):
 *   "    5.000000E+00 G     -9.939638E-03      2.198712E-08     -1.270445E-07"
 *   "-CONT-                 -2.518057E-06     -3.480340E-06      3.246033E-07"
 *   "-CONT-                 -1.075396E-09      1.291198E-11      1.026846E-10"
 *   "-CONT-                  1.291944E-09      1.776345E-09     -1.688139E-10"
 *   Entity is identified by the preceding $POINT ID = <n> marker.
 *   4 CONT lines: [DOFs 1-3 A], [DOFs 4-6 A], [DOFs 1-3 B], [DOFs 4-6 B]
 *   where A = real/magnitude, B = imaginary/phase.
 *
 * FORMAT B – Real MSC Nastran SORT1 (entity ID first, x from $FREQUENCY marker):
 *   "$FREQUENCY =   5.0000000E+00"
 *   "      2001       G     -9.939638E-03      2.198712E-08     -1.270445E-07"
 *   "-CONT-                 -2.518057E-06     -3.480340E-06      3.246033E-07"
 *   "-CONT-                 -1.075396E-09      1.291198E-11      1.026846E-10"
 *   "-CONT-                  1.291944E-09      1.776345E-09     -1.688139E-10"
 *   Entity ID is the first integer token; x comes from the most recent $FREQUENCY.
 *   4 CONT lines same as Format A.
 *
 * FORMAT C – Synthetic fixture SORT2/SORT1 (entity ID + x-value in same row):
 *   "          101        G    1.000000E+00    5.000781E-02    2.000313E-02    1.000156E+00"
 *   "                     0.000000E+00   -5.861203E-09   -2.344481E-09   -1.172241E-07"
 *   Entity ID is the first integer token; x-value is the 3rd token (after G).
 *   Second row is indented with a 0.0 placeholder and 3 imaginary values.
 *   Only 3 DOFs per row (T1/T2/T3 only — R1/R2/R3 are zero).
 *
 * ============================================================================
 * Public API
 * ============================================================================
 *
 * parsePCH(text, runName)  → RunData
 * extractTraceData(block, entityId, component)  → TraceData|null
 * computeRepresentation(td, repr)  → { x: number[], y: number[] }
 * componentLabels(resultFamily)  → string[]
 * componentLabelsForBlock(block) → string[]
 *
 * ============================================================================
 * Typedefs
 * ============================================================================
 *
 * RunData {
 *   runName:   string,
 *   title:     string,
 *   blocks:    BlockMeta[],
 *   warnings:  string[]
 * }
 *
 * BlockMeta {
 *   blockIndex:    number,
 *   resultFamily:  string,       // "ACCELERATION"|"DISPLACEMENT"|"VELOCITY"|
 *                                //  "SPCF"|"MPCF"|"ELEMENT_FORCES"|"XYPUNCH"
 *   resultType:    string,
 *   domain:        string,       // "FREQUENCY_RESPONSE"|"TRANSIENT"|"UNKNOWN"
 *   sort:          string,       // "SORT1"|"SORT2"|"UNKNOWN"
 *   complexRep:    string,       // "REAL_IMAG"|"MAG_PHASE"|"REAL_ONLY"|"UNKNOWN"
 *   subcaseId:     number,
 *   title:         string,
 *   subtitle:      string,
 *   label:         string,
 *   entityIds:     number[],
 *   elementType:   string|null,
 *   xypunchComp:   string|null,
 *   xypunchKind:   string|null,
 *   xypunchEntity: number|null,
 *   rawLines:      string[],
 *   dataLines:     number[]
 * }
 *
 * TraceData {
 *   x:          Float64Array,
 *   re:         Float64Array,
 *   im:         Float64Array,
 *   isComplex:  boolean,
 *   complexRep: string,
 *   component:  string,
 *   entityId:   number,
 *   domain:     string,
 *   sourceLines: string[]
 * }
 */

"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESULT_FAMILIES = {
  "ACCELERATION":    "ACCELERATION",
  "DISPLACEMENTS":   "DISPLACEMENT",
  "DISPLACEMENT":    "DISPLACEMENT",
  "VELOCITY":        "VELOCITY",
  "SPCFORCES":       "SPCF",
  "SPCFORCE":        "SPCF",
  "SPCF":            "SPCF",
  "MPCF":            "MPCF",
  "ELEMENT FORCES":  "ELEMENT_FORCES",
  "ELEMENT_FORCES":  "ELEMENT_FORCES",
  "XYPUNCH":         "XYPUNCH",
};

const FAMILY_COMPONENTS = {
  "ACCELERATION":   ["T1", "T2", "T3", "R1", "R2", "R3"],
  "DISPLACEMENT":   ["T1", "T2", "T3", "R1", "R2", "R3"],
  "VELOCITY":       ["T1", "T2", "T3", "R1", "R2", "R3"],
  "SPCF":           ["Fx", "Fy", "Fz", "Mx", "My", "Mz"],
  "MPCF":           ["Fx", "Fy", "Fz", "Mx", "My", "Mz"],
  "ELEMENT_FORCES": ["F1", "F2", "F3", "M1", "M2", "M3"],
  "XYPUNCH":        ["RM", "IP"],
};

const ELEMENT_FORCE_DESCRIPTORS = {
  CBUSH:  { components: ["F1", "F2", "F3", "M1", "M2", "M3"], kind: "VECTOR6" },
  CELAS:  { components: ["F"], kind: "SCALAR" },
  CELAS1: { components: ["F"], kind: "SCALAR" },
  CELAS2: { components: ["F"], kind: "SCALAR" },
  CELAS3: { components: ["F"], kind: "SCALAR" },
  CELAS4: { components: ["F"], kind: "SCALAR" },
};

/**
 * Unified component-to-DOF-index map.
 * All naming conventions map to indices 0-5.
 */
const COMPONENT_INDEX = {
  T1: 0, T2: 1, T3: 2, R1: 3, R2: 4, R3: 5,
  Fx: 0, Fy: 1, Fz: 2, Mx: 3, My: 4, Mz: 5,
  fx: 0, fy: 1, fz: 2, mx: 3, my: 4, mz: 5,
  FX: 0, FY: 1, FZ: 2, MX: 3, MY: 4, MZ: 5,
  F: 0, f: 0,
  F1: 0, F2: 1, F3: 2, M1: 3, M2: 4, M3: 5,
};

const REPR_LABEL_TO_KEY = {
  "MAGNITUDE": "MAGNITUDE",
  "MAGNITUDE (DB)": "DB",
  "REAL": "REAL",
  "IMAGINARY": "IMAG",
  "PHASE (DEG)": "PHASE",
  "PHASE UNWRAPPED (DEG)": "PHASE_UNWRAPPED",
};

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

// Header comment lines
const RE_TITLE      = /^\$TITLE\s*=\s*(.*)/i;
const RE_SUBTITLE   = /^\$SUBTITLE\s*=\s*(.*)/i;
const RE_LABEL      = /^\$LABEL\s*=\s*(.*)/i;
const RE_SUBCASE    = /^\$SUBCASE\s+ID\s*=\s*(\d+)/i;

// Explicit representation declaration (real MSC Nastran format)
const RE_REAL_IMAG  = /^\$REAL-IMAGINARY\s+OUTPUT/i;
const RE_MAG_PHASE  = /^\$MAGNITUDE-PHASE\s+OUTPUT/i;
const RE_REAL_ONLY  = /^\$REAL\s+OUTPUT/i;

// Result type header — all families we handle
const RE_RESULT     = /^\$(ACCELERATION|DISPLACEMENTS?|VELOCITY|SPCFORCES?|SPCF|MPCF|ELEMENT\s+FORCES?)/i;

// SORT2 entity markers — both real format ($POINT ID with space) and synthetic ($POINT-ID with hyphen)
const RE_POINTID    = /^\$POINT[\s-]ID\s*=\s*(\d+)/i;
const RE_ELEMID_MK  = /^\$ELEMENT[\s-]ID\s*=\s*(\d+)/i;

// Element type declaration
const RE_ELEMTYPE   = /^\$ELEMENT\s+TYPE\s*=\s*\d+\s+(\w+)/i;

// SORT1 frequency/time markers
const RE_FREQ       = /^\$FREQUENCY\s*=\s*([\d.Ee+\-]+)/i;
const RE_TIME_MK    = /^\$TIME\s*=\s*([\d.Ee+\-]+)/i;

// XYPUNCH block header
const RE_XYPUNCH    = /^\$XYPUNCH\s+(ACCE|FORCE)\s+(?:GRID|SPC)?\s*(\d+)\s+COMP\s+(\S+)/i;

// CONT line: both "-CONT-  v1  v2  v3" (real MSC) and "  CONT  v1  v2  v3" (synthetic)
const RE_CONT       = /^(?:-CONT-|\s+CONT)\s+([\d.Ee+\-\s]+)/i;

// XYPUNCH two-column row (x, y only)
const RE_XY_ROW     = /^\s*([\d.Ee+\-]+)\s+([\d.Ee+\-]+)\s*$/;

// ---------------------------------------------------------------------------
// Row classification helpers
// ---------------------------------------------------------------------------

/**
 * classifyGridRow
 * ---------------
 * Classify a data line into one of three grid-point row formats.
 *
 * Returns an object with:
 *   type:     "FORMAT_A" | "FORMAT_B" | "FORMAT_C" | "CONT" | "INDENTED" | null
 *   entityId: number | null    (the grid/point ID, if present in the row)
 *   xValue:   number | null    (the x-axis value, if present in the row)
 *   vals:     number[]         (the DOF values, up to 3 per row)
 *
 * FORMAT A: "  <x_float>  G  v1  v2  v3"  — real SORT2, x-value first
 * FORMAT B: "  <int_id>   G  v1  v2  v3"  — real SORT1, entity ID first, x from $FREQUENCY
 * FORMAT C: "  <int_id>   G  <x_float>  v1  v2  v3"  — synthetic, entity ID + x in same row
 * CONT:     "-CONT-  v1  v2  v3"
 * INDENTED: "                   0.0  v1  v2  v3"  — synthetic imaginary row
 *
 * @param {string} line
 * @returns {{ type: string, entityId: number|null, xValue: number|null, vals: number[] } | null}
 */
  function classifyGridRow(line) {
  // CONT line (both -CONT- and indented CONT)
  const cm = RE_CONT.exec(line);
  if (cm) {
    return { type: "CONT", entityId: null, xValue: null, vals: parseFloats(cm[1]) };
  }

  // Must start with whitespace followed by a number
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith("$")) return null;
  // Skip lines that start with CONT (handled by RE_CONT above)
  if (/^CONT\s/i.test(trimmed)) return null;

  // Split into tokens
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 3) return null;

  // Check for G flag
  // FORMAT A: token[0]=float, token[1]="G", token[2..4]=vals
  // FORMAT B: token[0]=int,   token[1]="G", token[2..4]=vals (no x in row)
  // FORMAT C: token[0]=int,   token[1]="G", token[2]=float(x), token[3..5]=vals

  const t0 = tokens[0];
  const t1 = tokens[1];

  if (t1 !== "G" && t1 !== "g") return null;

  const t0Num = Number(t0);
  if (isNaN(t0Num)) return null;

  const isInt = /^\d+$/.test(t0);
  const isFloat = /^[\d.]+[Ee][+\-]?\d+$/.test(t0) || (!isInt && t0.includes("."));

  if (isFloat) {
    // FORMAT A: x-value first
    const vals = [];
    for (let i = 2; i < Math.min(tokens.length, 5); i++) {
      const v = Number(tokens[i]);
      if (!isNaN(v)) vals.push(v);
    }
    return { type: "FORMAT_A", entityId: null, xValue: t0Num, vals };
  }

  if (isInt) {
    // Distinguish FORMAT B vs FORMAT C by token count:
    //
    //   FORMAT B (real MSC Nastran SORT1):
    //     token[0]=entityId  token[1]="G"  token[2..4]=DOFs 1-3
    //     Total tokens from trimStart: 5  (id + G + 3 vals)
    //     x-value comes from the preceding $FREQUENCY marker.
    //
    //   FORMAT C (synthetic SORT1/SORT2):
    //     token[0]=entityId  token[1]="G"  token[2]=xValue  token[3..5]=DOFs 1-3
    //     Total tokens: 6  (id + G + x + 3 vals)
    //
    // The token count is the most reliable discriminator.  A 5-token row is
    // always FORMAT B; a 6-token row is FORMAT C.  We fall back to the old
    // float-check only for ambiguous lengths.

    if (tokens.length <= 5) {
      // FORMAT B: entity ID, G, then 3 DOF values (x from $FREQUENCY)
      const vals = [];
      for (let i = 2; i < Math.min(tokens.length, 5); i++) {
        const v = Number(tokens[i]);
        if (!isNaN(v)) vals.push(v);
      }
      return { type: "FORMAT_B", entityId: t0Num, xValue: null, vals };
    } else {
      // FORMAT C: entity ID, G, x-value, then 3 DOF values
      const t2 = tokens[2];
      const t2Num = Number(t2);
      if (isNaN(t2Num)) {
        // Fallback: treat as FORMAT B if t2 is not numeric
        const vals = [];
        for (let i = 2; i < Math.min(tokens.length, 5); i++) {
          const v = Number(tokens[i]);
          if (!isNaN(v)) vals.push(v);
        }
        return { type: "FORMAT_B", entityId: t0Num, xValue: null, vals };
      }
      const vals = [];
      for (let i = 3; i < Math.min(tokens.length, 6); i++) {
        const v = Number(tokens[i]);
        if (!isNaN(v)) vals.push(v);
      }
      return { type: "FORMAT_C", entityId: t0Num, xValue: t2Num, vals };
    }
  }

  return null;
}

/**
 * classifyIndentedRow
 * -------------------
 * Detect the synthetic-format imaginary row:
 *   "                     0.000000E+00   v1  v2  v3"
 * This row has heavy leading whitespace (>10 spaces), starts with a 0 placeholder,
 * and contains 3-4 values.
 *
 * @param {string} line
 * @returns {{ vals: number[] } | null}
 */
function classifyIndentedRow(line) {
  if (line.trimStart().startsWith("$")) return null;
  // Must have at least 14 leading spaces
  if (!/^\s{14,}/.test(line)) return null;
  const trimmed = line.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;
  const nums = tokens.map(Number).filter(v => !isNaN(v));
  if (nums.length < 2) return null;
  // First value should be 0 (placeholder) or very small
  // Accept if first value is 0 or the row has 4 values (0 + 3 DOFs)
  return { vals: nums };
}

// ---------------------------------------------------------------------------
// Utility: strip trailing line-number field (real MSC Nastran format)
// ---------------------------------------------------------------------------

/**
 * stripLineNumber
 * ---------------
 * Real MSC Nastran PCH files append a right-justified integer line counter
 * in columns 73-80.  Strip it if present.
 *
 * @param {string} line
 * @returns {string}
 */
function stripLineNumber(line) {
  if (line.length < 73) return line;
  const m = line.match(/^(.*?)\s+(\d+)\s*$/);
  if (m && /^\d+$/.test(m[2])) return m[1];
  return line;
}

// ---------------------------------------------------------------------------
// Utility: parse space-separated floats
// ---------------------------------------------------------------------------

/**
 * parseFloats
 * @param {string} s
 * @returns {number[]}
 */
function parseFloats(s) {
  const tokens = s.trim().split(/\s+/);
  const result = [];
  for (const t of tokens) {
    const v = Number(t);
    if (!isNaN(v)) result.push(v);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public: componentLabels
// ---------------------------------------------------------------------------

/**
 * componentLabels
 * ---------------
 * Return the ordered list of component label strings for a given result family.
 *
 * @param {string} resultFamily
 * @returns {string[]}
 */
function componentLabels(resultFamily) {
  return FAMILY_COMPONENTS[resultFamily] || ["T1", "T2", "T3", "R1", "R2", "R3"];
}

function normalizeElementType(elementType) {
  const normalized = String(elementType || "").trim().toUpperCase();
  return normalized || null;
}

function getElementForceDescriptor(elementType) {
  const normalized = normalizeElementType(elementType);
  return normalized ? (ELEMENT_FORCE_DESCRIPTORS[normalized] || null) : null;
}

function parseElementForceRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("$") || /^-?CONT[-\s]/i.test(trimmed)) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2 || tokens[1] === "G") return null;

  const t0 = tokens[0];
  const t0IsPlainInt = /^\d+$/.test(t0);
  const t1IsType = /^[A-Za-z]/.test(tokens[1] || "") && isNaN(Number(tokens[1]));
  const entityId = t0IsPlainInt ? parseInt(t0, 10) : null;
  const elementType = t1IsType ? normalizeElementType(tokens[1]) : null;

  if (t0IsPlainInt && t1IsType && tokens.length >= 4) {
    const xValue = Number(tokens[2]);
    if (isNaN(xValue)) return null;
    const values = tokens.slice(3).map(Number).filter(v => !isNaN(v));
    return { format: "SORTX_TYPED", entityId, elementType, xValue, values };
  }

  if (t0IsPlainInt && !t1IsType) {
    const values = tokens.slice(1).map(Number).filter(v => !isNaN(v));
    return { format: "SORT1", entityId, elementType: null, xValue: null, values };
  }

  const xValue = Number(t0);
  if (isNaN(xValue)) return null;
  const valueStart = t1IsType ? 2 : 1;
  const values = tokens.slice(valueStart).map(Number).filter(v => !isNaN(v));
  return { format: t1IsType ? "SORT2_TYPED" : "SORT2", entityId: null, elementType, xValue, values };
}

function normalizeElementContValues(values, expectedCount) {
  if (!Array.isArray(values)) return [];
  if (values.length === expectedCount + 1 && Math.abs(values[0]) < 1e-12) {
    return values.slice(1);
  }
  return values;
}

function resolveElementForceType(block) {
  if (!block || block.resultFamily !== "ELEMENT_FORCES") return normalizeElementType(block && block.elementType);

  let normalized = normalizeElementType(block.elementType);
  if (normalized) return normalized;

  for (const line of block.rawLines || []) {
    const m = RE_ELEMTYPE.exec(line);
    if (m) {
      normalized = normalizeElementType(m[1]);
      break;
    }
    const row = parseElementForceRow(line);
    if (row && row.elementType) {
      normalized = row.elementType;
      break;
    }
  }

  if (!normalized) normalized = inferElementForceTypeFromTraceStore(block);

  if (normalized) block.elementType = normalized;
  return normalized;
}

function componentLabelsForBlock(block) {
  if (!block) return [];
  if (block.resultFamily !== "ELEMENT_FORCES") {
    return componentLabels(block.resultFamily);
  }
  const descriptor = getElementForceDescriptor(resolveElementForceType(block));
  if (descriptor) return descriptor.components.slice();

  const traceComps = Array.from(new Set(Object.keys(block.traceStore || {}).map(key => {
    const parts = String(key).split("::");
    return normalizeComponentLabel(parts[parts.length - 1]);
  }).filter(Boolean).map(comp => comp.toUpperCase())));
  if (traceComps.length === 0) return [];
  return traceComps.sort((a, b) => {
    const ai = COMPONENT_INDEX[a];
    const bi = COMPONENT_INDEX[b];
    if (ai !== undefined && bi !== undefined && ai !== bi) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.localeCompare(b);
  });
}

function normalizeComponentLabel(component) {
  return String(component || "").trim();
}

function normalizeTraceComponentKey(component) {
  return normalizeComponentLabel(component).toUpperCase();
}

function makeTraceStoreKey(entityId, component) {
  return `${entityId}::${normalizeTraceComponentKey(component)}`;
}

function inferElementForceTypeFromComponent(component) {
  const key = normalizeTraceComponentKey(component);
  if (!key) return null;
  if (key === "F") return "CELAS";
  return ELEMENT_FORCE_DESCRIPTORS.CBUSH.components.includes(key) ? "CBUSH" : null;
}

function inferElementForceTypeFromTraceStore(block) {
  const keys = Object.keys((block && block.traceStore) || {});
  for (const key of keys) {
    const parts = String(key).split("::");
    const inferred = inferElementForceTypeFromComponent(parts[parts.length - 1]);
    if (inferred) return inferred;
  }
  return null;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (src[i + 1] === "\"") {
          cell += "\"";
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        cell += ch;
      }
      i++;
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (src[i + 1] === "\n") i++;
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function csvCell(rows, rowIdx, colIdx) {
  return (rows[rowIdx] && rows[rowIdx][colIdx] !== undefined) ? rows[rowIdx][colIdx] : "";
}

function normalizeSpreadsheetFamily(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  return RESULT_FAMILIES[raw] || raw;
}

function parseSpreadsheetSubcase(value) {
  const m = String(value || "").trim().match(/^SC\s*(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseSpreadsheetEntity(value) {
  const m = String(value || "").trim().match(/^ID\s*(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseRepresentationLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  return REPR_LABEL_TO_KEY[key] || null;
}

function parseSpreadsheetNumber(value) {
  const trimmed = String(value === undefined || value === null ? "" : value).trim();
  if (!trimmed) return NaN;
  const num = Number(trimmed);
  return isNaN(num) ? NaN : num;
}

function makeSpreadsheetDisplayName(fileName, sheetName, runIndex, runCount) {
  const sheetSuffix = sheetName ? ` [${sheetName}]` : "";
  if (runCount > 1) return `${fileName}${sheetSuffix} [Spreadsheet ${runIndex + 1}/${runCount}]`;
  return `${fileName}${sheetSuffix} [Spreadsheet]`;
}

function createSpreadsheetBlock(blockIndex, runName, subcaseId, family, xypunchMeta, elementType) {
  const title = runName.replace(/\.[^.]+$/i, "");
  const subtitle = "Spreadsheet Import";
  const normalizedElementType = family === "ELEMENT_FORCES"
    ? (normalizeElementType(elementType) || null)
    : null;
  return {
    blockIndex,
    resultFamily: family,
    resultType: family,
    domain: "FREQUENCY_RESPONSE",
    sort: "SPREADSHEET",
    complexRep: "UNKNOWN",
    subcaseId,
    title,
    subtitle,
    label: "",
    entityIds: [],
    elementType: normalizedElementType,
    xypunchComp: xypunchMeta ? xypunchMeta.comp : null,
    xypunchKind: xypunchMeta ? xypunchMeta.kind : null,
    xypunchEntity: xypunchMeta ? xypunchMeta.entityId : null,
    sourceKind: "SPREADSHEET",
    traceStore: {},
    rawLines: [
      "$SPREADSHEET IMPORT",
      `$SOURCE FILE = ${runName}`,
      `$SUBCASE ID = ${subcaseId}`,
      `$RESULT FAMILY = ${family}`,
    ],
    dataLines: [],
  };
}

function addSpreadsheetTrace(block, traceData, meta) {
  const key = makeTraceStoreKey(meta.entityId, meta.component);
  block.traceStore[key] = traceData;
  if (!block.entityIds.includes(meta.entityId)) block.entityIds.push(meta.entityId);
  if (block.resultFamily === "ELEMENT_FORCES" && meta.elementType) {
    block.elementType = normalizeElementType(meta.elementType);
  }
  if (block.resultFamily === "XYPUNCH") {
    block.xypunchEntity = meta.entityId;
    block.xypunchComp = meta.component;
  }
  if (block.resultFamily === "ELEMENT_FORCES" && block.elementType) {
    const marker = `$ELEMENT TYPE = ${block.elementType}`;
    if (!block.rawLines.includes(marker)) block.rawLines.push(marker);
  }
  block.rawLines.push(
    `$TRACE ID = ${meta.entityId} ${meta.component} (${meta.storageKind === "DERIVED" ? meta.lockedRepr : "RAW"})`
  );
}

function finalizeSpreadsheetRun(run) {
  run.blocks.forEach((block, idx) => {
    block.blockIndex = idx;
    if (block.entityIds.length > 1) block.entityIds.sort((a, b) => a - b);
    if (run.displayName) block.title = run.displayName;
    block.subtitle = run.importSheetName ? `Spreadsheet Import (${run.importSheetName})` : "Spreadsheet Import";
  });
  return run;
}

function parseSpreadsheetCsv(fileName, textOrRows, sheetName) {
  const prefix = sheetName ? `${fileName} [${sheetName}]` : fileName;
  const rows = Array.isArray(textOrRows) ? textOrRows : parseCsvRows(textOrRows);
  const warnings = [];
  if (rows.length < 7) {
    return { runs: [], warnings: [`${prefix}: not enough rows for exported spreadsheet format.`] };
  }

  const baseLabels = ["Source File", "Subcase", "Result Family", "Entity ID", "Direction"];
  for (let i = 0; i < baseLabels.length; i++) {
    if (String(csvCell(rows, i, 0)).trim() !== baseLabels[i]) {
      return { runs: [], warnings: [`${prefix}: missing required metadata row "${baseLabels[i]}".`] };
    }
  }
  let elementTypeRowIdx = null;
  let representationRowIdx = 5;
  if (String(csvCell(rows, 5, 0)).trim() === "Element Type") {
    elementTypeRowIdx = 5;
    representationRowIdx = 6;
  }
  if (String(csvCell(rows, representationRowIdx, 0)).trim() !== "Representation") {
    return { runs: [], warnings: [`${prefix}: missing required metadata row "Representation".`] };
  }

  let headerRowIdx = representationRowIdx + 1;
  while (headerRowIdx < rows.length && rows[headerRowIdx].every(cell => String(cell || "").trim() === "")) {
    headerRowIdx++;
  }
  if (headerRowIdx >= rows.length) {
    return { runs: [], warnings: [`${prefix}: missing column header row.`] };
  }
  if (String(csvCell(rows, headerRowIdx, 0)).trim() !== "Frequency_Hz") {
    return { runs: [], warnings: [`${prefix}: expected first data header cell to be "Frequency_Hz".`] };
  }

  const xValues = [];
  const metadataRowCount = Math.max(representationRowIdx + 1, elementTypeRowIdx === null ? 0 : elementTypeRowIdx + 1);
  const columnCount = Math.max(
    rows[headerRowIdx].length,
    ...Array.from({ length: metadataRowCount }, (_, idx) => (rows[idx] ? rows[idx].length : 0))
  );
  const dataColumns = [];
  for (let col = 1; col < columnCount; col++) {
    const sourceFile = String(csvCell(rows, 0, col)).trim();
    const subcaseId = parseSpreadsheetSubcase(csvCell(rows, 1, col));
    const family = normalizeSpreadsheetFamily(csvCell(rows, 2, col));
    const entityId = parseSpreadsheetEntity(csvCell(rows, 3, col));
    const component = normalizeComponentLabel(csvCell(rows, 4, col));
    const elementType = family === "ELEMENT_FORCES"
      ? (normalizeElementType(elementTypeRowIdx === null ? "" : csvCell(rows, elementTypeRowIdx, col))
        || inferElementForceTypeFromComponent(component))
      : null;
    const reprLabel = String(csvCell(rows, representationRowIdx, col)).trim();
    const header = String(csvCell(rows, headerRowIdx, col)).trim();
    if (!sourceFile && !subcaseId && !family && !entityId && !component && !reprLabel && !header && !elementType) continue;
    if (!sourceFile || subcaseId === null || !family || entityId === null || !component || !reprLabel) {
      warnings.push(`${prefix}: skipping column ${col + 1} due to incomplete metadata.`);
      continue;
    }
    dataColumns.push({
      col,
      sourceFile,
      subcaseId,
      family,
      entityId,
      component,
      elementType,
      reprLabel,
      reprKey: parseRepresentationLabel(reprLabel),
      header,
      values: [],
    });
  }

  if (dataColumns.length === 0) {
    return { runs: [], warnings: [`${prefix}: no importable data columns found.`] };
  }

  for (let rowIdx = headerRowIdx + 1; rowIdx < rows.length; rowIdx++) {
    const rawX = String(csvCell(rows, rowIdx, 0)).trim();
    if (!rawX) continue;
    const x = parseSpreadsheetNumber(rawX);
    if (isNaN(x)) {
      warnings.push(`${prefix}: skipping row ${rowIdx + 1} with non-numeric Frequency_Hz value "${rawX}".`);
      continue;
    }
    xValues.push(x);
    dataColumns.forEach(col => {
      const rawCell = String(csvCell(rows, rowIdx, col.col)).trim();
      const value = parseSpreadsheetNumber(rawCell);
      if (rawCell && isNaN(value)) {
        warnings.push(`${prefix}: non-numeric value "${rawCell}" in row ${rowIdx + 1}, column ${col.col + 1}; importing as NaN.`);
      }
      col.values.push(value);
    });
  }

  if (xValues.length === 0) {
    return { runs: [], warnings: [`${prefix}: no numeric data rows found.`] };
  }

  const runMap = {};

  function getRun(runName) {
    if (!runMap[runName]) {
      runMap[runName] = { runName, title: runName.replace(/\.[^.]+$/i, ""), blocks: [], warnings: [] };
    }
    return runMap[runName];
  }

  function getBlock(run, meta) {
    const isXypunch = meta.family === "XYPUNCH";
    let block = run.blocks.find(b => {
      if (b.resultFamily !== meta.family || b.subcaseId !== meta.subcaseId) return false;
      if (meta.family === "ELEMENT_FORCES" && normalizeElementType(b.elementType) !== normalizeElementType(meta.elementType)) {
        return false;
      }
      if (!isXypunch) return true;
      return b.xypunchEntity === meta.entityId && normalizeTraceComponentKey(b.xypunchComp) === normalizeTraceComponentKey(meta.component);
    });
    if (!block) {
      block = createSpreadsheetBlock(
        run.blocks.length,
        run.runName,
        meta.subcaseId,
        meta.family,
        isXypunch ? { entityId: meta.entityId, comp: meta.component, kind: "XYPUNCH" } : null,
        meta.elementType
      );
      run.blocks.push(block);
    }
    return block;
  }

  for (let i = 0; i < dataColumns.length; i++) {
    const col = dataColumns[i];
    if (col.reprKey === "REAL") {
      const next = dataColumns[i + 1];
      if (!next || next.reprKey !== "IMAG" ||
          next.sourceFile !== col.sourceFile ||
          next.subcaseId !== col.subcaseId ||
          next.family !== col.family ||
          next.entityId !== col.entityId ||
          normalizeElementType(next.elementType) !== normalizeElementType(col.elementType) ||
          normalizeTraceComponentKey(next.component) !== normalizeTraceComponentKey(col.component)) {
        warnings.push(`${prefix}: skipping column ${col.col + 1} because the matching Imaginary column is missing or mismatched.`);
        continue;
      }

      const traceData = {
        x: new Float64Array(xValues),
        re: new Float64Array(col.values),
        im: new Float64Array(next.values),
        isComplex: true,
        complexRep: "REAL_IMAG",
        component: col.component,
        entityId: col.entityId,
        domain: "FREQUENCY_RESPONSE",
        storageKind: "COMPLEX",
        lockedRepr: null,
        sourceLines: [
          `$SOURCE FILE = ${col.sourceFile}`,
          `$SUBCASE ID = ${col.subcaseId}`,
          `$RESULT FAMILY = ${col.family}`,
          ...(col.elementType ? [`$ELEMENT TYPE = ${col.elementType}`] : []),
          `$ENTITY ID = ${col.entityId}`,
          `$DIRECTION = ${col.component}`,
          `$REPRESENTATION = RAW`,
        ],
      };
      const run = getRun(col.sourceFile);
      const block = getBlock(run, col);
      addSpreadsheetTrace(block, traceData, {
        entityId: col.entityId,
        component: col.component,
        elementType: col.elementType,
        storageKind: "COMPLEX",
        lockedRepr: null,
      });
      i++;
      continue;
    }

    if (col.reprKey === "IMAG") {
      warnings.push(`${prefix}: skipping column ${col.col + 1} because it is an unpaired Imaginary column.`);
      continue;
    }

    if (!col.reprKey) {
      warnings.push(`${prefix}: skipping column ${col.col + 1} with unsupported representation "${col.reprLabel}".`);
      continue;
    }

    const traceData = {
      x: new Float64Array(xValues),
      re: new Float64Array(col.values),
      im: new Float64Array(col.values.length),
      isComplex: false,
      complexRep: "UNKNOWN",
      component: col.component,
      entityId: col.entityId,
      domain: "FREQUENCY_RESPONSE",
      storageKind: "DERIVED",
      lockedRepr: col.reprKey,
        sourceLines: [
          `$SOURCE FILE = ${col.sourceFile}`,
          `$SUBCASE ID = ${col.subcaseId}`,
          `$RESULT FAMILY = ${col.family}`,
          ...(col.elementType ? [`$ELEMENT TYPE = ${col.elementType}`] : []),
          `$ENTITY ID = ${col.entityId}`,
          `$DIRECTION = ${col.component}`,
          `$REPRESENTATION = ${col.reprKey}`,
      ],
    };
    const run = getRun(col.sourceFile);
    const block = getBlock(run, col);
      addSpreadsheetTrace(block, traceData, {
        entityId: col.entityId,
        component: col.component,
        elementType: col.elementType,
        storageKind: "DERIVED",
        lockedRepr: col.reprKey,
      });
  }

  const runs = Object.values(runMap).map(run => {
    run.sourceKind = "SPREADSHEET";
    run.importFileName = fileName;
    run.importSheetName = sheetName || null;
    run.sourceRunName = run.runName;
    run.warnings.push(...warnings);
    return finalizeSpreadsheetRun(run);
  });
  runs.forEach((run, idx) => {
    run.displayName = makeSpreadsheetDisplayName(fileName, sheetName, idx, runs.length);
    run.title = run.displayName;
    run.blocks.forEach(block => {
      block.title = run.displayName;
      block.subtitle = sheetName ? `Spreadsheet Import (${sheetName})` : "Spreadsheet Import";
    });
  });
  return { runs, warnings };
}

function parseSpreadsheetText(fileName, text) {
  const result = parseSpreadsheetCsv(fileName, text, null);
  if (result.runs.length === 0) {
    throw new Error(result.warnings[0] || `${fileName}: no importable spreadsheet data found.`);
  }
  return result.runs;
}

function parseWorkbook(fileName, workbook, xlsxApi) {
  const api = xlsxApi || (typeof XLSX !== "undefined" ? XLSX : (typeof globalThis !== "undefined" ? globalThis.XLSX : null));
  if (!api || !api.utils) {
    throw new Error("XLSX reader is unavailable.");
  }
  if (!workbook || !Array.isArray(workbook.SheetNames) || !workbook.Sheets) {
    throw new Error(`${fileName}: invalid workbook data.`);
  }

  const allRuns = [];
  const workbookWarnings = [];
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      workbookWarnings.push(`${fileName} [${sheetName}]: worksheet is missing.`);
      return;
    }
    // Use sheet_to_json with header:1 to get a 2D array of native values,
    // bypassing sheet_to_csv which can produce formatting/locale issues.
    const rows = api.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true });
    const parsed = parseSpreadsheetCsv(fileName, rows, sheetName);
    if (parsed.runs.length === 0) {
      workbookWarnings.push(...parsed.warnings);
      return;
    }
    // Each sheet becomes its own run, labeled "[sheetName] fileName"
    parsed.runs.forEach((run, idx) => {
      const label = parsed.runs.length > 1
        ? `[${sheetName}] ${fileName} (${idx + 1})`
        : `[${sheetName}] ${fileName}`;
      run.runName = label;
      run.displayName = label;
      run.title = label;
      run.importFileName = fileName;
      run.importSheetName = sheetName;
      run.blocks.forEach(block => {
        block.title = label;
        block.subtitle = sheetName;
      });
    });
    allRuns.push(...parsed.runs);
  });

  if (allRuns.length === 0) {
    throw new Error(workbookWarnings[0] || `${fileName}: no importable worksheets found.`);
  }
  if (workbookWarnings.length) allRuns[0].warnings.push(...workbookWarnings);
  return allRuns;
}

// ---------------------------------------------------------------------------
// Pass 1: Block scanner
// ---------------------------------------------------------------------------

/**
 * scanBlocks
 * ----------
 * Scan the raw PCH text and partition it into BlockMeta objects.
 *
 * @param {string}   text
 * @param {string}   runName
 * @returns {{ blocks: BlockMeta[], title: string, warnings: string[] }}
 */
function scanBlocks(text, runName) {
  const rawLines = text.split(/\r?\n/);
  const blocks   = [];
  const warnings = [];

  let curTitle    = "";
  let curSubtitle = "";
  let curLabel    = "";
  let curSubcase  = 0;
  let curBlock    = null;
  let curElemType = null;
  let runTitle    = "";
  let curLineIdx  = 0; // updated each iteration so startBlock() can lookahead

  function finaliseBlock() {
    if (!curBlock) return;
    if (curBlock.resultFamily === "ELEMENT_FORCES") {
      curBlock.elementType = resolveElementForceType(curBlock);
      if (curBlock.elementType && !getElementForceDescriptor(curBlock.elementType)) {
        warnings.push(`${runName}: unsupported element force type ${curBlock.elementType} in subcase ${curBlock.subcaseId}.`);
      }
    }
    if (curBlock.sort === "UNKNOWN" && curBlock.entityIds.length > 0) {
      curBlock.sort = "SORT2";
    }
    if (curBlock.complexRep === "UNKNOWN" && curBlock.dataLines.length > 0) {
      curBlock.complexRep = inferComplexRep(curBlock);
    }
    if (curBlock.dataLines.length > 0 || curBlock.resultFamily === "XYPUNCH") {
      blocks.push(curBlock);
    }
    curBlock = null;
  }

  function startBlock(family, rawType) {
    // In SORT1 files the full header block is repeated for every frequency
    // step in the pattern:
    //   $TITLE / $SUBTITLE / $LABEL
    //   $RESULT_TYPE          <-- triggers startBlock()
    //   $REAL-IMAGINARY OUTPUT
    //   $SUBCASE ID = N       <-- comes AFTER startBlock() is called
    //   $FREQUENCY = F
    //   <data rows>
    //
    // Because $SUBCASE ID appears after the result-type header, curSubcase
    // still holds the value from the PREVIOUS frequency step when startBlock()
    // is called.  We use a lookahead into rawLines[] to find the upcoming
    // $SUBCASE ID value so we can use it as the merge key.
    let lookaheadSubcase = curSubcase;
    let lookaheadElemType = family === "ELEMENT_FORCES" ? normalizeElementType(curElemType) : null;
    if (family !== "XYPUNCH") {
      for (let j = curLineIdx + 1; j < Math.min(curLineIdx + 10, rawLines.length); j++) {
        const ahead = stripLineNumber(rawLines[j]);
        const sm = RE_SUBCASE.exec(ahead);
        if (sm) {
          lookaheadSubcase = parseInt(sm[1], 10);
          continue;
        }
        if (family === "ELEMENT_FORCES") {
          const em = RE_ELEMTYPE.exec(ahead);
          if (em) lookaheadElemType = normalizeElementType(em[1]);
        }
        // Stop looking if we hit another result-type header or data
        if (RE_RESULT.exec(ahead) || RE_FREQ.exec(ahead)) break;
      }
    }

    if (curBlock && curBlock.resultFamily === family && curBlock.subcaseId === lookaheadSubcase
        && (family !== "ELEMENT_FORCES" || normalizeElementType(curBlock.elementType) === lookaheadElemType)
        && family !== "XYPUNCH") {
      // Same block still open — just continue accumulating into it.
      return;
    }

    // Finalise whatever is currently open.
    finaliseBlock();

    // Check if the last finalised block matches (SORT1 merge).
    if (family !== "XYPUNCH" && blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      if (last.resultFamily === family && last.subcaseId === lookaheadSubcase
          && (family !== "ELEMENT_FORCES" || normalizeElementType(last.elementType) === lookaheadElemType)) {
        // Reopen the last block — remove it from the finalised list and make
        // it the current block again so we can keep appending to it.
        blocks.pop();
        curBlock = last;
        // Update mutable header fields in case they changed (they usually haven't).
        curBlock.title    = curTitle    || curBlock.title;
        curBlock.subtitle = curSubtitle || curBlock.subtitle;
        curBlock.label    = curLabel    || curBlock.label;
        if (lookaheadElemType) curBlock.elementType = lookaheadElemType;
        return;
      }
    }

    // Brand-new block.
    // Use lookaheadSubcase (not curSubcase) so that SORT1 blocks created before
    // the $SUBCASE ID line is processed get the correct subcaseId immediately.
    curBlock = {
      blockIndex:    blocks.length,
      resultFamily:  family,
      resultType:    rawType,
      domain:        "UNKNOWN",
      sort:          "UNKNOWN",
      complexRep:    "UNKNOWN",
      subcaseId:     lookaheadSubcase,
      title:         curTitle,
      subtitle:      curSubtitle,
      label:         curLabel,
      entityIds:     [],
      elementType:   lookaheadElemType,
      xypunchComp:   null,
      xypunchKind:   null,
      xypunchEntity: null,
      sourceKind:    "PCH",
      traceStore:    null,
      rawLines:      [],
      dataLines:     [],
    };
  }

  for (let i = 0; i < rawLines.length; i++) {
    curLineIdx = i;
    const rawLine = rawLines[i];
    if (!rawLine.trim()) continue;

    const line = stripLineNumber(rawLine);
    if (!line.trim()) continue;

    let m;

    // --- Header comment lines ---
    if ((m = RE_TITLE.exec(line))) {
      curTitle = m[1].trim();
      if (!runTitle) runTitle = curTitle;
      if (curBlock) curBlock.rawLines.push(line);
      continue;
    }
    if ((m = RE_SUBTITLE.exec(line))) {
      curSubtitle = m[1].trim();
      if (curBlock) curBlock.rawLines.push(line);
      continue;
    }
    if ((m = RE_LABEL.exec(line))) {
      curLabel = m[1].trim();
      if (curBlock) curBlock.rawLines.push(line);
      continue;
    }
    if ((m = RE_SUBCASE.exec(line))) {
      curSubcase = parseInt(m[1], 10);
      if (curBlock) curBlock.rawLines.push(line);
      continue;
    }

    // --- Explicit representation ---
    if (RE_REAL_IMAG.test(line)) {
      if (curBlock) { curBlock.complexRep = "REAL_IMAG"; curBlock.rawLines.push(line); }
      continue;
    }
    if (RE_MAG_PHASE.test(line)) {
      if (curBlock) { curBlock.complexRep = "MAG_PHASE"; curBlock.rawLines.push(line); }
      continue;
    }
    if (RE_REAL_ONLY.test(line)) {
      if (curBlock) { curBlock.complexRep = "REAL_ONLY"; curBlock.rawLines.push(line); }
      continue;
    }

    // --- Element type ---
    if ((m = RE_ELEMTYPE.exec(line))) {
      curElemType = normalizeElementType(m[1]);
      if (curBlock) { curBlock.elementType = curElemType; curBlock.rawLines.push(line); }
      continue;
    }

    // --- XYPUNCH block header ---
    if ((m = RE_XYPUNCH.exec(line))) {
      startBlock("XYPUNCH", "XYPUNCH");
      curBlock.xypunchKind   = m[1].toUpperCase();
      curBlock.xypunchEntity = parseInt(m[2], 10);
      curBlock.xypunchComp   = m[3].toUpperCase();
      curBlock.domain        = "FREQUENCY_RESPONSE";
      curBlock.sort          = "SORT2";
      curBlock.complexRep    = curBlock.xypunchComp.endsWith("RM") ? "MAG_PHASE" : "REAL_IMAG";
      curBlock.rawLines.push(line);
      continue;
    }

    // --- Result type header ---
    if ((m = RE_RESULT.exec(line))) {
      const rawKey = m[1].toUpperCase().replace(/\s+/g, " ");
      const family = RESULT_FAMILIES[rawKey] || rawKey;
      startBlock(family, rawKey);
      curBlock.rawLines.push(line);
      continue;
    }

    // --- SORT2 entity markers ---
    if ((m = RE_POINTID.exec(line))) {
      const pid = parseInt(m[1], 10);
      if (curBlock) {
        if (!curBlock.entityIds.includes(pid)) curBlock.entityIds.push(pid);
        curBlock.sort = "SORT2";
        curBlock.rawLines.push(line);
      }
      continue;
    }
    if ((m = RE_ELEMID_MK.exec(line))) {
      const eid = parseInt(m[1], 10);
      if (curBlock) {
        if (!curBlock.entityIds.includes(eid)) curBlock.entityIds.push(eid);
        curBlock.sort = "SORT2";
        curBlock.rawLines.push(line);
      }
      continue;
    }

    // --- SORT1 frequency/time markers ---
    if ((m = RE_FREQ.exec(line))) {
      if (curBlock) {
        curBlock.sort   = "SORT1";
        curBlock.domain = "FREQUENCY_RESPONSE";
        curBlock.rawLines.push(line);
      }
      continue;
    }
    if ((m = RE_TIME_MK.exec(line))) {
      if (curBlock) {
        curBlock.sort   = "SORT1";
        curBlock.domain = "TRANSIENT";
        curBlock.rawLines.push(line);
      }
      continue;
    }

    // --- Data rows ---
    if (curBlock) {
      curBlock.rawLines.push(line);
      const lineIdx = curBlock.rawLines.length - 1;

      // XYPUNCH: two-column rows
      if (curBlock.resultFamily === "XYPUNCH") {
        if (RE_XY_ROW.test(line)) curBlock.dataLines.push(lineIdx);
        continue;
      }

      // CONT line
      if (RE_CONT.test(line)) {
        curBlock.dataLines.push(lineIdx);
        continue;
      }

      // Element force rows (no G flag) — only in ELEMENT_FORCES blocks
      if (curBlock.resultFamily === "ELEMENT_FORCES") {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("$") && /^[\d.Ee+\-]/.test(trimmed)) {
          curBlock.dataLines.push(lineIdx);
          const row = parseElementForceRow(line);
          if (row) {
            if (row.entityId !== null && !curBlock.entityIds.includes(row.entityId)) {
              curBlock.entityIds.push(row.entityId);
            }
            if (row.elementType && !curBlock.elementType) {
              curBlock.elementType = row.elementType;
            }
          }
          continue;
        }
      }

      // Grid-point rows (all three formats)
      const gr = classifyGridRow(line);
      if (gr && gr.type !== "CONT") {
        curBlock.dataLines.push(lineIdx);
        // Collect entity IDs from FORMAT_B and FORMAT_C rows
        if ((gr.type === "FORMAT_B" || gr.type === "FORMAT_C") && gr.entityId !== null) {
          if (!curBlock.entityIds.includes(gr.entityId)) {
            curBlock.entityIds.push(gr.entityId);
          }
        }
        continue;
      }

      // Synthetic indented imaginary row (FORMAT_C second row)
      const ir = classifyIndentedRow(line);
      if (ir) {
        curBlock.dataLines.push(lineIdx);
        continue;
      }
    }
  }

  finaliseBlock();

  // Post-process
  for (const blk of blocks) {
    if (blk.domain === "UNKNOWN" && blk.dataLines.length > 0) {
      blk.domain = inferDomain(blk);
    }
    if (blk.complexRep === "UNKNOWN" && blk.dataLines.length > 0) {
      blk.complexRep = inferComplexRep(blk);
    }
  }

  return { blocks, title: runTitle, warnings };
}

// ---------------------------------------------------------------------------
// Inference helpers
// ---------------------------------------------------------------------------

/**
 * inferDomain
 * @param {BlockMeta} blk
 * @returns {string}
 */
function inferDomain(blk) {
  // First check: look for explicit $FREQUENCY or $TIME markers in rawLines
  for (const line of blk.rawLines) {
    if (RE_FREQ.test(line)) return "FREQUENCY_RESPONSE";
    if (RE_TIME_MK.test(line)) return "TRANSIENT";
  }

  // Second check: examine data row x-values
  for (let i = 0; i < Math.min(10, blk.dataLines.length); i++) {
    const line = blk.rawLines[blk.dataLines[i]];
    const gr = classifyGridRow(line);
    if (gr) {
      const x = gr.xValue;
      if (x !== null) return x > 0.5 ? "FREQUENCY_RESPONSE" : "TRANSIENT";
    }
    const xym = RE_XY_ROW.exec(line);
    if (xym) return parseFloat(xym[1]) > 0.5 ? "FREQUENCY_RESPONSE" : "TRANSIENT";

    const elemRow = parseElementForceRow(line);
    if (elemRow && elemRow.xValue !== null) {
      return elemRow.xValue > 0.5 ? "FREQUENCY_RESPONSE" : "TRANSIENT";
    }
  }
  return "UNKNOWN";
}

/**
 * inferComplexRep
 * ---------------
 * Distinguish REAL_IMAG from MAG_PHASE by scanning data row pairs.
 *
 * Strategy:
 *   - For FORMAT_A/B (real MSC, 4 CONT lines): check if any first-row DOF value
 *     is negative → REAL_IMAG; check if all CONT-3 values are in [-360,360] → MAG_PHASE.
 *   - For FORMAT_C (synthetic, indented second row): check if any first-row DOF
 *     value is negative → REAL_IMAG.
 *
 * @param {BlockMeta} blk
 * @returns {string}
 */
function inferComplexRep(blk) {
  if (blk.resultFamily === "ELEMENT_FORCES") {
    const descriptor = getElementForceDescriptor(resolveElementForceType(blk));
    if (!descriptor) return "UNKNOWN";

    let foundAnyPair = false;
    let allFirstNonNeg = true;
    let allSecondInRange = true;

    for (let i = 0; i < blk.dataLines.length; i++) {
      const line = blk.rawLines[blk.dataLines[i]];
      const row = parseElementForceRow(line);
      if (!row || row.values.length === 0) continue;

      if (row.values.some(v => v < 0)) return "REAL_IMAG";
      if (row.values.some(v => v < 0)) allFirstNonNeg = false;

      if (descriptor.kind === "SCALAR") {
        if (row.values.length >= 2) {
          foundAnyPair = true;
          if (Math.abs(row.values[1]) > 360) allSecondInRange = false;
        }
        continue;
      }

      const cont1Idx = i + 1 < blk.dataLines.length ? blk.dataLines[i + 1] : null;
      const cont2Idx = i + 2 < blk.dataLines.length ? blk.dataLines[i + 2] : null;
      if (cont1Idx === null || cont2Idx === null) continue;

      const cont1Match = RE_CONT.exec(blk.rawLines[cont1Idx]);
      const cont2Match = RE_CONT.exec(blk.rawLines[cont2Idx]);
      if (!cont1Match || !cont2Match) continue;

      const firstContVals = normalizeElementContValues(parseFloats(cont1Match[1]), 3);
      const secondContVals = normalizeElementContValues(parseFloats(cont2Match[1]), 3);
      if (firstContVals.some(v => v < 0)) return "REAL_IMAG";
      foundAnyPair = true;
      if (secondContVals.some(v => Math.abs(v) > 360)) allSecondInRange = false;
    }

    if (!foundAnyPair) return "UNKNOWN";
    if (allFirstNonNeg && allSecondInRange) return "MAG_PHASE";
    return "REAL_IMAG";
  }

  let foundAnyPair   = false;
  let allFirstNonNeg = true;
  let allSecondInRange = true;

  const lines = blk.rawLines;
  const dls   = blk.dataLines;

  for (let i = 0; i < dls.length - 1; i++) {
    const line1 = lines[dls[i]];
    const gr1   = classifyGridRow(line1);
    if (!gr1 || gr1.type === "CONT") continue;

    // Check first-row DOF values for negativity
    if (gr1.vals.some(v => v < 0)) {
      return "REAL_IMAG"; // early exit
    }

    // Look at the next data line
    if (i + 1 >= dls.length) continue;
    const line2 = lines[dls[i + 1]];
    const gr2   = classifyGridRow(line2);
    const ir2   = classifyIndentedRow(line2);

    if (gr2 && gr2.type === "CONT") {
      // FORMAT A/B: first CONT = DOFs 4-6 of component A
      foundAnyPair = true;
      if (gr2.vals.some(v => v < 0)) return "REAL_IMAG";

      // Check 3rd CONT line (DOFs 1-3 of component B = imag or phase)
      if (i + 2 < dls.length) {
        const line3 = lines[dls[i + 2]];
        const gr3 = classifyGridRow(line3);
        if (gr3 && gr3.type === "CONT") {
          if (gr3.vals.some(v => Math.abs(v) > 360)) allSecondInRange = false;
        }
      }
    } else if (ir2) {
      // FORMAT C: indented second row
      foundAnyPair = true;
      // vals[0] is 0 placeholder; vals[1..] are imaginary values
      const imVals = ir2.vals.slice(1);
      if (imVals.some(v => Math.abs(v) > 360)) allSecondInRange = false;
    }
  }

  if (!foundAnyPair) return "UNKNOWN";
  if (allFirstNonNeg && allSecondInRange) return "MAG_PHASE";
  return "REAL_IMAG";
}

// ---------------------------------------------------------------------------
// Pass 2: Numeric extraction
// ---------------------------------------------------------------------------

/**
 * extractTraceData
 * ----------------
 * @param {BlockMeta} block
 * @param {number}    entityId
 * @param {string}    component
 * @returns {TraceData|null}
 */
function extractTraceData(block, entityId, component) {
  if (block && block.traceStore) {
    return block.traceStore[makeTraceStoreKey(entityId, component)] || null;
  }
  if (block.resultFamily === "XYPUNCH") {
    return extractXYPunch(block, entityId, component);
  }
  if (block.resultFamily === "ELEMENT_FORCES") {
    return extractElementForces(block, entityId, component);
  }
  return extractGridVector(block, entityId, component);
}

// ---------------------------------------------------------------------------
// Grid vector extraction
// ---------------------------------------------------------------------------

/**
 * extractGridVector
 * -----------------
 * Extract a single component series from a grid-vector block.
 * Handles all three row formats (A, B, C) and both SORT1/SORT2.
 *
 * @param {BlockMeta} block
 * @param {number}    entityId
 * @param {string}    component
 * @returns {TraceData|null}
 */
function extractGridVector(block, entityId, component) {
  const compKey = component.charAt(0).toUpperCase() + component.slice(1);
  const compIdx = COMPONENT_INDEX[compKey] !== undefined
    ? COMPONENT_INDEX[compKey]
    : COMPONENT_INDEX[component.toUpperCase()];
  if (compIdx === undefined) return null;

  const xArr     = [];
  const reArr    = [];
  const imArr    = [];
  const srcLines = [];

  const lines      = block.rawLines;
  const isSort2    = block.sort === "SORT2";
  const isRealOnly = block.complexRep === "REAL_ONLY";

  if (isSort2) {
    // -----------------------------------------------------------------------
    // SORT2 extraction
    // -----------------------------------------------------------------------
    let inEntity = false;

    // State machine for multi-CONT records (FORMAT A) and synthetic 2-row (FORMAT C)
    // States: IDLE | GOT_ROW1 | GOT_CONT1 | GOT_CONT2
    let state    = "IDLE";
    let pendingX = 0;
    let pendingA = [0, 0, 0, 0, 0, 0]; // component A (real or magnitude)
    let pendingB = [0, 0, 0, 0, 0, 0]; // component B (imaginary or phase)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Entity marker (SORT2)
      const pm = RE_POINTID.exec(line);
      if (pm) {
        inEntity = (parseInt(pm[1], 10) === entityId);
        state = "IDLE";
        continue;
      }

      if (!inEntity) continue;

      const gr = classifyGridRow(line);

      if (gr && gr.type === "FORMAT_A") {
        // Real-only blocks can end a record with just row1 (or row1+CONT1).
        if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(0);
        }
        // Real MSC SORT2: x-value first
        pendingX    = gr.xValue;
        pendingA[0] = gr.vals[0] || 0;
        pendingA[1] = gr.vals[1] || 0;
        pendingA[2] = gr.vals[2] || 0;
        pendingA[3] = 0; pendingA[4] = 0; pendingA[5] = 0;
        pendingB    = [0, 0, 0, 0, 0, 0];
        state = "GOT_ROW1";
        srcLines.push(line);
        continue;
      }

      if (gr && gr.type === "FORMAT_C" && gr.entityId === entityId) {
        if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(0);
        }
        // Synthetic SORT2: entity ID + x in same row
        pendingX    = gr.xValue;
        pendingA[0] = gr.vals[0] || 0;
        pendingA[1] = gr.vals[1] || 0;
        pendingA[2] = gr.vals[2] || 0;
        pendingA[3] = 0; pendingA[4] = 0; pendingA[5] = 0;
        pendingB    = [0, 0, 0, 0, 0, 0];
        state = "GOT_ROW1";
        srcLines.push(line);
        continue;
      }

      if (gr && gr.type === "CONT" && state !== "IDLE") {
        const vals = gr.vals;
        if (state === "GOT_ROW1") {
          // CONT 1: DOFs 4-6 of component A
          pendingA[3] = vals[0] || 0;
          pendingA[4] = vals[1] || 0;
          pendingA[5] = vals[2] || 0;
          srcLines.push(line);
          if (isRealOnly) {
            xArr.push(pendingX);
            reArr.push(pendingA[compIdx]);
            imArr.push(0);
            state = "IDLE";
          } else {
            state = "GOT_CONT1";
          }
        } else if (state === "GOT_CONT1") {
          // CONT 2: DOFs 1-3 of component B
          pendingB[0] = vals[0] || 0;
          pendingB[1] = vals[1] || 0;
          pendingB[2] = vals[2] || 0;
          state = "GOT_CONT2";
          srcLines.push(line);
        } else if (state === "GOT_CONT2") {
          // CONT 3: DOFs 4-6 of component B — record complete
          pendingB[3] = vals[0] || 0;
          pendingB[4] = vals[1] || 0;
          pendingB[5] = vals[2] || 0;
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(pendingB[compIdx]);
          srcLines.push(line);
          state = "IDLE";
        }
        continue;
      }

      // Synthetic indented imaginary row (FORMAT C second row)
      if (state === "GOT_ROW1") {
        const ir = classifyIndentedRow(line);
        if (ir) {
          // vals: [0_placeholder, im1, im2, im3] or [im1, im2, im3]
          const imVals = ir.vals[0] === 0 ? ir.vals.slice(1) : ir.vals;
          pendingB[0] = imVals[0] || 0;
          pendingB[1] = imVals[1] || 0;
          pendingB[2] = imVals[2] || 0;
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(pendingB[compIdx]);
          srcLines.push(line);
          state = "IDLE";
          continue;
        }
      }

      // Any other grid row resets state (different entity or new record)
      if (gr && (gr.type === "FORMAT_A" || gr.type === "FORMAT_C")) {
        state = "IDLE";
      }
    }
    if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
      xArr.push(pendingX);
      reArr.push(pendingA[compIdx]);
      imArr.push(0);
      state = "IDLE";
    }

  } else {
    // -----------------------------------------------------------------------
    // SORT1 extraction
    // -----------------------------------------------------------------------
    let lastFreq = null;
    let state    = "IDLE";
    let pendingX = 0;
    let pendingA = [0, 0, 0, 0, 0, 0];
    let pendingB = [0, 0, 0, 0, 0, 0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Frequency/time marker
      const fm = RE_FREQ.exec(line);
      if (fm) { lastFreq = parseFloat(fm[1]); state = "IDLE"; continue; }
      const tm = RE_TIME_MK.exec(line);
      if (tm) { lastFreq = parseFloat(tm[1]); state = "IDLE"; continue; }

      const gr = classifyGridRow(line);

      if (gr && gr.type === "FORMAT_B" && gr.entityId === entityId) {
        if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(0);
        }
        // Real MSC SORT1: entity ID first, x from $FREQUENCY
        pendingX    = lastFreq !== null ? lastFreq : 0;
        pendingA[0] = gr.vals[0] || 0;
        pendingA[1] = gr.vals[1] || 0;
        pendingA[2] = gr.vals[2] || 0;
        pendingA[3] = 0; pendingA[4] = 0; pendingA[5] = 0;
        pendingB    = [0, 0, 0, 0, 0, 0];
        state = "GOT_ROW1";
        srcLines.push(line);
        continue;
      }

      if (gr && gr.type === "FORMAT_C" && gr.entityId === entityId) {
        if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(0);
        }
        // Synthetic SORT1: entity ID + x in same row
        pendingX    = gr.xValue;
        pendingA[0] = gr.vals[0] || 0;
        pendingA[1] = gr.vals[1] || 0;
        pendingA[2] = gr.vals[2] || 0;
        pendingA[3] = 0; pendingA[4] = 0; pendingA[5] = 0;
        pendingB    = [0, 0, 0, 0, 0, 0];
        state = "GOT_ROW1";
        srcLines.push(line);
        continue;
      }

      if (gr && gr.type === "CONT" && state !== "IDLE") {
        const vals = gr.vals;
        if (state === "GOT_ROW1") {
          pendingA[3] = vals[0] || 0;
          pendingA[4] = vals[1] || 0;
          pendingA[5] = vals[2] || 0;
          srcLines.push(line);
          if (isRealOnly) {
            xArr.push(pendingX);
            reArr.push(pendingA[compIdx]);
            imArr.push(0);
            state = "IDLE";
          } else {
            state = "GOT_CONT1";
          }
        } else if (state === "GOT_CONT1") {
          pendingB[0] = vals[0] || 0;
          pendingB[1] = vals[1] || 0;
          pendingB[2] = vals[2] || 0;
          state = "GOT_CONT2";
          srcLines.push(line);
        } else if (state === "GOT_CONT2") {
          pendingB[3] = vals[0] || 0;
          pendingB[4] = vals[1] || 0;
          pendingB[5] = vals[2] || 0;
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(pendingB[compIdx]);
          srcLines.push(line);
          state = "IDLE";
        }
        continue;
      }

      // Synthetic indented imaginary row
      if (state === "GOT_ROW1") {
        const ir = classifyIndentedRow(line);
        if (ir) {
          const imVals = ir.vals[0] === 0 ? ir.vals.slice(1) : ir.vals;
          pendingB[0] = imVals[0] || 0;
          pendingB[1] = imVals[1] || 0;
          pendingB[2] = imVals[2] || 0;
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(pendingB[compIdx]);
          srcLines.push(line);
          state = "IDLE";
          continue;
        }
      }

      // Different entity row resets state
      if (gr && (gr.type === "FORMAT_B" || gr.type === "FORMAT_C") &&
          gr.entityId !== null && gr.entityId !== entityId) {
        if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
          xArr.push(pendingX);
          reArr.push(pendingA[compIdx]);
          imArr.push(0);
        }
        state = "IDLE";
      }
    }
    if (isRealOnly && (state === "GOT_ROW1" || state === "GOT_CONT1")) {
      xArr.push(pendingX);
      reArr.push(pendingA[compIdx]);
      imArr.push(0);
      state = "IDLE";
    }
  }

  // Transient fallback: if no imaginary data found, collect real-only
  if (xArr.length === 0 && block.domain === "TRANSIENT") {
    const inEntitySet = new Set();
    let inEntity2 = false;
    for (const line of lines) {
      const pm = RE_POINTID.exec(line);
      if (pm) { inEntity2 = parseInt(pm[1], 10) === entityId; continue; }
      if (!inEntity2 && block.sort === "SORT2") continue;
      const gr = classifyGridRow(line);
      if (!gr || gr.type === "CONT") continue;
      if (gr.type === "FORMAT_C" && gr.entityId !== entityId) continue;
      if (gr.type === "FORMAT_B" && gr.entityId !== entityId) continue;
      const x = gr.xValue !== null ? gr.xValue : 0;
      if (gr.vals.length > compIdx) {
        xArr.push(x);
        reArr.push(gr.vals[compIdx] || 0);
        imArr.push(0);
        srcLines.push(line);
      }
    }
  }

  if (xArr.length === 0) return null;

  return {
    x:          new Float64Array(xArr),
    re:         new Float64Array(reArr),
    im:         new Float64Array(imArr),
    isComplex:  block.domain === "FREQUENCY_RESPONSE",
    complexRep: block.complexRep !== "UNKNOWN" ? block.complexRep : "REAL_IMAG",
    component,
    entityId,
    domain:     block.domain,
    storageKind: "COMPLEX",
    lockedRepr: null,
    sourceLines: srcLines,
  };
}

// ---------------------------------------------------------------------------
// XYPUNCH extraction
// ---------------------------------------------------------------------------

/**
 * extractXYPunch
 * @param {BlockMeta} block
 * @param {number}    entityId
 * @param {string}    component
 * @returns {TraceData|null}
 */
function extractXYPunch(block, entityId, component) {
  if (block.xypunchEntity !== entityId) return null;
  const compNorm = component.toUpperCase();
  const blkComp  = (block.xypunchComp || "").toUpperCase();
  if (blkComp !== compNorm && !blkComp.endsWith(compNorm) && !compNorm.endsWith(blkComp)) {
    return null;
  }

  const xArr = [], yArr = [], srcLines = [];
  for (const lineIdx of block.dataLines) {
    const line = block.rawLines[lineIdx];
    const m = RE_XY_ROW.exec(line);
    if (m) {
      xArr.push(parseFloat(m[1]));
      yArr.push(parseFloat(m[2]));
      srcLines.push(line);
    }
  }
  if (xArr.length === 0) return null;

  const isRM = blkComp.endsWith("RM");
  return {
    x:          new Float64Array(xArr),
    re:         new Float64Array(yArr),
    im:         new Float64Array(yArr.length),
    isComplex:  false,
    complexRep: isRM ? "MAG_PHASE" : "REAL_IMAG",
    component:  blkComp,
    entityId,
    domain:     "FREQUENCY_RESPONSE",
    storageKind: "COMPLEX",
    lockedRepr: null,
    sourceLines: srcLines,
  };
}

// ---------------------------------------------------------------------------
// Element force extraction (CBUSH / CELAS1-4)
// ---------------------------------------------------------------------------

/**
 * extractElementForces
 * --------------------
 * Extract element force component from a CBUSH or CELAS block.
 *
 * CBUSH layout (real MSC, 4 CONT lines):
 *   "<freq>  F1_re  F2_re  F3_re"
 *   "-CONT-  M1_re  M2_re  M3_re"
 *   "-CONT-  F1_im  F2_im  F3_im"
 *   "-CONT-  M1_im  M2_im  M3_im"
 *
 * CELAS layout (2 values only):
 *   "<freq>  F_re  F_im"
 *
 * @param {BlockMeta} block
 * @param {number}    entityId
 * @param {string}    component
 * @returns {TraceData|null}
 */
function extractElementForces(block, entityId, component) {
  const elementType = resolveElementForceType(block);
  const descriptor = getElementForceDescriptor(elementType);
  if (!descriptor) return null;

  const compKey = component.toUpperCase();
  if (!descriptor.components.includes(compKey)) return null;

  const compIdx = COMPONENT_INDEX[compKey];
  if (compIdx === undefined) return null;

  const xArr = [], reArr = [], imArr = [], srcLines = [];
  const lines   = block.rawLines;
  const isSort2 = block.sort === "SORT2";
  let inEntity  = !isSort2; // SORT1: always in entity (filter by row); SORT2: use marker
  let lastFreq  = null;     // SORT1: x from $FREQUENCY
  let state     = "IDLE";
  let pendingX  = 0;
  let pendingRe = [0, 0, 0, 0, 0, 0];
  let pendingIm = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Frequency/time markers (SORT1)
    const fm = RE_FREQ.exec(line);
    if (fm) { lastFreq = parseFloat(fm[1]); state = "IDLE"; continue; }
    const tm = RE_TIME_MK.exec(line);
    if (tm) { lastFreq = parseFloat(tm[1]); state = "IDLE"; continue; }

    // Entity marker (SORT2 only)
    if (isSort2) {
      const em = RE_ELEMID_MK.exec(line);
      if (em) {
        inEntity = (parseInt(em[1], 10) === entityId);
        state = "IDLE";
        continue;
      }
    }

    if (!inEntity && isSort2) continue;

    // CONT line
    const cm = RE_CONT.exec(line);
    if (cm && state !== "IDLE") {
      const vals = normalizeElementContValues(parseFloats(cm[1]), 3);
      if (state === "GOT_ROW1") {
        pendingRe[3] = vals[0] || 0;
        pendingRe[4] = vals[1] || 0;
        pendingRe[5] = vals[2] || 0;
        state = "GOT_CONT1";
        srcLines.push(line);
      } else if (state === "GOT_CONT1") {
        pendingIm[0] = vals[0] || 0;
        pendingIm[1] = vals[1] || 0;
        pendingIm[2] = vals[2] || 0;
        state = "GOT_CONT2";
        srcLines.push(line);
      } else if (state === "GOT_CONT2") {
        pendingIm[3] = vals[0] || 0;
        pendingIm[4] = vals[1] || 0;
        pendingIm[5] = vals[2] || 0;
        xArr.push(pendingX);
        reArr.push(pendingRe[compIdx]);
        imArr.push(pendingIm[compIdx]);
        srcLines.push(line);
        state = "IDLE";
      }
      continue;
    }

    // Synthetic indented imaginary row (after GOT_CONT1: imaginary DOFs 1-3)
    // Format: "                         0.000000E+00  im1  im2  im3"
    if (state === "GOT_CONT1") {
      const ir = classifyIndentedRow(line);
      if (ir) {
        // vals: [0_placeholder, im1, im2, im3]
        const imVals = ir.vals[0] === 0 ? ir.vals.slice(1) : ir.vals;
        pendingIm[0] = imVals[0] || 0;
        pendingIm[1] = imVals[1] || 0;
        pendingIm[2] = imVals[2] || 0;
        state = "GOT_CONT2";
        srcLines.push(line);
        continue;
      }
    }

    // Main element row — three formats:
    //   Format 1 (Synthetic):  "<entityId>  <TYPE>  <freq>  v1  v2  v3"  (entity ID + type keyword + freq)
    //   Format 2 (Real SORT2): "<freq>  v1  v2  v3"                       (float frequency first)
    //   Format 3 (Real SORT1): "<entityId>  v1  v2  v3"                   (plain integer entity ID first, x from $FREQUENCY)
    const row = parseElementForceRow(line);
    if (!row || !row.values || row.values.length < 1) continue;
    if (row.elementType && row.elementType !== elementType) { state = "IDLE"; continue; }
    if (row.entityId !== null && row.entityId !== entityId) { state = "IDLE"; continue; }

    let freq = row.xValue;
    if (row.entityId !== null && row.xValue === null) {
      freq = lastFreq !== null ? lastFreq : 0;
    }
    if (freq === null || isNaN(freq)) continue;

    const dataVals = row.values;

    pendingX      = freq;
    pendingRe[0]  = dataVals[0] || 0;
    pendingRe[1]  = dataVals[1] || 0;
    pendingRe[2]  = dataVals[2] || 0;
    pendingRe[3]  = 0; pendingRe[4] = 0; pendingRe[5] = 0;
    pendingIm     = [0, 0, 0, 0, 0, 0];

    // CELAS: only 2 data values (re, im) — emit immediately
    if (descriptor.kind === "SCALAR") {
      if (dataVals.length < 2) continue;
      xArr.push(freq);
      reArr.push(dataVals[0]);
      imArr.push(dataVals[1]);
      srcLines.push(line);
      state = "IDLE";
      continue;
    }

    state = "GOT_ROW1";
    srcLines.push(line);
  }

  if (xArr.length === 0) return null;

  return {
    x:          new Float64Array(xArr),
    re:         new Float64Array(reArr),
    im:         new Float64Array(imArr),
    isComplex:  true,
    complexRep: block.complexRep !== "UNKNOWN" ? block.complexRep : "REAL_IMAG",
    component,
    entityId,
    domain:     block.domain,
    storageKind: "COMPLEX",
    lockedRepr: null,
    sourceLines: srcLines,
  };
}

// ---------------------------------------------------------------------------
// Derived representation transforms
// ---------------------------------------------------------------------------

/**
 * computeRepresentation
 * ---------------------
 * Compute the requested plot representation from stored (re, im) data.
 *
 * @param {TraceData} td
 * @param {string}    repr - "MAGNITUDE"|"DB"|"REAL"|"IMAG"|"PHASE"|"PHASE_UNWRAPPED"
 * @returns {{ x: number[], y: number[] }}
 */
function computeRepresentation(td, repr) {
  const n   = td.x.length;
  const x   = Array.from(td.x);
  const y   = new Array(n);

  if (td.storageKind === "DERIVED") {
    for (let i = 0; i < n; i++) y[i] = td.re[i];
    return {
      x,
      y,
      effectiveRepr: td.lockedRepr || repr,
      requestedRepr: repr,
      isLocked: !!td.lockedRepr && td.lockedRepr !== repr,
    };
  }

  const isMAP = td.complexRep === "MAG_PHASE";

  function getRe(i)  { return isMAP ? td.re[i] * Math.cos(td.im[i] * Math.PI / 180) : td.re[i]; }
  function getIm(i)  { return isMAP ? td.re[i] * Math.sin(td.im[i] * Math.PI / 180) : td.im[i]; }
  function getMag(i) { return isMAP ? Math.abs(td.re[i]) : Math.sqrt(td.re[i]*td.re[i] + td.im[i]*td.im[i]); }
  function getPhase(i) {
    if (isMAP) {
      let p = td.im[i] % 360;
      if (p > 180) p -= 360;
      if (p <= -180) p += 360;
      return p;
    }
    return Math.atan2(td.im[i], td.re[i]) * 180 / Math.PI;
  }

  switch (repr) {
    case "MAGNITUDE":
      for (let i = 0; i < n; i++) y[i] = getMag(i);
      break;
    case "DB":
      for (let i = 0; i < n; i++) { const m = getMag(i); y[i] = m > 0 ? 20*Math.log10(m) : null; }
      break;
    case "REAL":
      for (let i = 0; i < n; i++) y[i] = getRe(i);
      break;
    case "IMAG":
      for (let i = 0; i < n; i++) y[i] = getIm(i);
      break;
    case "PHASE":
      for (let i = 0; i < n; i++) y[i] = getPhase(i);
      break;
    case "PHASE_UNWRAPPED": {
      let prev = getPhase(0);
      y[0] = prev;
      for (let i = 1; i < n; i++) {
        const curr = getPhase(i);
        let diff = curr - prev;
        while (diff >  180) diff -= 360;
        while (diff < -180) diff += 360;
        prev += diff;
        y[i] = prev;
      }
      break;
    }
    default:
      for (let i = 0; i < n; i++) y[i] = getMag(i);
  }

  return { x, y, effectiveRepr: repr, requestedRepr: repr, isLocked: false };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * parsePCH
 * --------
 * @param {string} text
 * @param {string} runName
 * @returns {RunData}
 */
function parsePCH(text, runName) {
  const { blocks, title, warnings } = scanBlocks(text, runName);
  return { runName, title, blocks, warnings };
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

const PCHParser = {
  parsePCH,
  parseSpreadsheetText,
  parseWorkbook,
  extractTraceData,
  computeRepresentation,
  componentLabels,
  componentLabelsForBlock,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PCHParser;
} else if (typeof window !== "undefined") {
  window.PCHParser = PCHParser;
}
