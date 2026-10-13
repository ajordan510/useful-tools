import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  E = require("../engine.js"),
  M = require("./model.js");
const root = new URL("./", import.meta.url),
  read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const input = {
  ...M.defaults,
  ...JSON.parse(read("../reference/irvine-2011-case.json")).inputs,
  dwellMode: "documented",
  peakMode: "extreme",
  peakProbability: "99",
};
const c = E.parse(input),
  r = E.atMode(c, 100),
  values = {
    sineMm: r.peakSine * 1000,
    sineDamage: r.heritage,
    rmsMm: r.sigma * 1000,
    randomDamage: r.random,
    coverage: r.margin,
    peakMm: r.peakRandom * 1000,
    peakCoverage: r.peakRatio,
  };
let method = read("method.html").replace(
  /<span data-example="([^"]+)"><\/span>/g,
  (_, key) => Number(values[key].toPrecision(7)).toString(),
);
const worker =
  read("../engine.js") +
  "\n" +
  read("model.js") +
  "\nonmessage=async e=>{try{const scenarios=await WBModel.run(e.data.inputs,e.data.bs,e.data.qs,p=>postMessage({progress:p}));postMessage({scenarios});}catch(e){postMessage({error:e.message});}};";
let html = read("workbench.template.html");
const files = {
  PLOTLY: "../vendor/plotly.min.js",
  XLSX: "../vendor/xlsx.full.min.js",
  PPTX: "../vendor/pptxgen.bundle.js",
  ENGINE: "../engine.js",
  REPORTING: "../reporting.js",
  MODEL: "model.js",
  EXCEL: "excel.js",
  PLOTS: "plots.js",
  EXPORTS: "exports.js",
  APP: "app.js",
};
for (const [key, file] of Object.entries(files))
  html = html.replace(`/*__${key}__*/`, () =>
    read(file)
      .replace(/<\/script/gi, "<\\/script")
      .replace(/\/\/# sourceMappingURL=.*$/gm, ""),
  );
html = html
  .replace("<!--__README__-->", () => method)
  .replace('/*__WORKER__*/""', () =>
    JSON.stringify(worker).replace(/<\//g, "<\\/"),
  )
  .replace('/*__TEMPLATE__*/""', () =>
    JSON.stringify(
      fs
        .readFileSync(new URL("../vibration_spectra_template.xlsx", root))
        .toString("base64"),
    ),
  );
fs.writeFileSync(new URL("../vibration_workbench.html", root), html);
fs.writeFileSync(
  new URL("../WORKBENCH_METHOD.html", root),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Vibration comparison method</title><style>body{max-width:940px;margin:40px auto;padding:20px;font:17px/1.65 Georgia;color:#243542}h1,h2,h3{font-family:Arial}a{color:#155a82}.eq{padding:15px;border-left:3px solid #557286;background:#f4f6f8;overflow:auto}table{width:100%;border-collapse:collapse;font:14px/1.5 Arial}td,th{padding:10px;border-bottom:1px solid #ccd5dc;text-align:left}svg{max-width:100%}figcaption{font:13px/1.5 Arial}button{display:none}@media print{figure,.eq{break-inside:avoid}}</style>${method}</html>`,
);
console.log("Built offline workbench, method reference and worked values.");
