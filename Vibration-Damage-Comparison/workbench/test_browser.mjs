import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  JSZip = require("jszip");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  out = path.join(root, "_paper_build/workbench");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  }),
  page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) requests.push(r.url());
});
page.on("dialog", (d) => d.dismiss());
const ready = () =>
  page.waitForFunction(
    () => !Workbench.busy && !Workbench.rendering && document.querySelector("#plot_bars")?._fullLayout,
    {},
    { timeout: 120000 },
  );
async function download(button, name) {
  const wait = page.waitForEvent("download", { timeout: 120000 });
  await button.click();
  const d = await wait;
  await d.saveAs(path.join(out, name));
  return path.join(out, name);
}
try {
  await page.goto(
    pathToFileURL(path.join(root, "vibration_workbench.html")).href,
  );
  await page.waitForFunction(() => typeof Workbench !== "undefined");
  await page
    .getByRole("button", { name: "Run comparison", exact: true })
    .click();
  await ready();
  assert.equal(
    await page.evaluate(
      () => Workbench.result(Workbench.study.cases[0]).length,
    ),
    9,
  );
  await page.screenshot({
    path: path.join(out, "workspace.png"),
    fullPage: true,
  });
  assert.equal(await page.locator("#requirements .plot").count(), 3);
  assert.equal(await page.locator(".plot").count(), 11);
  assert.doesNotMatch(await page.locator("#results").innerText(), /Drag to zoom|Double-click to fit|Select a cell to inspect|Release to update/);
  const peakBefore = await page.evaluate(() => Workbench.chosen(Workbench.study.cases[0]).r.peakWorst.peakRatio);
  assert.equal(await page.evaluate(() => {
    const s = Workbench.chosen(Workbench.study.cases[0]);
    return document.querySelector('#plot_peakResponsePlot').data[2].y.every((v,i)=>v === 3*s.r.rows[i].sigma*1000);
  }), true);
  await page.evaluate(() => Workbench.actions.appearance());
  await page.locator('#f_vrsFactor').fill('4.5');
  await page.locator('#f_legendMode').selectOption('boxed');
  await page.getByRole('button', {name:'Apply appearance'}).click();
  await ready();
  assert.equal(await page.evaluate(() => {
    const s = Workbench.chosen(Workbench.study.cases[0]), p=document.querySelector('#plot_peakResponsePlot');
    return p.data[2].y.every((v,i)=>v === 4.5*s.r.rows[i].sigma*1000) &&
      p._fullLayout.legend.title.text.includes('b = 6') && p._fullLayout.legend.title.text.includes('Q = 10') &&
      p._fullLayout.legend.borderwidth===1 && p._context.edits.legendPosition;
  }), true);
  assert.equal(await page.evaluate(() => Workbench.chosen(Workbench.study.cases[0]).r.peakWorst.peakRatio), peakBefore);
  // Drag the actual legend, then check saved and exported coordinates.
  await page.locator('#plot_peakResponsePlot').evaluate(el=>el.scrollIntoView({block:'center'}));
  const legendBefore=await page.evaluate(()=>document.querySelector('#plot_peakResponsePlot')._fullLayout.legend.x);
  const lb=await page.locator('#plot_peakResponsePlot .legend .bg').boundingBox();
  await page.mouse.move(lb.x+lb.width/2,lb.y+8);await page.mouse.down();
  await page.mouse.move(lb.x+lb.width/2-80,lb.y+68,{steps:10});await page.mouse.up();
  await page.waitForFunction(x=>document.querySelector('#plot_peakResponsePlot')._fullLayout.legend.x!==x,legendBefore);
  const legendSaved=await page.evaluate(()=>Workbench.study.cases[0].views.peakResponsePlot.legend);
  assert.equal(legendSaved.mode,'boxed');
  const svgLegend=await download(page.locator('[data-image="peakResponsePlot"][data-format="svg"]'),'boxed-vrs.svg');
  const svgText=await fs.readFile(svgLegend,'utf8');
  assert.match(svgText,/4\.5.*RMS/);assert.match(svgText,/b = 6/);assert.match(svgText,/Q = 10/);
  await page.locator('[data-fit="peakResponsePlot"]').click();
  assert.deepEqual(await page.evaluate(()=>Workbench.study.cases[0].views.peakResponsePlot.legend),legendSaved);
  await page.locator('[data-legend="peakResponsePlot"]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#plot_peakResponsePlot')._fullLayout.legend.borderwidth),0);
  await page.locator('[data-legend="peakResponsePlot"]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#plot_peakResponsePlot')._fullLayout.legend.borderwidth),1);
  await page.evaluate(()=>Workbench.actions.appearance());
  await page.locator('#f_vrsFactor').fill('3');
  await page.locator('#f_legendMode').selectOption('above');
  await page.getByRole('button',{name:'Apply appearance'}).click();await ready();
  // Display controls use actual calculated rows, without changing assessment minima.
  const headline = await page.locator("#summary").innerText();
  await page.locator("#summaryScope").selectOption("frequency");
  await ready();
  await page.locator("#summaryFrequency").selectOption({ index: 12 });
  await ready();
  assert.equal(await page.evaluate(() => {
    const c = Workbench.study.cases[0], all = Workbench.result(c);
    const plot = document.querySelector("#plot_heatmap");
    return plot.data[0].z.every((row, i) => row.every((v, j) => {
      const s = all.find(s => s.c.b === Number(plot.data[0].y[i]) && s.c.Q === Number(plot.data[0].x[j]));
      return v === s.r.rows.find(r => r.fn === c.display.frequency).margin;
    }));
  }), true);
  await page.locator("#summaryMetric").selectOption("peak");
  await ready();
  assert.equal(await page.evaluate(() => {
    const c = Workbench.study.cases[0], all = Workbench.result(c);
    const z = document.querySelector("#plot_heatmap").data[0].z;
    return z.every(row => JSON.stringify(row) === JSON.stringify(z[0])) &&
      document.querySelector("#plot_bars").data[1].y.every((v,j) => {
        const Q = Number(document.querySelector("#plot_bars").data[1].x[j]);
        return v === all.find(s => s.c.Q === Q).r.rows.find(r => r.fn === c.display.frequency).peakRatio;
      });
  }), true);
  await page.locator("#frequencySlider").focus();
  await page.keyboard.press("End");
  await ready();
  assert.equal(await page.locator("#frequencySlider").inputValue(), await page.locator("#frequencySlider").getAttribute("max"));
  assert.equal(await page.locator("#summary").innerText(), headline);
  await page.locator("#coverageView").selectOption("envelope");
  await ready();
  assert.equal(await page.evaluate(() => {
    const c = Workbench.study.cases[0], all = Workbench.result(c);
    return [["ratioPlot", "margin"], ["peakPlot", "peakRatio"]].every(([id,k]) => {
      const d = document.querySelector("#plot_"+id).data;
      return d[0].y.every((v,i) => v === Math.min(...all.map(s => s.r.rows[i][k]))) &&
        d[1].y.every((v,i) => v === Math.max(...all.map(s => s.r.rows[i][k]))) && d[1].fill === "tonexty";
    });
  }), true);
  await page.locator("#activeB").selectOption("8");
  await page.locator("#activeQ").selectOption("5");
  await ready();
  assert.match(await page.locator("#plotContext").innerText(), /selected b 8, Q 5/);
  assert.equal(await page.evaluate(() => {
    const s = Workbench.chosen(Workbench.study.cases[0]);
    return document.querySelector("#plot_ratioPlot").data[2].y.every((v,i) => v === s.r.rows[i].margin);
  }), true);
  const display = await page.evaluate(() => {
    const s = WBModel.validate(JSON.parse(JSON.stringify(Workbench.study)));
    return s.cases[0].display;
  });
  assert.equal(display.coverageView, "envelope");
  assert.equal(display.summaryScope, "frequency");
  assert.equal(display.summaryMetric, "peak");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: path.join(out, "frequency-envelope-workspace.png"), fullPage: true});
  await download(page.locator('[data-image="ratioPlot"][data-format="svg"]'), "envelope.svg");
  await download(page.locator('[data-image="heatmap"][data-format="png"]'), "frequency-heatmap.png");
  await page.locator("#summaryScope").selectOption("overall");
  await page.locator("#summaryMetric").selectOption("fatigue");
  await page.locator("#coverageView").selectOption("selected");
  await page.locator("#activeB").selectOption("6");
  await page.locator("#activeQ").selectOption("10");
  await ready();
  const before = await page.evaluate(
    () => Workbench.chosen(Workbench.study.cases[0]).r.worst.margin,
  );
  await page.locator('[data-axis="ratioPlot"]').click();
  await page.locator("#f_xMin").fill("90");
  await page.locator("#f_xMax").fill("200");
  await page.locator("#f_yType").selectOption("linear");
  await page.locator("#f_yMin").fill("0");
  await page.locator("#f_yMax").fill("4");
  await page.getByRole("button", { name: "Apply limits" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#plot_fatigueComparePlot")._fullLayout.xaxis
        .range[0] > 1.9,
  );
  assert.equal(
    await page.evaluate(
      () => Workbench.chosen(Workbench.study.cases[0]).r.worst.margin,
    ),
    before,
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#plot_ratioPlot")._fullLayout.yaxis.type,
    ),
    "linear",
  );
  await page.locator('[data-expand="ratioPlot"]').click();
  assert.equal(await page.locator(".plotcard.expanded").count(), 1);
  await page.keyboard.press("Escape");
  // Exercise wheel zoom and native pan with visible plots, then restore deterministic view.
  await page.locator("#plot_ratioPlot").scrollIntoViewIfNeeded();
  const box = await page.locator("#plot_ratioPlot").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const range0 = await page.evaluate(() =>
    document.querySelector("#plot_ratioPlot")._fullLayout.xaxis.range.slice(),
  );
  await page.mouse.wheel(0, -160);
  await page.waitForTimeout(350);
  const range1 = await page.evaluate(() =>
    document.querySelector("#plot_ratioPlot")._fullLayout.xaxis.range.slice(),
  );
  assert.notDeepEqual(range0, range1);
  await page.evaluate(() =>
    Plotly.relayout("plot_ratioPlot", { dragmode: "pan" }),
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.notDeepEqual(
    range1,
    await page.evaluate(() =>
      document.querySelector("#plot_ratioPlot")._fullLayout.xaxis.range.slice(),
    ),
  );
  // Box zoom and fit on a requirement plot.
  await page.locator('#plot_psdPlot').evaluate(el => el.scrollIntoView({block: "center"}));
  const psdRange=await page.evaluate(()=>document.querySelector('#plot_psdPlot')._fullLayout.xaxis.range.slice());
  const area=await page.locator('#plot_psdPlot .nsewdrag').boundingBox();
  await page.mouse.move(area.x+area.width*.25,area.y+area.height*.25);await page.mouse.down();
  await page.mouse.move(area.x+area.width*.75,area.y+area.height*.75,{steps:8});await page.mouse.up();
  await page.waitForTimeout(300);
  assert.notDeepEqual(psdRange,await page.evaluate(()=>document.querySelector('#plot_psdPlot')._fullLayout.xaxis.range.slice()));
  await page.locator('[data-fit="psdPlot"]').click();
  assert.deepEqual(psdRange,await page.evaluate(()=>document.querySelector('#plot_psdPlot')._fullLayout.xaxis.range.slice()));
  // Select an actual heatmap cell (bottom-right: b=4, Q=20).
  await page.locator('#plot_heatmap').scrollIntoViewIfNeeded();
  const heat=await page.locator('#plot_heatmap .nsewdrag').boundingBox();
  await page.mouse.click(heat.x+heat.width*5/6,heat.y+heat.height*5/6);
  await page.waitForFunction(()=>document.querySelector('#activeB').value==='4'&&document.querySelector('#activeQ').value==='20');
  await ready();
  // Category and color limits are editable too.
  await page.locator('[data-axis="heatmap"]').click();
  await page.locator("#f_colorMax").fill("3");
  await page.getByRole("button", { name: "Apply limits" }).click();
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#plot_heatmap").data[0].zmax,
    ),
    3,
  );
  await download(
    page.locator('[data-image="ratioPlot"][data-format="svg"]'),
    "coverage.svg",
  );
  await download(page.locator('[data-image="ratioPlot"][data-format="png"]'),'coverage.png');
  const saveEvent = page.waitForEvent("download");
  await page.evaluate(() => Workbench.actions.save());
  const saved = await saveEvent;
  await saved.saveAs(path.join(out, "saved-study.json"));
  const savedData = JSON.parse(
    await fs.readFile(path.join(out, "saved-study.json"), "utf8"),
  );
  assert.equal(savedData.cases[0].views.heatmap.color[1], 3);
  assert.deepEqual(savedData.cases[0].selected,{b:4,Q:20});
  const round = await page.evaluate(
    () =>
      WBModel.validate(JSON.parse(JSON.stringify(Workbench.study))).cases[0]
        .views,
  );
  assert.equal(round.heatmap.color[1], 3);
  assert.equal(round.ratioPlot.y.type, "linear");
  await page.evaluate(() => Workbench.actions.settings());
  await page.locator("#f_bValues").fill("4, 6");
  await page.getByRole("button", { name: "Apply settings" }).click();
  assert.equal(await page.locator("#results").isVisible(), false);
  await page
    .getByRole("button", { name: "Run comparison", exact: true })
    .click();
  await ready();
  // Shared profile edit must invalidate every dependent case.
  await page.evaluate(() => Workbench.actions.cases());
  await page.locator("#copyCase").click();
  await page.getByRole("button", { name: "Apply comparison" }).click();
  await page.evaluate(() => Workbench.calculate(true));
  await ready();
  assert.equal(
    await page.evaluate(
      () => Workbench.study.cases.filter((c) => Workbench.result(c)).length,
    ),
    2,
  );
  await page.evaluate(() => Workbench.actions.profiles());
  await page.locator("#f_profileRevision").fill("A");
  await page.getByRole("button", { name: "Apply shared profile" }).click();
  assert.equal(
    await page.evaluate(
      () => Workbench.study.cases.filter((c) => Workbench.result(c)).length,
    ),
    0,
  );
  // Import the real workbook, verify preview and apply transaction.
  await page
    .locator("#excelFile")
    .setInputFiles(path.join(root, "vibration_spectra_template.xlsx"));
  await page.getByRole("button", { name: "Apply import" }).waitFor();
  assert.match(
    await page.locator("#editorBody").innerText(),
    /3 cases and 4 profiles/,
  );
  await page.getByRole("button", { name: "Apply import" }).click();
  // Build a realistic seven-case study with mixed shared and distinct inputs.
  await page.evaluate(() => {
    const s = Workbench.study;
    for (let i = 4; i <= 7; i++) {
      const c = WBModel.copy(s.cases[(i - 4) % 3]);
      c.id = "C0" + i;
      c.name = "Comparison " + i;
      c.inputs.duration = String(15 * i);
      c.inputs.peakMode = i === 7 ? "fixed" : "extreme";
      s.cases.push(c);
    }
    return Workbench.refresh();
  });
  await page.evaluate(() => Workbench.calculate(true));
  await ready();
  assert.equal(
    await page.evaluate(
      () => Workbench.study.cases.filter((c) => Workbench.result(c)).length,
    ),
    7,
  );
  await page.locator("#summaryScope").selectOption("frequency");
  await page.locator("#coverageView").selectOption("envelope");
  await ready();
  await page.evaluate(() => Workbench.actions.appearance());
  await page.locator('#f_vrsFactor').fill('4.5');
  await page.locator('#f_legendMode').selectOption('boxed');
  await page.getByRole('button', {name:'Apply appearance'}).click();await ready();
  await page.evaluate(() => Workbench.actions.export());
  const ppt = await download(
    page.getByRole("button", { name: "PowerPoint", exact: true }),
    "seven-case-workbench.pptx",
  );
  const zip = await JSZip.loadAsync(await fs.readFile(ppt));
  const slides = Object.keys(zip.files).filter((x) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(x),
  );
  assert.equal(slides.length, 29);
  const notes = await zip
    .file("ppt/notesSlides/notesSlide2.xml")
    .async("string");
  assert.match(notes, /peakProbability/);
  assert.match(notes, /sineRevision/);
  assert.match(notes, /coverageView/);
  assert.match(notes, /envelope/);
  assert.match(notes, /vrsFactor/);
  assert.match(notes, /boxed/);
  const report = await download(
    page.getByRole("button", { name: "HTML report", exact: true }),
    "seven-case-report.html",
  );
  assert.match(await fs.readFile(report, "utf8"), /Exact calculation inputs/);
  assert.match(await fs.readFile(report, "utf8"), /calculated point/);
  await download(
    page.getByRole("button", { name: "Summary CSV", exact: true }),
    "summary.csv",
  );
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  const csvEvent=page.waitForEvent('download');
  await page.evaluate(()=>Workbench.actions.csv());
  const csvDownload=await csvEvent;await csvDownload.saveAs(path.join(out,'all-scenarios.csv'));
  const csvText=await fs.readFile(path.join(out,'all-scenarios.csv'),'utf8');
  const rowCount=await page.evaluate(()=>Workbench.result(Workbench.study.cases[0]).reduce((n,s)=>n+s.r.rows.length,0));
  assert.equal(csvText.split('\r\n').length,rowCount+1);
  assert.match(csvText,/effective_k/);
  await page.evaluate(() => Workbench.actions.readme());
  assert.match(await page.locator("#readmeArticle").innerText(), /1\.131909/);
  assert.equal(
    await page.locator('#readmeArticle a[href^="https:"]').count(),
    8,
  );
  await page.locator("#readmeSearch").fill("Dirlik");
  await page.locator("#findReadme").click();
  await page.screenshot({ path: path.join(out, "readme.png") });
  await page
    .getByRole("button", { name: "Add this worked example as a case" })
    .click();
  await page
    .getByRole("button", { name: "Run comparison", exact: true })
    .click();
  await ready();
  assert.equal(
    await page.evaluate(
      () =>
        Workbench.chosen(
          Workbench.study.cases.find((c) => c.id === Workbench.study.active),
        ).c.b,
    ),
    4,
  );
  // A cancelled worker must not publish partial results.
  await page.evaluate(() => {
    Workbench.actions.runAll().catch(() => {});
    setTimeout(() => Workbench.actions.cancel(), 10);
  });
  await page.waitForFunction(() => !Workbench.busy);
  await page.waitForTimeout(300);
  await page.locator('#openFile').setInputFiles(path.join(root,'example-case.json'));
  await page.getByRole('button',{name:'Apply import'}).waitFor();
  await page.getByRole('button',{name:'Apply import'}).click();
  assert.equal(await page.evaluate(()=>Workbench.study.cases[0].inputs.peakMode),'fixed');
  await page.getByRole('button',{name:'Run comparison',exact:true}).click();await ready();
  assert.equal(
    requests.length,
    0,
    "Unexpected external requests: " + requests.join("\n"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: all plot controls, shared invalidation, Excel, seven cases / 63 scenarios, 29-slide export, HTML/CSV/SVG, README, example and offline operation.",
  );
} finally {
  await browser.close();
}
