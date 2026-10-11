import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
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
await run();
assert.equal(await page.locator("#analysis").isVisible(), true);
assert.equal(await page.locator("#method").isVisible(), false);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.goto(new URL("file://" + path.join(out, "report.html")).href);
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
  "PASS browser: file:// calculation, 6 plots, CSV/SVG/case/report exports, case roundtrip, stale-result protection, known modes, alternate method/rate, validation errors, mobile result navigation, method-tab run, blocked scripts, startup failure diagnostics, saved report and zero network requests.",
);
