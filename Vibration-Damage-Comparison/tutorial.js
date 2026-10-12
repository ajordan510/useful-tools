// Tutorial visual contract:
// - SDOF schematic (tutorial.html): conceptual parallel spring/damper topology;
//   x and y are upward motion coordinates, z = x - y. Not to scale.
// - Transfer plot: calculated response of one fixed 100 Hz, Q=10 oscillator.
// - Response PSD: calculated H^2 filtering; area gives displacement variance.
// - Coverage comparison: calculated alternative natural frequencies, identical
//   specifications, one actual dwell versus one local hypothetical dwell.
// Provenance: REFERENCE.case.inputs and VDC, with original editable SVG output.
// All figures use light backgrounds, readable labels, captions and text alternatives.
// The tutorial has its own plot renderer and state; it cannot overwrite result exports.
let tutorialData = null;
let tutorialResizeTimer;

function tutorialInputs(mode = "documented") {
  const inputs = { ...REFERENCE.case.inputs, dwellMode: mode };
  if (mode === "assumed") Object.assign(inputs, {
    caseName: "Tutorial: independent assumed resonances, 90–110 Hz",
    basis: "Educational extension of the checked 100 Hz reference case. Each possible resonance receives only its own 1 g peak, 3000-cycle dwell. No sweeps. Random: 0.03 g²/Hz over 90–110 Hz for 30 seconds.",
    dwellText: "", assumedHours: "0", assumedCycles: "3000",
    assumedRepeats: "1", assumedBoundary: "reject", scope: "bank", density: "192",
  });
  return inputs;
}

function tutorialNumbers() {
  if (tutorialData) return tutorialData;
  const documented = VDC.parse(tutorialInputs());
  const assumed = VDC.parse(tutorialInputs("assumed"));
  const reference = VDC.atMode(documented, 100);
  const frequencies = VDC.grid(assumed);
  const rows = frequencies.map((fn) => ({
    fn, documented: VDC.atMode(documented, fn), assumed: VDC.atMode(assumed, fn),
  }));
  const minimum = rows.reduce((a, b) => a.assumed.margin < b.assumed.margin ? a : b);
  tutorialData = { documented, assumed, reference, rows, minimum };
  return tutorialData;
}

// Responsive, linear-frequency SVG plots with fixed, explicit scales.
// Plot dimensions follow the visible container so mobile labels stay at 12px.
function tutorialPlot(id, series, options) {
  const host = $(id), W = Math.max(260, Math.floor(host.clientWidth));
  const H = 300, L = 78, R = 16, T = 16, B = 54;
  const { xmin, xmax, ymin, ymax, xticks, yticks, logY = false,
    xLabel, yLabel, alt, threshold = null, marker = null } = options;
  const X = (x) => L + (x - xmin) / (xmax - xmin) * (W - L - R);
  const Y = (y) => H - B - (logY
    ? Math.log(y / ymin) / Math.log(ymax / ymin)
    : (y - ymin) / (ymax - ymin)) * (H - T - B);
  let marks = "";
  for (const x of xticks) {
    marks += `<line x1="${X(x)}" y1="${T}" x2="${X(x)}" y2="${H - B}" stroke="#e1e8ed"/><text x="${X(x)}" y="${H - B + 22}" text-anchor="middle">${fmt(x, 4)}</text>`;
  }
  for (const y of yticks) {
    marks += `<line x1="${L}" y1="${Y(y)}" x2="${W - R}" y2="${Y(y)}" stroke="#e1e8ed"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${Number(y.toPrecision(3))}</text>`;
  }
  if (threshold !== null) marks += `<line x1="${L}" x2="${W - R}" y1="${Y(threshold)}" y2="${Y(threshold)}" stroke="#a93636" stroke-width="1.5" stroke-dasharray="3 4"/><text x="${W - R - 4}" y="${Y(threshold) - 7}" text-anchor="end">Target = ${threshold}</text>`;
  for (const s of series) {
    const points = s.data.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`);
    if (s.fill) marks += `<path d="M${X(s.data[0][0])},${Y(ymin)} L${points.join(" L")} L${X(s.data.at(-1)[0])},${Y(ymin)}Z" fill="${s.color}" opacity="0.08"/>`;
    marks += `<polyline points="${points.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="8 5"' : ""}/>`;
  }
  if (marker) marks += `<circle cx="${X(marker[0])}" cy="${Y(marker[1])}" r="4" fill="#fff" stroke="#172d40" stroke-width="2"><title>100 Hz: ${fmt(marker[1], 5)}</title></circle>`;
  marks += `<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}</text><text transform="translate(15,${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  host.innerHTML = `<div class="tutorial-legend">${series.map((s) => `<span><i class="tutorial-line ${s.dashed ? "dashed" : ""}" style="border-color:${s.color}" aria-hidden="true"></i>${esc(s.label)}</span>`).join("")}</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}Title" style="font:12px system-ui;fill:#304c5d"><title id="${id}Title">${esc(alt)}</title><rect width="${W}" height="${H}" fill="white"/>${marks}</svg>`;
}

