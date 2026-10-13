import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
const runtimeModules = process.env.RUNTIME_NODE_MODULES;
if (!runtimeModules)
  throw Error(
    "Set RUNTIME_NODE_MODULES to the bundled runtime node_modules path.",
  );
const resolver = createRequire(import.meta.url);
const { Workbook, SpreadsheetFile } = await import(
  pathToFileURL(
    resolver.resolve("@oai/artifact-tool", { paths: [runtimeModules] }),
  ).href
);
const require = createRequire(import.meta.url),
  X = require("./excel.js"),
  M = require("./model.js");
const previews = new URL(
  "../_paper_build/workbench-template/",
  import.meta.url,
);
await fs.mkdir(previews, { recursive: true });
const wb = Workbook.create(),
  data = X.exampleRows();
const instructions = [
  ["Vibration spectrum import template", ""],
  [
    "Purpose",
    "Define reusable sine and random profiles and pair them into comparison cases.",
  ],
  [
    "Examples",
    "All supplied profiles and case inputs are illustrative, not controlled specifications.",
  ],
  [
    "Workflow",
    "Edit Profiles, Sine, Random and Cases; set per-case Settings and Dwells; import the .xlsx from File.",
  ],
  [
    "Profile identifiers",
    "Use unique letters, numbers, underscores or hyphens. References are case-sensitive.",
  ],
  [
    "Data entry",
    "Keep row 1 headers on data sheets. Add rows under the same headers. Literal values only; formulas are rejected.",
  ],
  [
    "Sine",
    "Each row is one power-law segment. Segments must be ordered and contiguous for each profile.",
  ],
  [
    "Random",
    "One-sided acceleration PSD in g²/Hz. Frequencies must increase per profile; levels must be positive.",
  ],
  [
    "Cases",
    "Every b × Q combination is evaluated. Comma-separated lists; b 2–12, Q 0.5–100; up to 72 combinations.",
  ],
  [
    "Settings",
    "One case / setting / value per row. Missing settings inherit illustrative defaults shown below. Review before use.",
  ],
  [
    "Dwells",
    "One documented dwell per row. Ignored in assumed mode; retained for later use.",
  ],
  [
    "Dwell caps",
    "Zero disables a cap. At least one time or cycle cap must be positive. The earlier enabled cap governs.",
  ],
  [
    "Peak basis",
    "extreme = approximate duration/probability model; fixed = selected k × response RMS.",
  ],
  [
    "Probability",
    "peakProbability is percent (99 means 99%), nominal per oscillator over total exposure; not joint reliability.",
  ],
  [
    "Exposure units",
    "duration: minutes per random exposure. assumedHours / hour_cap: hours per dwell. Frequencies: Hz.",
  ],
  [
    "Repetitions",
    "randomRepeats, assumedRepeats and dwell repeats are integer counts. passes counts one-way sweep traversals.",
  ],
  [
    "Scaling",
    "sineScale multiplies amplitudes, including dwell overrides. psdDb multiplies PSD by 10^(dB/10).",
  ],
  [
    "Source conventions",
    "State specification revisions on Profiles and axis, configuration, evidence and rationale in Settings.",
  ],
  [
    "Limits",
    "Up to 30 cases, 120 profiles, 100 sine segments and 300 PSD points per profile.",
  ],
  [
    "Reference",
    "Technical discussion and linked sources: Help → Technical README in the workbench.",
  ],
  ["Unit code", "Meaning"],
  ...Object.entries(require("../engine.js").UNITS),
  ["Default setting", "Value when omitted"],
  ...X.settings.map((k) => [k, String(M.defaults[k])]),
];
const all = { Instructions: instructions, ...data };
for (const [name, rows] of Object.entries(all)) {
  const sh = wb.worksheets.add(name);
  sh.showGridLines = false;
  const cols = Math.max(...rows.map((r) => r.length)),
    range = sh.getRangeByIndexes(0, 0, rows.length, cols);
  range.values = rows.map((r) => [...r, ...Array(cols - r.length).fill(null)]);
  range.format.font = { name: "Arial", size: 11, color: "#253647" };
  range.format.rowHeight = 24;
  range.format.verticalAlignment = "center";
  sh.getRangeByIndexes(0, 0, 1, cols).format = {
    fill: "#253E52",
    font: { name: "Arial", size: 11, color: "#FFFFFF", bold: true },
    rowHeight: 30,
  };
  sh.freezePanes.freezeRows(1);
  for (let j = 0; j < cols; j++)
    sh.getRangeByIndexes(0, j, rows.length, 1).format.columnWidth =
      name === "Instructions"
        ? j === 0
          ? 26
          : 108
        : name === "Settings"
          ? [15, 25, 100][j]
          : name === "Cases"
            ? [15, 43, 15, 15, 20, 20, 15][j]
            : name === "Profiles"
              ? [18, 16, 48, 22][j]
              : name === "Sine"
                ? [18, 18, 18, 25, 20, 20][j]
                : 20;
  if (name === "Instructions") {
    range.format.wrapText = true;
    range.format.rowHeight = 34;
    sh.tabColor = "#526E80";
  } else {
    sh.getRangeByIndexes(1, 0, rows.length - 1, cols).format.fill = "#FFF9E8";
    sh.tables.add(
      sh.getRangeByIndexes(0, 0, rows.length, cols),
      true,
      name + "Data",
    );
  }
  if (name === "Profiles")
    sh.getRange("B2:B121").dataValidation = {
      rule: { type: "list", values: ["sine", "random"] },
    };
  if (name === "Cases")
    sh.getRange("G2:G31").dataValidation = {
      rule: { type: "list", values: ["TRUE", "FALSE"] },
    };
  if (name === "Sine")
    sh.getRange("D2:D501").dataValidation = {
      rule: {
        type: "list",
        values: Object.keys(require("../engine.js").UNITS),
      },
    };
  if (name === "Settings")
    sh.getRange("B2:B1001").dataValidation = {
      rule: { type: "list", formula1: `'Instructions'!$A$${instructions.findIndex(r=>r[0]==='Default setting')+2}:$A$${instructions.length}` },
    };
}
wb.recalculate();
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!',options:{useRegex:true,maxResults:50},summary:'Input template error scan'});
console.log(errors.ndjson);
console.log(
  (
    await wb.inspect({
      kind: "table",
      range: "Cases!A1:G4",
      include: "values",
      tableMaxRows: 5,
      tableMaxCols: 7,
      maxChars: 2500,
    })
  ).ndjson,
);
for (const [name, rows] of Object.entries(all)) {
  const cols = Math.max(...rows.map((r) => r.length));
  const end = String.fromCharCode(64 + cols);
  const im = await wb.render({
    sheetName: name,
    range: `A1:${end}${Math.min(rows.length, 12)}`,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    new URL(name + ".png", previews),
    new Uint8Array(await im.arrayBuffer()),
  );
}
const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(
  fileURLToPath(new URL("../vibration_spectra_template.xlsx", import.meta.url)),
);
console.log("Template exported.");
