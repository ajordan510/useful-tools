/**
 * test_parser.js
 * ==============
 * Node.js validation tests for pch_parser.js against the bundled fixtures.
 *
 * Run: node test_parser.js
 *
 * Each test asserts:
 *   - Correct number of blocks parsed
 *   - Correct result families detected
 *   - Correct SORT type
 *   - Correct domain (FREQUENCY_RESPONSE / TRANSIENT)
 *   - Correct entity IDs found
 *   - extractTraceData returns non-null with correct array length
 *   - computeRepresentation returns finite values for all representations
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Load parser (Node.js module.exports path)
const PCHParser = require("./pch_parser.js");

const FIXTURES = path.join(__dirname, "test_fixtures");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓  ${msg}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${msg}`);
    failed++;
  }
}

function assertEqual(a, b, msg) {
  assert(a === b, `${msg} (expected ${b}, got ${a})`);
}

function assertGt(a, b, msg) {
  assert(a > b, `${msg} (${a} > ${b})`);
}

function assertIncludes(text, fragment, msg) {
  assert(String(text).includes(fragment), `${msg} (expected to include "${fragment}")`);
}

function assertThrows(fn, fragment, msg) {
  try {
    fn();
    assert(false, `${msg}: expected an exception`);
  } catch (err) {
    if (fragment) assertIncludes(err.message, fragment, msg);
    else assert(true, msg);
  }
}

function loadAndParse(filename) {
  const text = fs.readFileSync(path.join(FIXTURES, filename), "utf8");
  return PCHParser.parsePCH(text, filename);
}

function loadSpreadsheet(filename) {
  return fs.readFileSync(path.join(FIXTURES, filename), "utf8");
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function checkTraceExtraction(run, blockIdx, entityId, component, expectedLen, label) {
  const block = run.blocks[blockIdx];
  const td = PCHParser.extractTraceData(block, entityId, component);
  assert(td !== null, `${label}: extractTraceData returns non-null`);
  if (td) {
    assertEqual(td.x.length, expectedLen, `${label}: x array length`);
    assertEqual(td.re.length, expectedLen, `${label}: re array length`);
    assert(isFinite(td.x[0]), `${label}: x[0] is finite`);
    assert(isFinite(td.re[0]), `${label}: re[0] is finite`);
  }
}

function checkAllReprs(run, blockIdx, entityId, component, label) {
  const block = run.blocks[blockIdx];
  const td = PCHParser.extractTraceData(block, entityId, component);
  if (!td) { assert(false, `${label}: trace data null, cannot check reprs`); return; }
  for (const repr of ["REAL","IMAG","MAGNITUDE","PHASE","PHASE_UNWRAPPED","DB"]) {
    const { y } = PCHParser.computeRepresentation(td, repr);
    const finite = Array.from(y).filter(v => isFinite(v)).length;
    assertGt(finite, 0, `${label}: ${repr} has at least one finite value`);
  }
}

function csvRow(cells) {
  return cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
}

function buildSpreadsheetCsv(columns, dataRows) {
  const includeElementType = columns.some(c => Object.prototype.hasOwnProperty.call(c, "elementType"));
  const metaRows = [
    ["Source File", ...columns.map(c => c.sourceFile)],
    ["Subcase", ...columns.map(c => `SC ${c.subcaseId}`)],
    ["Result Family", ...columns.map(c => c.family)],
    ["Entity ID", ...columns.map(c => `ID ${c.entityId}`)],
    ["Direction", ...columns.map(c => c.component)],
  ];
  if (includeElementType) {
    metaRows.push(["Element Type", ...columns.map(c => c.elementType || "")]);
  }
  metaRows.push(["Representation", ...columns.map(c => c.reprLabel)]);
  const header = ["Frequency_Hz", ...columns.map(c => c.header)];
  const lines = metaRows.map(csvRow);
  lines.push("");
  lines.push(csvRow(header));
  dataRows.forEach(row => lines.push(row.join(",")));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Spreadsheet import: element-force metadata round-trip
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: element-force round-trip ===");
{
  const csv = buildSpreadsheetCsv(
    [
      { sourceFile: "forces_roundtrip.pch", subcaseId: 9, family: "ELEMENT_FORCES", entityId: 7001, component: "F1", elementType: "CBUSH", reprLabel: "Real", header: "forces_roundtrip.pch|SC9|ID7001|F1|Re" },
      { sourceFile: "forces_roundtrip.pch", subcaseId: 9, family: "ELEMENT_FORCES", entityId: 7001, component: "F1", elementType: "CBUSH", reprLabel: "Imaginary", header: "forces_roundtrip.pch|SC9|ID7001|F1|Im" },
      { sourceFile: "forces_roundtrip.pch", subcaseId: 9, family: "ELEMENT_FORCES", entityId: 8001, component: "F", elementType: "CELAS2", reprLabel: "Real", header: "forces_roundtrip.pch|SC9|ID8001|F|Re" },
      { sourceFile: "forces_roundtrip.pch", subcaseId: 9, family: "ELEMENT_FORCES", entityId: 8001, component: "F", elementType: "CELAS2", reprLabel: "Imaginary", header: "forces_roundtrip.pch|SC9|ID8001|F|Im" },
    ],
    [
      ["5.0", "10", "1", "20", "2"],
      ["10.0", "30", "3", "40", "4"],
    ]
  );
  const runs = PCHParser.parseSpreadsheetText("forces_roundtrip.csv", csv);
  assertEqual(runs.length, 1, "Element-force round-trip import returns one run");
  const efBlocks = runs[0].blocks.filter(b => b.resultFamily === "ELEMENT_FORCES");
  assertEqual(efBlocks.length, 2, "Element-force round-trip splits CBUSH and CELAS blocks");
  const cbush = efBlocks.find(b => b.elementType === "CBUSH");
  const celas = efBlocks.find(b => b.elementType === "CELAS2");
  assert(cbush !== undefined, "Round-trip import preserves CBUSH element type");
  assert(celas !== undefined, "Round-trip import preserves CELAS2 element type");
  if (cbush) {
    assertEqual(PCHParser.componentLabelsForBlock(cbush).join(","), "F1,F2,F3,M1,M2,M3", "CBUSH spreadsheet block exposes six components");
    assert(PCHParser.extractTraceData(cbush, 7001, "F1") !== null, "CBUSH spreadsheet trace extracts");
  }
  if (celas) {
    assertEqual(PCHParser.componentLabelsForBlock(celas).join(","), "F", "CELAS spreadsheet block exposes scalar F");
    assert(PCHParser.extractTraceData(celas, 8001, "F") !== null, "CELAS spreadsheet trace extracts");
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet import: legacy element-force CSV without element type row
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: legacy element-force import ===");
{
  const csv = buildSpreadsheetCsv(
    [
      { sourceFile: "legacy_forces.pch", subcaseId: 4, family: "ELEMENT_FORCES", entityId: 8101, component: "F", reprLabel: "Real", header: "legacy_forces.pch|SC4|ID8101|F|Re" },
      { sourceFile: "legacy_forces.pch", subcaseId: 4, family: "ELEMENT_FORCES", entityId: 8101, component: "F", reprLabel: "Imaginary", header: "legacy_forces.pch|SC4|ID8101|F|Im" },
    ],
    [
      ["1.0", "5", "0.5"],
      ["2.0", "6", "0.6"],
    ]
  );
  const runs = PCHParser.parseSpreadsheetText("legacy_forces.csv", csv);
  const block = runs[0].blocks[0];
  assertEqual(block.elementType, "CELAS", "Legacy element-force import infers generic CELAS type from scalar F component");
  assertEqual(PCHParser.componentLabelsForBlock(block).join(","), "F", "Legacy element-force import exposes scalar F");
  assert(PCHParser.extractTraceData(block, 8101, "F") !== null, "Legacy element-force trace extracts");
}

// ---------------------------------------------------------------------------
// Spreadsheet import: bundled example fixture
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: bundled export example ===");
{
  const csv = loadSpreadsheet("pch_export_example.csv");
  const runs = PCHParser.parseSpreadsheetText("pch_export_example.csv", csv);
  assertEqual(runs.length, 2, "Bundled export example splits into two internal runs");
  runs.forEach((run, idx) => {
    assertIncludes(run.displayName, "pch_export_example.csv", `Bundled export run ${idx + 1} display name uses spreadsheet file`);
    assertIncludes(run.displayName, "Spreadsheet", `Bundled export run ${idx + 1} display name identifies spreadsheet import`);
    assertEqual(run.title, run.displayName, `Bundled export run ${idx + 1} title follows display name`);
    assertGt(run.blocks.length, 0, `Bundled export run ${idx + 1} has blocks`);
  });

  const phaseRun = runs.find(r => r.runName === "sol111_sort2_phase.pch");
  const realRun = runs.find(r => r.runName === "sol111_sort2_real.pch");
  assert(phaseRun !== undefined, "Bundled export contains phase-source internal run");
  assert(realRun !== undefined, "Bundled export contains real-source internal run");

  if (phaseRun) {
    const block = phaseRun.blocks.find(b => b.resultFamily === "DISPLACEMENT" && b.subcaseId === 1);
    assert(block !== undefined, "Bundled export phase run has displacement block for subcase 1");
    if (block) {
      assertEqual(block.title, phaseRun.displayName, "Spreadsheet block title uses spreadsheet display name");
      const td = PCHParser.extractTraceData(block, 2001, "T1");
      assert(td !== null, "Bundled export trace extracts from imported spreadsheet block");
      if (td) {
        assertEqual(td.storageKind, "DERIVED", "Bundled export trace is stored as derived representation");
        assertEqual(td.lockedRepr, "MAGNITUDE", "Bundled export trace remains locked to magnitude");
        assertEqual(td.x.length, 296, "Bundled export trace preserves data length");
        assertEqual(td.x[0], 5, "Bundled export trace preserves frequency values");
        const locked = PCHParser.computeRepresentation(td, "PHASE");
        assertEqual(locked.isLocked, true, "Bundled export trace reports locked representation when PHASE is requested");
        assertEqual(locked.effectiveRepr, "MAGNITUDE", "Bundled export trace keeps MAGNITUDE as the effective representation");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture A: SORT2 Real/Imag
// ---------------------------------------------------------------------------
console.log("\n=== Fixture A: run_a_sort2_realimag.pch ===");
{
  const run = loadAndParse("run_a_sort2_realimag.pch");
  assertGt(run.blocks.length, 0, "Has blocks");
  const acceBlocks = run.blocks.filter(b => b.resultFamily === "ACCELERATION");
  const spcBlocks  = run.blocks.filter(b => b.resultFamily === "SPCF");
  assertGt(acceBlocks.length, 0, "Has ACCELERATION block");
  assertGt(spcBlocks.length,  0, "Has SPCF block");

  const ab = acceBlocks[0];
  assertEqual(ab.sort, "SORT2", "ACCELERATION sort is SORT2");
  assertEqual(ab.domain, "FREQUENCY_RESPONSE", "ACCELERATION domain is FREQUENCY_RESPONSE");
  assert(ab.entityIds.includes(101), "ACCELERATION has entity 101");
  assert(ab.entityIds.includes(205), "ACCELERATION has entity 205");
  assert(ab.entityIds.includes(310), "ACCELERATION has entity 310");

  const sb = spcBlocks[0];
  assertEqual(sb.sort, "SORT2", "SPCF sort is SORT2");
  assert(sb.entityIds.includes(1001), "SPCF has entity 1001");

  // Extract T3 for grid 101 (50 frequencies)
  checkTraceExtraction(run, run.blocks.indexOf(ab), 101, "T3", 50, "ACCE SORT2 grid101 T3");
  checkAllReprs(run, run.blocks.indexOf(ab), 101, "T3", "ACCE SORT2 grid101 T3");
  checkTraceExtraction(run, run.blocks.indexOf(sb), 1001, "Fz", 50, "SPC SORT2 grid1001 Fz");
}

// ---------------------------------------------------------------------------
// Fixture B: SORT1 Real/Imag
// ---------------------------------------------------------------------------
console.log("\n=== Fixture B: run_b_sort1_realimag.pch ===");
{
  const run = loadAndParse("run_b_sort1_realimag.pch");
  const acceBlocks = run.blocks.filter(b => b.resultFamily === "ACCELERATION");
  const spcBlocks  = run.blocks.filter(b => b.resultFamily === "SPCF");
  assertGt(acceBlocks.length, 0, "Has ACCELERATION block");
  assertGt(spcBlocks.length,  0, "Has SPCF block");

  const ab = acceBlocks[0];
  assertEqual(ab.sort, "SORT1", "ACCELERATION sort is SORT1");
  assertEqual(ab.domain, "FREQUENCY_RESPONSE", "ACCELERATION domain is FREQUENCY_RESPONSE");
  assert(ab.entityIds.includes(101), "ACCELERATION has entity 101 (SORT1)");

  checkTraceExtraction(run, run.blocks.indexOf(ab), 101, "T3", 50, "ACCE SORT1 grid101 T3");
  checkAllReprs(run, run.blocks.indexOf(ab), 101, "T3", "ACCE SORT1 grid101 T3");
  checkTraceExtraction(run, run.blocks.indexOf(spcBlocks[0]), 1001, "Fz", 50, "SPC SORT1 grid1001 Fz");
}

// ---------------------------------------------------------------------------
// Fixture C: SORT2 Mag/Phase
// ---------------------------------------------------------------------------
console.log("\n=== Fixture C: run_c_sort2_magphase.pch ===");
{
  const run = loadAndParse("run_c_sort2_magphase.pch");
  const acceBlocks = run.blocks.filter(b => b.resultFamily === "ACCELERATION");
  assertGt(acceBlocks.length, 0, "Has ACCELERATION block");

  const ab = acceBlocks[0];
  assertEqual(ab.sort, "SORT2", "ACCELERATION sort is SORT2");

  const td = PCHParser.extractTraceData(ab, 101, "T3");
  assert(td !== null, "extractTraceData returns non-null for MAG_PHASE");
  if (td) {
    // In MAG_PHASE, re should be all non-negative (magnitudes)
    const allNonNeg = Array.from(td.re).every(v => v >= 0);
    assert(allNonNeg, "MAG_PHASE: re values are all non-negative (magnitudes)");
    // Phase values should be in [-360, 360]
    const phaseOk = Array.from(td.im).every(v => Math.abs(v) <= 360);
    assert(phaseOk, "MAG_PHASE: im values are in [-360, 360] (phase degrees)");
  }
  checkAllReprs(run, run.blocks.indexOf(ab), 101, "T3", "ACCE SORT2 MAG_PHASE grid101 T3");
}

// ---------------------------------------------------------------------------
// Fixture D: XYPUNCH
// ---------------------------------------------------------------------------
console.log("\n=== Fixture D: run_d_xypunch.pch ===");
{
  const run = loadAndParse("run_d_xypunch.pch");
  const xyBlocks = run.blocks.filter(b => b.resultFamily === "XYPUNCH");
  assertGt(xyBlocks.length, 0, "Has XYPUNCH blocks");

  // Should have 3 grids × 2 comps (RM+IP) for ACCE + 2 grids × 2 comps for FORCE = 10 blocks
  assertEqual(xyBlocks.length, 10, "10 XYPUNCH blocks (3 ACCE grids × 2 + 2 SPC grids × 2)");

  const rmBlock = xyBlocks.find(b => b.xypunchKind === "ACCE" && b.xypunchEntity === 101 && b.xypunchComp === "T3RM");
  assert(rmBlock !== undefined, "Found ACCE T3RM block for grid 101");
  if (rmBlock) {
    const td = PCHParser.extractTraceData(rmBlock, 101, "T3RM");
    assert(td !== null, "XYPUNCH extractTraceData returns non-null");
    if (td) assertEqual(td.x.length, 50, "XYPUNCH T3RM has 50 data points");
  }

  const ipBlock = xyBlocks.find(b => b.xypunchKind === "ACCE" && b.xypunchEntity === 101 && b.xypunchComp === "T3IP");
  assert(ipBlock !== undefined, "Found ACCE T3IP block for grid 101");

  const forceBlock = xyBlocks.find(b => b.xypunchKind === "FORCE" && b.xypunchEntity === 1001);
  assert(forceBlock !== undefined, "Found FORCE block for SPC grid 1001");
}

// ---------------------------------------------------------------------------
// Fixture E: CBUSH with CONT
// ---------------------------------------------------------------------------
console.log("\n=== Fixture E: run_e_cbush_cont.pch ===");
{
  const run = loadAndParse("run_e_cbush_cont.pch");
  const efBlocks = run.blocks.filter(b => b.resultFamily === "ELEMENT_FORCES");
  assertGt(efBlocks.length, 0, "Has ELEMENT_FORCES block");

  const eb = efBlocks[0];
  assert(eb.entityIds.includes(5001), "ELEMENT_FORCES has entity 5001");
  assert(eb.entityIds.includes(5002), "ELEMENT_FORCES has entity 5002");

  const td = PCHParser.extractTraceData(eb, 5001, "F3");
  assert(td !== null, "CBUSH extractTraceData F3 returns non-null");
  if (td) {
    assertEqual(td.x.length, 50, "CBUSH F3 has 50 data points");
    // F3 values should be around 200 (the scale used in the fixture)
    const maxRe = Math.max(...Array.from(td.re));
    assertGt(maxRe, 100, "CBUSH F3 max real part > 100 (physically plausible)");
  }

  const tdM1 = PCHParser.extractTraceData(eb, 5001, "M1");
  assert(tdM1 !== null, "CBUSH extractTraceData M1 (CONT line) returns non-null");
  if (tdM1) assertEqual(tdM1.x.length, 50, "CBUSH M1 has 50 data points");
}

// ---------------------------------------------------------------------------
// Fixture F: Transient
// ---------------------------------------------------------------------------
console.log("\n=== Fixture F: run_f_transient.pch ===");
{
  const run = loadAndParse("run_f_transient.pch");
  const acceBlocks = run.blocks.filter(b => b.resultFamily === "ACCELERATION");
  assertGt(acceBlocks.length, 0, "Has ACCELERATION block");

  const ab = acceBlocks[0];
  assertEqual(ab.domain, "TRANSIENT", "ACCELERATION domain is TRANSIENT");

  const td = PCHParser.extractTraceData(ab, 101, "T3");
  assert(td !== null, "Transient extractTraceData returns non-null");
  if (td) {
    assertEqual(td.x.length, 200, "Transient T3 has 200 time steps");
    assert(td.x[1] > 0 && td.x[1] < 1, "Transient x[1] is a small time value");
  }
}

// ---------------------------------------------------------------------------
// Fixture G: mixed CBUSH + CELAS
// ---------------------------------------------------------------------------
console.log("\n=== Fixture G: run_g_mixed_element_forces.pch ===");
{
  const run = loadAndParse("run_g_mixed_element_forces.pch");
  const efBlocks = run.blocks.filter(b => b.resultFamily === "ELEMENT_FORCES");
  assertEqual(efBlocks.length, 3, "Mixed element fixture splits into three ELEMENT_FORCES blocks");

  const cbushBlock = efBlocks.find(b => b.elementType === "CBUSH" && b.subcaseId === 9);
  const celas2Block = efBlocks.find(b => b.elementType === "CELAS2" && b.subcaseId === 9);
  const celas4Block = efBlocks.find(b => b.elementType === "CELAS4" && b.subcaseId === 10);
  assert(cbushBlock !== undefined, "Found CBUSH block in mixed element fixture");
  assert(celas2Block !== undefined, "Found CELAS2 block in mixed element fixture");
  assert(celas4Block !== undefined, "Found CELAS4 block in mixed element fixture");

  if (cbushBlock) {
    assertEqual(cbushBlock.domain, "FREQUENCY_RESPONSE", "CBUSH mixed block infers frequency domain");
    assertEqual(cbushBlock.complexRep, "REAL_IMAG", "CBUSH mixed block infers REAL_IMAG");
    assertEqual(PCHParser.componentLabelsForBlock(cbushBlock).join(","), "F1,F2,F3,M1,M2,M3", "CBUSH block exposes six force components");
    const td = PCHParser.extractTraceData(cbushBlock, 7001, "M1");
    assert(td !== null, "CBUSH mixed block extracts M1");
    if (td) {
      assertEqual(td.x.length, 2, "CBUSH mixed block M1 length");
      assertEqual(td.re[0], 40, "CBUSH CONT placeholder is skipped for real moments");
      assertEqual(td.im[1], -4.1, "CBUSH CONT placeholder is skipped for imaginary moments");
    }
  }

  if (celas2Block) {
    assertEqual(celas2Block.domain, "FREQUENCY_RESPONSE", "CELAS2 block infers frequency domain");
    assertEqual(celas2Block.complexRep, "MAG_PHASE", "CELAS2 block infers MAG_PHASE");
    assertEqual(PCHParser.componentLabelsForBlock(celas2Block).join(","), "F", "CELAS2 block exposes scalar F only");
    const td = PCHParser.extractTraceData(celas2Block, 8001, "F");
    assert(td !== null, "CELAS2 block extracts scalar force");
    assertEqual(PCHParser.extractTraceData(celas2Block, 8001, "F1"), null, "CELAS2 block rejects F1");
    assertEqual(PCHParser.extractTraceData(celas2Block, 8001, "M1"), null, "CELAS2 block rejects M1");
    if (td) {
      assertEqual(td.x.length, 2, "CELAS2 scalar force length");
      assertEqual(td.re[0], 5, "CELAS2 magnitude values preserved");
      assertEqual(td.im[1], 45, "CELAS2 phase values preserved");
    }
  }

  if (celas4Block) {
    assertEqual(celas4Block.complexRep, "REAL_IMAG", "CELAS4 block infers REAL_IMAG from negative real values");
    assertEqual(PCHParser.componentLabelsForBlock(celas4Block).join(","), "F", "CELAS4 block exposes scalar F only");
  }

  ["CELAS1", "CELAS2", "CELAS3", "CELAS4"].forEach(type => {
    const comps = PCHParser.componentLabelsForBlock({ resultFamily: "ELEMENT_FORCES", elementType: type });
    assertEqual(comps.join(","), "F", `${type} component descriptor exposes scalar F`);
  });
}

// ---------------------------------------------------------------------------
// Spreadsheet import: raw pair
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: raw complex import ===");
{
  const csv = buildSpreadsheetCsv(
    [
      { sourceFile: "run_raw_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 101, component: "T3", reprLabel: "Real", header: "run_raw_a.pch|SC1|ID101|T3|Re" },
      { sourceFile: "run_raw_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 101, component: "T3", reprLabel: "Imaginary", header: "run_raw_a.pch|SC1|ID101|T3|Im" },
    ],
    [
      ["1.0", "10", "1"],
      ["2.0", "20", "2"],
      ["3.0", "30", "3"],
    ]
  );
  const runs = PCHParser.parseSpreadsheetText("raw_pair.csv", csv);
  assertEqual(runs.length, 1, "Raw import returns one run");
  assertEqual(runs[0].blocks.length, 1, "Raw import returns one block");
  const td = PCHParser.extractTraceData(runs[0].blocks[0], 101, "T3");
  assert(td !== null, "Raw import trace extracted");
  if (td) {
    assertEqual(td.storageKind, "COMPLEX", "Raw import storageKind is COMPLEX");
    assertEqual(td.x.length, 3, "Raw import x length");
    assertEqual(td.re[1], 20, "Raw import real values preserved");
    assertEqual(td.im[2], 3, "Raw import imaginary values preserved");
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet import: multiple runs / subcases / families
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: grouped synthetic runs ===");
{
  const csv = buildSpreadsheetCsv(
    [
      { sourceFile: "run_multi_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 101, component: "T3", reprLabel: "Real", header: "run_multi_a.pch|SC1|ID101|T3|Re" },
      { sourceFile: "run_multi_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 101, component: "T3", reprLabel: "Imaginary", header: "run_multi_a.pch|SC1|ID101|T3|Im" },
      { sourceFile: "run_multi_a.pch", subcaseId: 2, family: "VELOCITY", entityId: 205, component: "T1", reprLabel: "Real", header: "run_multi_a.pch|SC2|ID205|T1|Re" },
      { sourceFile: "run_multi_a.pch", subcaseId: 2, family: "VELOCITY", entityId: 205, component: "T1", reprLabel: "Imaginary", header: "run_multi_a.pch|SC2|ID205|T1|Im" },
      { sourceFile: "run_multi_b.pch", subcaseId: 7, family: "SPCF", entityId: 9001, component: "Fz", reprLabel: "Real", header: "run_multi_b.pch|SC7|ID9001|Fz|Re" },
      { sourceFile: "run_multi_b.pch", subcaseId: 7, family: "SPCF", entityId: 9001, component: "Fz", reprLabel: "Imaginary", header: "run_multi_b.pch|SC7|ID9001|Fz|Im" },
    ],
    [
      ["5.0", "1", "0.1", "2", "0.2", "3", "0.3"],
      ["10.0", "4", "0.4", "5", "0.5", "6", "0.6"],
    ]
  );
  const runs = PCHParser.parseSpreadsheetText("grouped.csv", csv);
  assertEqual(runs.length, 2, "Grouped import splits into two runs");
  const runA = runs.find(r => r.runName === "run_multi_a.pch");
  const runB = runs.find(r => r.runName === "run_multi_b.pch");
  assert(runA !== undefined, "Grouped import contains run_multi_a");
  assert(runB !== undefined, "Grouped import contains run_multi_b");
  if (runA) {
    assertEqual(runA.blocks.length, 2, "run_multi_a contains two synthetic blocks");
    assert(runA.blocks.some(b => b.subcaseId === 1 && b.resultFamily === "ACCELERATION"), "run_multi_a has ACCELERATION block");
    assert(runA.blocks.some(b => b.subcaseId === 2 && b.resultFamily === "VELOCITY"), "run_multi_a has VELOCITY block");
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet import: different frequency vectors remain distinct
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: different frequency vectors ===");
{
  const csvA = buildSpreadsheetCsv(
    [
      { sourceFile: "grid_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Real", header: "grid_a.pch|SC1|ID1|T1|Re" },
      { sourceFile: "grid_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Imaginary", header: "grid_a.pch|SC1|ID1|T1|Im" },
    ],
    [["1", "1", "0"], ["2", "2", "0"], ["4", "4", "0"]]
  );
  const csvB = buildSpreadsheetCsv(
    [
      { sourceFile: "grid_b.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Real", header: "grid_b.pch|SC1|ID1|T1|Re" },
      { sourceFile: "grid_b.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Imaginary", header: "grid_b.pch|SC1|ID1|T1|Im" },
    ],
    [["1.5", "10", "0"], ["3.5", "20", "0"]]
  );
  const runA = PCHParser.parseSpreadsheetText("grid_a.csv", csvA)[0];
  const runB = PCHParser.parseSpreadsheetText("grid_b.csv", csvB)[0];
  const tdA = PCHParser.extractTraceData(runA.blocks[0], 1, "T1");
  const tdB = PCHParser.extractTraceData(runB.blocks[0], 1, "T1");
  assert(tdA !== null && tdB !== null, "Different-grid traces extract successfully");
  if (tdA && tdB) {
    assertEqual(tdA.x.length, 3, "Grid A preserves its own x length");
    assertEqual(tdB.x.length, 2, "Grid B preserves its own x length");
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet import: display representation lock
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: display representation lock ===");
{
  const csv = buildSpreadsheetCsv(
    [
      { sourceFile: "run_display_a.pch", subcaseId: 3, family: "ACCELERATION", entityId: 101, component: "T3", reprLabel: "Magnitude", header: "run_display_a.pch|SC3|ID101|T3|Magnitude" },
    ],
    [
      ["1.0", "100"],
      ["2.0", "200"],
    ]
  );
  const runs = PCHParser.parseSpreadsheetText("display.csv", csv);
  const td = PCHParser.extractTraceData(runs[0].blocks[0], 101, "T3");
  assert(td !== null, "Display import trace extracted");
  if (td) {
    assertEqual(td.storageKind, "DERIVED", "Display import storageKind is DERIVED");
    assertEqual(td.lockedRepr, "MAGNITUDE", "Display import is locked to MAGNITUDE");
    const same = PCHParser.computeRepresentation(td, "MAGNITUDE");
    const diff = PCHParser.computeRepresentation(td, "PHASE");
    assertEqual(same.isLocked, false, "Matching representation is not marked locked");
    assertEqual(diff.isLocked, true, "Mismatched representation is marked locked");
    assertEqual(diff.y[1], 200, "Locked derived values are preserved");
  }
}

// ---------------------------------------------------------------------------
// Spreadsheet import: workbook multi-sheet
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: workbook import ===");
{
  const validA = buildSpreadsheetCsv(
    [
      { sourceFile: "wb_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 11, component: "T1", reprLabel: "Real", header: "wb_a.pch|SC1|ID11|T1|Re" },
      { sourceFile: "wb_a.pch", subcaseId: 1, family: "ACCELERATION", entityId: 11, component: "T1", reprLabel: "Imaginary", header: "wb_a.pch|SC1|ID11|T1|Im" },
    ],
    [["1", "1", "0"], ["2", "2", "0"]]
  );
  const validB = buildSpreadsheetCsv(
    [
      { sourceFile: "wb_b.pch", subcaseId: 2, family: "SPCF", entityId: 22, component: "Fz", reprLabel: "Real", header: "wb_b.pch|SC2|ID22|Fz|Re" },
      { sourceFile: "wb_b.pch", subcaseId: 2, family: "SPCF", entityId: 22, component: "Fz", reprLabel: "Imaginary", header: "wb_b.pch|SC2|ID22|Fz|Im" },
    ],
    [["3", "3", "0"], ["4", "4", "0"]]
  );
  const workbook = {
    SheetNames: ["ValidA", "Invalid", "ValidB"],
    Sheets: {
      ValidA: { csv: validA },
      Invalid: { csv: "not,a,valid,export" },
      ValidB: { csv: validB },
    },
  };
  const fakeXlsx = { utils: { sheet_to_csv: sheet => sheet.csv } };
  const runs = PCHParser.parseWorkbook("workbook.xlsx", workbook, fakeXlsx);
  assertEqual(runs.length, 2, "Workbook import returns valid sheets only");
  assert(runs[0].warnings.some(w => w.includes("Invalid")), "Workbook import records invalid sheet warning");
}

// ---------------------------------------------------------------------------
// Spreadsheet import: validation failures
// ---------------------------------------------------------------------------
console.log("\n=== Spreadsheet: validation failures ===");
{
  const missingMeta = [
    csvRow(["Source File", "bad.pch"]),
    csvRow(["Wrong Label", "SC 1"]),
    csvRow(["Result Family", "ACCELERATION"]),
    csvRow(["Entity ID", "ID 1"]),
    csvRow(["Direction", "T1"]),
    csvRow(["Representation", "Real"]),
    csvRow(["Frequency_Hz", "bad"]),
  ].join("\n");
  assertThrows(
    () => PCHParser.parseSpreadsheetText("missing_meta.csv", missingMeta),
    "missing required metadata row",
    "Missing metadata rows are rejected"
  );

  const mismatchedPair = buildSpreadsheetCsv(
    [
      { sourceFile: "bad_pair.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Real", header: "bad_pair.pch|SC1|ID1|T1|Re" },
      { sourceFile: "bad_pair.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Imaginary", header: "bad_pair.pch|SC1|ID1|T1|Im" },
      { sourceFile: "bad_pair.pch", subcaseId: 1, family: "ACCELERATION", entityId: 2, component: "T2", reprLabel: "Real", header: "bad_pair.pch|SC1|ID2|T2|Re" },
      { sourceFile: "bad_pair.pch", subcaseId: 1, family: "ACCELERATION", entityId: 2, component: "T3", reprLabel: "Imaginary", header: "bad_pair.pch|SC1|ID2|T3|Im" },
    ],
    [["1", "1", "0", "2", "3"]]
  );
  const badRuns = PCHParser.parseSpreadsheetText("bad_pair.csv", mismatchedPair);
  assert(badRuns[0].warnings.some(w => w.includes("matching Imaginary column")), "Broken Real/Imag pair creates a warning");
  assert(PCHParser.extractTraceData(badRuns[0].blocks[0], 1, "T1") !== null, "Valid trace in mixed file is still imported");
  assertEqual(PCHParser.extractTraceData(badRuns[0].blocks[0], 2, "T2"), null, "Broken Real/Imag pair is not imported as a trace");

  const nonNumeric = buildSpreadsheetCsv(
    [
      { sourceFile: "bad_data.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Real", header: "bad_data.pch|SC1|ID1|T1|Re" },
      { sourceFile: "bad_data.pch", subcaseId: 1, family: "ACCELERATION", entityId: 1, component: "T1", reprLabel: "Imaginary", header: "bad_data.pch|SC1|ID1|T1|Im" },
    ],
    [["1", "10", "0"], ["2", "oops", "0"]]
  );
  const badDataRuns = PCHParser.parseSpreadsheetText("bad_data.csv", nonNumeric);
  assert(badDataRuns[0].warnings.some(w => w.includes("non-numeric value")), "Non-numeric data cell creates a warning");
  const badTd = PCHParser.extractTraceData(badDataRuns[0].blocks[0], 1, "T1");
  if (badTd) {
    assert(Number.isNaN(badTd.re[1]), "Non-numeric data cell is imported as NaN");
  } else {
    assert(false, "Non-numeric data test: trace extraction should still succeed");
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED");
}
