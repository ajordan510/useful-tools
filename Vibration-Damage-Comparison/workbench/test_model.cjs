const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  E = require("../engine.js"),
  M = require("./model.js"),
  X = require("./excel.js"),
  XLSX = require("../vendor/xlsx.full.min.js");
const close = (a, b, t = 1e-10) =>
  assert.ok(
    Math.abs(a - b) <= t * Math.max(1e-20, Math.abs(b)),
    `${a} != ${b}`,
  );
(async () => {
  const study = M.validate(M.initial()),
    c = study.cases[0],
    raw = M.raw(study, c);
  const all = await M.run(
    {
      ...raw,
      fmin: 90,
      fmax: 110,
      inspectFn: 100,
      modesText: "100",
      passes: 2,
    },
    [4, 6, 8],
    [5, 10, 20],
  );
  assert.equal(all.length, 9);
  global.VDC = E;
  const P = require("node:vm").runInNewContext(
    fs.readFileSync(require("node:path").join(__dirname, "plots.js"), "utf8") + ";WBPlots",
    { VDCReport: require("../reporting.js") },
  );
  const picked = all.find(s => s.c.b === 6 && s.c.Q === 10);
  const scoped = { ...picked, c: { ...picked.c, scope: "modes", modes: [100] } };
  const dc = P.displayContext(scoped, {summaryScope: "frequency", frequency: 107});
  assert.deepEqual(Array.from(dc.frequencies), [100]);
  assert.equal(dc.frequency, 100);
  const matrix = P.specs(picked, all, {summaryScope: "frequency", frequency: 100}).find(f => f.id === "heatmap");
  const z = P.figure(matrix).data[0].z;
  matrix.bs.forEach((b,i) => matrix.qs.forEach((Q,j) =>
    close(z[i][j], all.find(s => s.c.b === b && s.c.Q === Q).r.rows.find(r => r.fn === 100).margin)));
  c.display = {summaryScope: "frequency", summaryMetric: "peak", frequency: 100, coverageView: "envelope"};
  assert.deepEqual(M.validate(study).cases[0].display, { ...c.display, vrsFactor: 3, legendMode: "above" });
  const peakSpec = P.specs(picked, all, {vrsFactor: 4.5}).find(f => f.id === "peakResponsePlot");
  peakSpec.series[2].data.forEach((point,i) => close(point[1], 4.5 * picked.r.rows[i].sigma * 1000));
  assert.match(peakSpec.legendTitle, /b = 6.*Q = 10/);
  const boxed = P.figure(peakSpec, {legend: {mode: "boxed", x: 0.4, y: 0.7}});
  assert.equal(boxed.layout.legend.borderwidth, 1);
  assert.equal(boxed.layout.legend.bgcolor, "#ffffff");
  assert.equal(boxed.layout.legend.x, 0.4);
  assert.equal(boxed.config.edits.legendPosition, true);
  assert.ok(boxed.data.filter(x=>x.mode === "lines").every(x=>x.line.dash === "solid"));
  assert.deepEqual(Array.from(boxed.data.slice(0,3).map(x=>x.line.color)), ["#1171be", "#dd5400", "#edb120"]);
  c.display.vrsFactor = 0;
  assert.throws(() => M.validate(study), /VRS factor/);
  c.display.vrsFactor = 3;
  c.views.peakResponsePlot = {legend: {mode: "boxed", x: 0.4, y: 0.7, xanchor: "right", yanchor: "top"}};
  assert.deepEqual(M.validate(study).cases[0].views.peakResponsePlot, c.views.peakResponsePlot);
  const signatureBeforeView = M.signature(study, c);
  c.display.frequency = 105;
  assert.equal(M.signature(study, c), signatureBeforeView);
  c.display.summaryMetric = "invalid";
  assert.throws(() => M.validate(study), /Invalid summaryMetric/);
  c.display.summaryMetric = "fatigue";
  for (const s of all) {
    const direct = E.analyze(s.c, { skipSensitivity: true });
    for (let j = 0; j < s.r.rows.length; j++)
      for (const k of [
        "sigma",
        "heritage",
        "random",
        "margin",
        "peakRandom",
        "peakRatio",
      ])
        close(s.r.rows[j][k], direct.rows[j][k]);
    close(s.r.worst.margin, direct.worst.margin);
  }
  for (const Q of [5, 10, 20]) {
    const a = all.filter((s) => s.c.Q === Q);
    for (const r of a)
      close(r.r.peakWorst.peakRatio, a[0].r.peakWorst.peakRatio);
  }
  assert.equal(
    M.legacy(
      JSON.parse(
        fs.readFileSync(
          new URL(
            "../example-case.json",
            "file:///" + __filename.replace(/\\/g, "/"),
          ),
          "utf8",
        ),
      ),
    ).cases[0].inputs.peakMode,
    "fixed",
  );
  const rows = X.exampleRows(),
    imported = X.fromRows(rows);
  assert.equal(imported.cases.length, 3);
  assert.equal(imported.profiles.length, 4);
  assert.equal(imported.cases[0].sineId, imported.cases[1].sineId);
  assert.notEqual(imported.cases[1].sineId, imported.cases[2].sineId);
  const actual = X.read(
    fs.readFileSync(
      require("node:path").join(
        __dirname,
        "../vibration_spectra_template.xlsx",
      ),
    ),
    XLSX,
  );
  assert.equal(actual.cases.length, 3);
  const bad = M.copy(rows);
  bad.Random[2][1] = bad.Random[1][1];
  assert.throws(() => X.fromRows(bad), /Random, row 3/);
  const dup = M.copy(rows);
  dup.Settings.push(dup.Settings[1]);
  assert.throws(() => X.fromRows(dup), /Duplicate case setting/);
  const formula = XLSX.read(
    fs.readFileSync(
      require("node:path").join(
        __dirname,
        "../vibration_spectra_template.xlsx",
      ),
    ),
  );
  formula.Sheets.Random.B2.f = "1+1";
  assert.throws(
    () =>
      X.read(XLSX.write(formula, { type: "buffer", bookType: "xlsx" }), XLSX),
    /Random, row 2/,
  );
  const unknown = M.copy(study);
  unknown.cases[0].sineId = "missing";
  assert.throws(() => M.validate(unknown), /missing sine/);
  assert.throws(() => M.list("4,NaN", "b", 2, 12));
  assert.throws(() => M.list("", "b", 2, 12));
  const before = M.signature(study, c);
  study.profiles[0].text = "20,2000,accel_g_pk,9,9";
  assert.notEqual(M.signature(study, c), before);
  c.views.ratioPlot = {
    x: { type: "log", range: [1, 2] },
    y: { type: "linear", range: [0, 2] },
  };
  assert.deepEqual(M.validate(study).cases[0].views, c.views);
  c.views.ratioPlot.x.range = [2, 1];
  assert.throws(() => M.validate(study), /Invalid saved axis/);
  let cancelled = false;
  await assert.rejects(
    () =>
      M.run(
        raw,
        [4],
        [10],
        () => {
          cancelled = true;
        },
        () => cancelled,
      ),
    /cancelled/,
  );
  const legacy = JSON.parse(
    fs.readFileSync(
      require("node:path").join(
        __dirname,
        "../reference/irvine-2011-case.json",
      ),
    ),
  );
  const reference = M.legacy(legacy);
  const rr = await M.run(M.raw(reference, reference.cases[0]), [4], [10]);
  close(rr[0].r.worst.ratio, 1.131908593, 1e-8);
  const fixtures = [
    {
      name: "narrowband",
      raw: {
        ...M.defaults,
        sineText: "90,110,accel_g_pk,1,1",
        psdText: "90,0.03\n110,0.03",
        fmin: 90,
        fmax: 110,
        inspectFn: 100,
        modesText: "100",
        duration: 2,
        peakMode: "extreme",
        peakProbability: 99,
      },
    },
    {
      name: "broadband",
      raw: {
        ...M.defaults,
        sineText: "20,400,accel_g_pk,1,1",
        psdText: "20,0.02\n400,0.02",
        fmin: 20,
        fmax: 400,
        inspectFn: 100,
        modesText: "100",
        Q: 5,
        duration: 2,
        peakMode: "extreme",
        peakProbability: 99,
      },
    },
  ];
  fs.mkdirSync(
    require("node:path").join(__dirname, "../_paper_build/workbench"),
    { recursive: true },
  );
  fs.writeFileSync(
    require("node:path").join(
      __dirname,
      "../_paper_build/workbench/simulation-fixtures.json",
    ),
    JSON.stringify(
      fixtures.map(({ name, raw }) => {
        const c = E.parse(raw);
        return {
          name,
          c,
          rows: [4, 6].map((b) => E.atMode(c, 100, c.Q, b)),
          peaks: [0.5, 0.99].map((p) => ({
            p,
            k: E.extremePeakFactor(E.atMode(c, 100).nu0 * 5, p),
          })),
        };
      }),
      null,
      2,
    ),
  );
  console.log(
    "Workbench model: 9 Cartesian scenarios agree with uncached baseline; imports, workbook, validation, cache invalidation, view roundtrip and cancellation passed.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
