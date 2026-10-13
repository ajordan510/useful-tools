const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  M = require("./model.js");
(async () => {
  const raw = { ...M.defaults, passes: "0", density: "24" },
    bs = [4, 8, 12],
    qs = [5, 50, 100];
  const low = await M.run(raw, bs, qs),
    high = await M.run({ ...raw, density: "48" }, bs, qs);
  const report = low.map((a, i) => {
    const b = high[i],
      fatigue = Math.abs(b.r.worst.margin / a.r.worst.margin - 1),
      peak = Math.abs(b.r.peakWorst.peakRatio / a.r.peakWorst.peakRatio - 1);
    assert(
      fatigue < 0.03 && peak < 0.03,
      "Frequency refinement exceeds preselected 3% check for the illustrative broad-band matrix.",
    );
    return {
      b: a.c.b,
      Q: a.c.Q,
      fatigueRelativeChange: fatigue,
      peakRelativeChange: peak,
      coarseFatigueFrequency: a.r.worst.fn,
      fineFatigueFrequency: b.r.worst.fn,
    };
  });
  fs.writeFileSync(
    path.join(__dirname, "resolution-validation.json"),
    JSON.stringify(
      {
        coarseDensity: 24,
        fineDensity: 48,
        criterion:
          "Under 3% minimum-coverage change for this illustrative 9-scenario matrix. This is a regression check, not a bound for arbitrary spectra.",
        results: report,
      },
      null,
      2,
    ),
  );
  console.log(
    "Frequency refinement passed; max fatigue change",
    Math.max(...report.map((x) => x.fatigueRelativeChange)),
    "max peak change",
    Math.max(...report.map((x) => x.peakRelativeChange)),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