function renderTutorial() {
  const { documented, reference: r, rows, minimum } = tutorialNumbers();
  const values = {
    inputRMS: fmt(Math.sqrt(VDC.integralPSD(documented.psd)), 5),
    sineMm: fmt(r.peakSine * 1000, 5), sineIndex: fmt(r.dwell, 6),
    responseVariance: fmt(r.m[0] * 1e6, 5), randomRmsMm: fmt(r.sigma * 1000, 5),
    randomIndex: fmt(r.dirlik, 6), narrowbandIndex: fmt(r.nb, 6), alpha: fmt(r.alpha, 5),
    coverage: fmt(r.margin, 5) + "×", damageSurplus: fmt((r.ratio - 1) * 100, 3),
    equivalentSeconds: fmt(r.eqMinutes * 60, 5),
    amplitudePercent: fmt((r.amplitudeReserve - 1) * 100, 3),
    peakCoverage: fmt(r.peakRatio, 4) + "×", randomPeakMm: fmt(r.peakRandom * 1000, 5),
    seconds95: fmt(3000 / 95, 5), seconds105: fmt(3000 / 105, 5),
    assumedMinimum: fmt(minimum.assumed.margin, 5) + "×",
    assumedWorstHz: fmt(minimum.fn, 6),
  };
  document.querySelectorAll("[data-tut]").forEach((el) => {
    el.textContent = values[el.dataset.tut];
  });
  const transfer = Array.from({ length: 321 }, (_, i) => {
    const f = 60 + i / 4;
    return [f, VDC.transfer(f, 100, documented.Q) * 1000];
  });
  tutorialPlot("tutorialTransfer", [{ label: "100 Hz oscillator · Q = 10", data: transfer, color: "#087f83" }], {
    xmin: 60, xmax: 140, ymin: 0, ymax: 0.3,
    xticks: [60, 80, 100, 120, 140], yticks: [0, 0.1, 0.2, 0.3],
    xLabel: "Excitation frequency, Hz", yLabel: "Relative motion, mm / peak g",
    alt: "Calculated sine transfer: a fixed 100 Hz oscillator reaches about 0.2484 millimetres per peak g near resonance, with much less response at 60 or 140 Hz.",
    marker: [100, r.peakSine * 1000],
  });
  const response = Array.from({ length: 201 }, (_, i) => {
    const f = 90 + i / 10;
    return [f, VDC.psdAt(f, documented.psd) * VDC.transfer(f, 100, documented.Q) ** 2 * 1e6];
  });
  tutorialPlot("tutorialResponse", [{ label: "Displacement response PSD", data: response, color: "#087f83", fill: true }], {
    xmin: 90, xmax: 110, ymin: 0, ymax: 0.002,
    xticks: [90, 95, 100, 105, 110], yticks: [0, 0.0005, 0.001, 0.0015, 0.002],
    xLabel: "Excitation frequency, Hz", yLabel: "Response PSD, mm²/Hz",
    alt: "Calculated relative-displacement PSD peaks near 100 Hz despite a flat input PSD. Its integrated area gives 0.14337 millimetres RMS for the 100 Hz oscillator.",
  });
  tutorialPlot("tutorialCoverage", [
    { label: "Documented dwell at 100 Hz", color: "#087f83", data: rows.map((x) => [x.fn, x.documented.margin]) },
    { label: "Independent resonant dwell", color: "#172d40", dashed: true, data: rows.map((x) => [x.fn, x.assumed.margin]) },
  ], {
    xmin: 90, xmax: 110, ymin: 0.05, ymax: 10, logY: true,
    xticks: [90, 95, 100, 105, 110], yticks: [0.1, 1, 10], threshold: 1,
    xLabel: "Possible natural frequency, Hz", yLabel: "Coverage R / target · log scale",
    alt: "Documented and independently assumed dwell coverage coincide at 1.1319 at 100 Hz. The documented dwell falls below target away from 100 Hz, while independent resonant dwells meet the target across the sampled 90–110 Hz range.",
    marker: [100, r.margin],
  });
  $("tutorialModeRows").innerHTML = [95, 100, 105].map((f) => {
    const d = VDC.atMode(documented, f), a = VDC.atMode(tutorialData.assumed, f);
    return `<tr><td>${f} Hz</td><td>${fmt(d.margin, 5)}×</td><td>${fmt(a.margin, 5)}×</td></tr>`;
  }).join("");
  updateTutorialExperiment();
}

function updateTutorialExperiment() {
  const cycles = +$("tutorialCycles").value;
  const seconds = +$("tutorialRandomSeconds").value;
  const c = VDC.parse({ ...tutorialInputs(), duration: seconds / 60,
    dwellText: `100,1,0,${cycles},1` });
  const r = VDC.atMode(c, 100);
  $("tutorialExperimentResult").innerHTML = `<strong>100 Hz fatigue coverage: <span id="tutorialExperimentCoverage">${fmt(r.margin, 5)}×</span> — ${r.margin >= 1 ? "target met" : "below target"}.</strong><br>Sine index ${fmt(r.heritage, 6)}; random index ${fmt(r.random, 6)}.<br>Peak-screen ratio stays ${fmt(r.peakRatio, 4)}×. Sine peak ${fmt(r.peakSine * 1000, 5)} mm; random 4σ screen ${fmt(r.peakRandom * 1000, 5)} mm.`;
}

async function loadTutorialCase(mode) {
  if (busy || exportBusy) return;
  const inputs = tutorialInputs(mode);
  for (const k of ids) $(k).value = inputs[k] ?? defaults[k];
  $("methodSelect").value = inputs.method;
  syncDwellMode();
  stale();
  example = true;
  await run();
}

$("tutorialLoadDocumented").onclick = () => loadTutorialCase("documented");
$("tutorialLoadAssumed").onclick = () => loadTutorialCase("assumed");
$("tutorialCycles").addEventListener("change", updateTutorialExperiment);
$("tutorialRandomSeconds").addEventListener("change", updateTutorialExperiment);
window.addEventListener("resize", () => {
  clearTimeout(tutorialResizeTimer);
  tutorialResizeTimer = setTimeout(() => {
    if (!$("tutorial").classList.contains("hidden")) renderTutorial();
  }, 120);
});
