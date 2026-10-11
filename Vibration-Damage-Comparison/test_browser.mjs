import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const out =
  process.env.TEST_ARTIFACT_DIR || path.join(root, "_paper_build", "browser");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
  errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) requests.push(r.url());
});
await page.goto(
  new URL("vibration_damage_comparison.html", import.meta.url).href,
);
assert.equal(await page.locator("#startup").isVisible(), false);
assert.ok(
  (await page.locator("#status").innerText()).includes("Calculator ready"),
);
async function run() {
  await page.click("#run");
  await page.waitForFunction(() => !document.querySelector("#run").disabled);
  assert.ok(
    !(await page.locator("#status").getAttribute("class")).includes("error"),
    await page.locator("#status").innerText(),
  );
}
await run();
assert.equal(await page.locator(".chart svg").count(), 6);
assert.equal(await page.locator("#csv").isEnabled(), true);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.screenshot({ path: path.join(out, "desktop.png") });
async function save(button, name) {
  const event = page.waitForEvent("download");
  await page.click(button);
  const d = await event;
  await d.saveAs(path.join(out, name));
  return fs.readFileSync(path.join(out, name), "utf8");
}
const saved = await save("#saveCase", "case.json");
assert.equal(JSON.parse(saved).schema, "vdc-case-1");
const csv = await save("#csv", "results.csv");
assert.ok(csv.includes("heritage_index"));
assert.ok(csv.includes("m4_m2_Hz4"));
assert.ok(csv.includes("Dirlik_D1"));
assert.ok(csv.split("\n").length > 420);
const svg = await save('[data-svg="ratioPlot"]', "ratio.svg");
assert.ok(svg.includes("<svg"));
const report = await save("#report", "report.html");
assert.ok(report.includes("Complete input record"));
assert.ok(report.includes("35,0,8,1000000,1"));
assert.ok(!report.includes("<script>"));
await page.fill("#Q", "20");
assert.equal(await page.locator("#csv").isDisabled(), true);
assert.equal(await page.locator("#report").isDisabled(), true);
await page.setInputFiles("#loadCase", {
  name: "case.json",
  mimeType: "application/json",
  buffer: Buffer.from(saved),
});
await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Case loaded."));
assert.equal(await page.locator("#Q").inputValue(), "10");
await page.selectOption("#scope", "modes");
await run();
assert.ok(
  (await page.locator("#rowTable h3").innerText()).includes("3 frequencies"),
);
assert.ok(
  (await page.locator("#results").innerText()).includes(
    "Modeled fatigue target met",
  ),
);
await page.selectOption("#methodSelect", "nb");
await page.selectOption("#sweepType", "linear");
await page.fill("#sweepRate", "20");
await run();
assert.ok((await page.locator("#results").innerText()).includes("Narrowband"));
await page.fill("#dwellText", "");
await page.fill("#passes", "0");
await page.click("#run");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.ok(
  (await page.locator("#status").innerText()).includes("Enter a dwell"),
);
assert.equal(await page.locator("#csv").isDisabled(), true);
await page.click("#demo");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
await page.setViewportSize({ width: 390, height: 844 });
await run();
assert.equal(
  await page
    .locator("#results")
    .evaluate((el) => document.activeElement === el),
  true,
);
assert.ok(
  await page.locator("#results").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= -1 && rect.top < innerHeight;
  }),
);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.screenshot({ path: path.join(out, "mobile-top.png") });
await page.locator("#results").scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(out, "mobile-results.png") });
await page.click('[data-tab="method"]');
assert.equal(await page.locator("#method").isVisible(), true);
await page.click("#verifyReference");
assert.ok(
  (await page.locator("#referenceStatus").innerText()).startsWith(
    "PASS: Dirlik 1595.031603 s; narrowband 1064.200649 s.",
  ),
);
await run();
assert.equal(await page.locator("#analysis").isVisible(), true);
assert.equal(await page.locator("#method").isVisible(), false);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
// Hypothetical dwell mode: controls, boundary validation, independent credit and exports.
await page.selectOption("#dwellMode", "assumed");
assert.equal(await page.locator("#scope").inputValue(), "bank");
assert.equal(await page.locator("#assumedDwellFields").isVisible(), true);
assert.equal(await page.locator("#documentedDwellFields").isVisible(), false);
assert.equal(await page.locator("#csv").isDisabled(), true);
await page.fill("#passes", "0");
await page.click("#run");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.match(await page.locator("#status").innerText(), /discontinuous sine boundary/);
await page.selectOption("#assumedBoundary", "lower");
await run();
assert.match(await page.locator("#results").innerText(), /Hypothetical resonance screening/);
assert.equal(await page.locator("#dwellExposure tbody tr").count(), 1);
assert.match(await page.locator("#dwellExposure").innerText(), /120/);
assert.match(await page.locator("#gapSummary").innerText(), /0×/);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
await page.screenshot({ path: path.join(out, "assumed-mobile-results.png") });
const assumedCSV = await save("#csv", "assumed-results.csv");
assert.match(assumedCSV, /assumed_dwell_seconds_per_repeat/);
assert.match(assumedCSV, /outside sine profile; no dwell credit/);
const assumedReport = await save("#report", "assumed-report.html");
assert.match(assumedReport, /Hypothetical resonance screening/);
assert.match(assumedReport, /Assumed dwell at inspected resonance/);
const assumedSaved = await save("#saveCase", "assumed-case.json");
assert.equal(JSON.parse(assumedSaved).inputs.dwellMode, "assumed");
await page.fill("#assumedHours", "0");
await page.fill("#assumedCycles", "0");
await page.click("#run");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.match(await page.locator("#status").innerText(), /positive time or cycle cap/);
await page.setInputFiles("#loadCase", {
  name: "assumed-case.json", mimeType: "application/json", buffer: Buffer.from(assumedSaved),
});
await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Case loaded."));
assert.equal(await page.locator("#assumedHours").inputValue(), "8");
assert.equal(await page.locator("#assumedBoundary").inputValue(), "lower");
await page.setViewportSize({ width: 1440, height: 1100 });
await page.locator("#assumedDwellFields").screenshot({ path: path.join(out, "assumed-controls.png") });
await run();
await page.screenshot({ path: path.join(out, "assumed-desktop-results.png") });
const roundtripCSV = await save("#csv", "assumed-roundtrip.csv");
assert.equal(roundtripCSV.split("\n").filter((x) => !x.startsWith("#")).join("\n"),
  assumedCSV.split("\n").filter((x) => !x.startsWith("#")).join("\n"));
