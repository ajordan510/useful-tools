/**
 * test_parser.js
 * ==============
 * Node.js validation tests for pch_parser.js against all six synthetic fixtures.
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
const PCHParser = require("./src/pch_parser.js");

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

function loadAndParse(filename) {
  const text = fs.readFileSync(path.join(FIXTURES, filename), "utf8");
  return PCHParser.parsePCH(text, filename);
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