// Entire bank outside the sine profile: zero coverage must remain visible and exportable.
await page.fill("#fmin", "600");
await page.fill("#fmax", "800");
await page.fill("#inspectFn", "700");
await page.fill("#modesText", "");
await run();
assert.match(await page.locator("#dwellExposure").innerText(), /Outside sine profile/);
assert.ok(await page.locator("#ratioPlot circle").count() > 0);
assert.ok(!(await page.locator("#ratioPlot svg").evaluate((el) => el.outerHTML)).includes("NaN"));
await page.screenshot({ path: path.join(out, "assumed-zero-results.png") });
// Import a pre-feature case after assumed mode. It must restore documented behavior.
await page.setInputFiles("#loadCase", path.join(root, "example-case.json"));
await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Case loaded."));
assert.equal(await page.locator("#dwellMode").inputValue(), "documented");
assert.equal(await page.locator("#documentedDwellFields").isVisible(), true);
await run();
assert.equal(await page.locator("#dwellExposure tbody tr").count(), 3);
await page.click("#referenceCase");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.equal(await page.locator("#csv").isEnabled(), true);
assert.equal(await page.locator("#b").inputValue(), "4");
const referenceCSV = await save("#csv", "analysis-results.csv");
assert.ok(referenceCSV.includes("1.131908593"));
const referenceReport = await save("#report", "analysis-report.html");
assert.ok(referenceReport.includes("Reference example: 100 Hz"));
assert.ok(!referenceReport.includes("<button"));
// Tutorial is independent of the working case and result-export registry.
const tutorialWorkspace = await page.evaluate(() => ({
  inputs: raw(), csv: csvText(), ratioSVG: chartRegistry.ratioPlot.svg,
}));
await page.click('[data-tab="tutorial"]');
assert.equal(await page.locator("#tutorial").isVisible(), true);
assert.equal(await page.locator("#analysis").isVisible(), false);
assert.equal(await page.locator("#method").isVisible(), false);
assert.equal(await page.locator("#tutorial svg").count(), 4);
assert.equal(await page.locator('[data-tut="coverage"]').first().innerText(), "1.1319×");
assert.equal(await page.locator('[data-tut="sineIndex"]').first().innerText(), "11.4226");
assert.equal(await page.locator('[data-tut="randomIndex"]').first().innerText(), "10.0915");
assert.equal(await page.locator('[data-tut="peakCoverage"]').innerText(), "0.4332×");
assert.equal(await page.locator("#tutorialModeRows tr").count(), 3);
assert.equal(await page.locator("#tutorial [data-tut]").evaluateAll((els) =>
  els.every((el) => el.textContent.length > 0 && !/undefined|NaN/.test(el.textContent))), true);
for (const section of ["learn-oscillator", "learn-random", "learn-results", "learn-unknown"]) {
  await page.locator(`#${section}`).screenshot({ path: path.join(out, `tutorial-${section}.png`) });
}
await page.selectOption("#tutorialCycles", "6000");
assert.equal(await page.locator("#tutorialExperimentCoverage").innerText(), "2.2638×");
await page.selectOption("#tutorialRandomSeconds", "60");
assert.equal(await page.locator("#tutorialExperimentCoverage").innerText(), "1.1319×");
await page.selectOption("#tutorialCycles", "1500");
assert.equal(await page.locator("#tutorialExperimentCoverage").innerText(), "0.28298×");
assert.match(await page.locator("#tutorialExperimentResult").innerText(), /below target/);
// Static worked-example numbers remain fixed when the local experiment changes.
assert.equal(await page.locator('[data-tut="coverage"]').first().innerText(), "1.1319×");
assert.deepEqual(await page.evaluate(() => ({
  inputs: raw(), csv: csvText(), ratioSVG: chartRegistry.ratioPlot.svg,
})), tutorialWorkspace);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(() => {
  const plot = document.querySelector("#tutorialTransfer");
  return Math.abs(plot.clientWidth - plot.querySelector("svg").viewBox.baseVal.width) < 1;
});
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
assert.deepEqual(await page.locator(".tutorial-plot svg").evaluateAll((els) =>
  els.flatMap((svg) => {
    const box = svg.getBoundingClientRect();
    return [...svg.querySelectorAll("text")].filter((el) => {
      const t = el.getBoundingClientRect();
      return t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1;
    }).map((el) => el.textContent);
  })), []);
for (const section of ["learn-oscillator", "learn-random", "learn-unknown", "learn-experiment"]) {
  await page.locator(`#${section}`).screenshot({ path: path.join(out, `tutorial-mobile-${section}.png`) });
}
await page.click("#tutorialLoadDocumented");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.equal(await page.locator("#analysis").isVisible(), true);
assert.equal(await page.locator("#tutorial").isVisible(), false);
assert.equal(await page.locator("#dwellMode").inputValue(), "documented");
assert.ok(Math.abs(await page.evaluate(() => last.r.inspect.ratio) - 1.131908593) < 1e-8);
await page.click('[data-tab="tutorial"]');
const tutorialMinimum = await page.evaluate(() => tutorialNumbers().minimum.assumed.margin);
await page.click("#tutorialLoadAssumed");
await page.waitForFunction(() => !document.querySelector("#run").disabled);
assert.equal(await page.locator("#dwellMode").inputValue(), "assumed");
assert.equal(await page.locator("#scope").inputValue(), "bank");
assert.equal(await page.locator("#assumedCycles").inputValue(), "3000");
assert.equal(await page.locator("#passes").inputValue(), "0");
assert.equal(await page.locator("#csv").isEnabled(), true);
assert.equal(await page.evaluate(() => last.r.worst.margin), tutorialMinimum);
assert.equal(await page.evaluate(() => last.r.rows.every((r) =>
  r.contributions.length === 1 && r.contributions[0].f === r.fn)), true);
await page.goto(
  pathToFileURL(path.join(out, "analysis-report.html")).href,
);
assert.equal(await page.locator("svg").count(), 6);
await page.setViewportSize({ width: 1100, height: 1000 });
await page.screenshot({ path: path.join(out, "report.png") });
assert.deepEqual(errors, []);
assert.deepEqual(requests, []);
// Attachment previews may render the form while disallowing all JavaScript.
const blockedContext = await browser.newContext({ javaScriptEnabled: false });
const blockedPage = await blockedContext.newPage();
await blockedPage.goto(
  new URL("vibration_damage_comparison.html", import.meta.url).href,
);
assert.equal(await blockedPage.locator("#startup").isVisible(), true);
assert.equal(await blockedPage.locator("#run").isDisabled(), true);
assert.ok(
  (await blockedPage.locator("#startup").innerText()).includes(
    "Download this HTML file",
  ),
);
await blockedContext.close();
// A failed engine must leave an actionable message, not a live-looking Run button.
const brokenPage = await browser.newPage();
const packaged = fs.readFileSync(
  path.join(root, "vibration_damage_comparison.html"),
  "utf8",
);
await brokenPage.setContent(
  packaged.replace(
    "const api = factory();",
    'throw new Error("Simulated engine startup failure");',
  ),
);
assert.equal(await brokenPage.locator("#startup").isVisible(), true);
assert.equal(await brokenPage.locator("#run").isDisabled(), true);
assert.ok(
  (await brokenPage.locator("#startup").innerText()).includes("browser error"),
);
await brokenPage.close();
await browser.close();
console.log(
  "PASS browser: file:// calculation, 6 plots, CSV/SVG/case/report exports, documented and assumed case roundtrip, legacy imports, validation, zero coverage, stale-result protection, mobile layout, tutorial calculations/plots/experiment/isolation/example loaders, blocked scripts, startup failure diagnostics, saved report and zero network requests.",
);
