const assert = require("node:assert/strict");
const V = require("./engine.js"),
  fs = require("node:fs");
const raw = JSON.parse(
  fs.readFileSync(__dirname + "/example-case.json"),
).inputs;
let tests = 0;
function test(name, fn) {
  fn();
  tests++;
  console.log("PASS " + name);
}
function close(a, b, tol = 1e-9) {
  assert.ok(
    Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-100),
    `${a} != ${b}`,
  );
}
test("DA inch and mm convert to peak acceleration", () => {
  close(
    V.accel(20, "disp_da_in", 0.1),
    (0.05 * 0.0254 * (40 * Math.PI) ** 2) / 9.80665,
  );
  close(V.accel(20, "disp_da_mm", 2.54), V.accel(20, "disp_da_in", 0.1));
});
test("Velocity and acceleration conventions agree", () => {
  const f = 20,
    x = 0.05;
  close(
    V.accel(f, "vel_pk_ips", 2 * Math.PI * f * x),
    V.accel(f, "disp_da_in", 2 * x),
  );
  close(
    V.accel(
      f,
      "vel_rms_mmps",
      (1000 * 2 * Math.PI * f * x * 0.0254) / Math.SQRT2,
    ),
    V.accel(f, "disp_da_in", 2 * x),
  );
  close(V.accel(f, "accel_g_rms", 2), 2 * Math.SQRT2);
  close(V.accel(f, "accel_g_pp", 4), 2);
});
test("PSD integrals: flat, rising and inverse-frequency", () => {
  close(
    V.integralPSD([
      [10, 0.1],
      [100, 0.1],
    ]),
    9,
  );
  close(
    V.integralPSD([
      [10, 1],
      [100, 10],
    ]),
    495,
  );
  close(
    V.integralPSD([
      [10, 1],
      [100, 0.1],
    ]),
    10 * Math.log(10),
  );
});
test("Resonant transfer equals g0 Q / omega_n squared", () =>
  close(V.transfer(100, 100, 10), (9.80665 * 10) / (200 * Math.PI) ** 2));
test("Cycle cap, time cap and repetition use excitation frequency", () => {
  const c = V.parse({
    ...raw,
    dwellText: "10,2,8,1000000,2\n100,2,8,1000000,1",
  });
  close(c.dwell[0].t, 28800);
  close(c.dwell[0].cycles, 576000);
  close(c.dwell[1].t, 10000);
  close(c.dwell[1].cycles, 1e6);
});
test("Pure narrowband limit and Hertz spectral moments", () => {
  const s = 1e-6,
    f = 100,
    T = 1000,
    b = 6,
    r = V.spectral([s, s * f, s * f * f, s * f ** 4], b, T);
  close(r.nu0, f);
  close(r.nup, f);
  close(r.nb, T * f * 48);
  close(r.dirlik, r.nb);
  assert.equal(r.method, "Rayleigh limit");
});
test("Rayleigh equal-RMS random/sine damage ratio is Gamma(1+b/2)", () => {
  const b = 6,
    T = 1000,
    f = 100,
    r = V.spectral([1e-6, 1e-4, 0.01, 100], b, T);
  close(r.nb / (T * f * Math.SQRT2 ** b), 6);
});
test("Single dwell analytical index", () => {
  const c = V.parse({ ...raw, passes: 0, dwellText: "100,2,0,1000000,1" }),
    r = V.atMode(c, 100);
  close(
    r.heritage,
    1e6 * ((2 * 9.80665 * 10) / (200 * Math.PI) ** 2 / 0.001) ** 6,
  );
});
test("Amplitude, PSD and duration damage scaling", () => {
  const c = V.parse(raw),
    r = V.atMode(c, 120),
    a = V.atMode(V.parse({ ...raw, sineScale: 2 }), 120),
    p = V.atMode(V.parse({ ...raw, psdDb: 10 * Math.log10(2) }), 120),
    t = V.atMode(V.parse({ ...raw, duration: 120 }), 120);
  close(a.heritage / r.heritage, 2 ** 6);
  close(p.random / r.random, 2 ** 3);
  close(t.random / r.random, 2);
  close(t.ratio / r.ratio, 0.5);
  close(t.eqMinutes, r.eqMinutes);
});
test("Sweep traversal and rate scaling", () => {
  const c = V.parse({ ...raw, dwellText: "", passes: 1 }),
    r = V.atMode(c, 120),
    r2 = V.atMode({ ...c, passes: 2 }, 120),
    rf = V.atMode({ ...c, sweepRate: 2 }, 120);
  close(r2.heritage, 2 * r.heritage);
  close(rf.heritage, 0.5 * r.heritage);
});
test("No fabricated dwell credit at undwelled modes", () => {
  const c = V.parse({ ...raw, passes: 0, dwellText: "100,2,8,1000000,1" }),
    r = V.atMode(c, 300);
  close(r.dwell, 1e6 * ((2 * V.transfer(100, 300, 10)) / 0.001) ** 6);
  assert.equal(r.contributions.length, 1);
});
test("Known mode and dwell frequencies are inserted exactly", () => {
  const c = V.parse({ ...raw, modesText: "119.314159,278.25" });
  assert.ok(V.grid(c).includes(119.314159));
  assert.ok(V.grid(c).includes(35));
});
test("All invalid input cases fail explicitly", () => {
  for (const patch of [
    { Q: 0 },
    { b: 0 },
    { duration: 0 },
    { psdText: "20,0\n200,.1" },
    { psdText: "200,.1\n20,.1" },
    { dwellText: "100,0,0,0,1" },
    { dwellText: "3000,0,8,1e6,1" },
    { sineText: "5,20,accel_g_pk,1,1\n19,200,accel_g_pk,1,1" },
    { scope: "modes", modesText: "" },
    { inspectFn: 3000 },
    { randomRepeats: 1.5 },
    { passes: 0, dwellText: "" },
  ])
    assert.throws(() => V.parse({ ...raw, ...patch }));
});
test("Refined quadrature resolves high-Q and high-b damage", () => {
  const c = V.parse({ ...raw, Q: 100, b: 12 });
  for (const f of [5, 19.97, 35, 120, 499.9, 1700, 2000]) {
    const a = V.atMode(c, f, 100, 12),
      b = V.atMode(c, f, 100, 12, 4);
    close(a.random, b.random, 1e-5);
    close(a.heritage, b.heritage, 1e-5);
  }
});
test("Discontinuous dwell boundaries require an explicit override", () => {
  const r = {
    ...raw,
    sineText: "5,100,accel_g_pk,10,10\n100,500,accel_g_pk,1,1",
    dwellText: "100,0,1,0,1",
    passes: 0,
  };
  assert.throws(() => V.parse(r), /discontinuous/);
  close(V.parse({ ...r, dwellText: "100,1,1,0,1" }).dwell[0].a, 1);
  close(
    V.parse({ ...r, sineText: "5,100,accel_g_pk,1,1\n100,500,accel_g_pk,1,1" })
      .dwell[0].a,
    1,
  );
});
test("Displacement sweep peak includes the exact shifted maximum", () => {
  const c = V.parse({
    ...raw,
    Q: 1,
    sineText: "5,500,disp_pk_mm,1,1",
    dwellText: "",
    passes: 1,
  });
  close(V.atMode(c, 100).peakSine, (0.001 * 2) / Math.sqrt(3), 1e-12);
});
test("Published FLife regression matches at its stated precision", () => {
  const r = require("./reference/benchmark-results.json").published_regression;
  const actual = V.spectral(
    r.stress_moments_Hz.map((x) => x * V.ZREF ** 2),
    r.b,
    1,
  );
  assert.ok(Math.abs(r.C / actual.dirlik - r.published_seconds.Dirlik) < 1e-6);
  assert.ok(Math.abs(r.C / actual.nb - r.published_seconds.Narrowband) < 1e-6);
});
test("Importable reference case matches independent FLife response calculation", () => {
  const c = V.parse(require("./reference/irvine-2011-case.json").inputs),
    r = V.atMode(c, 100);
  const ref = require("./reference/benchmark-results.json").end_to_end;
  close(r.dwell, ref.analytical_dwell_index, 1e-12);
  close(r.dirlik, ref.flife.at(-1).dirlik, 1e-8);
  close(r.nb, ref.flife.at(-1).nb, 1e-8);
});
const assumed = {
  ...raw, dwellMode: "assumed", assumedHours: 8, assumedCycles: 1e6,
  assumedRepeats: 2, assumedBoundary: "lower", passes: 0,
  // Ignored in this mode, even if a retained schedule is invalid.
  dwellText: "not a schedule",
};
test("Assumed resonances use independent analytical dwell damage and local units", () => {
  const c = V.parse(assumed);
  assert.equal(c.dwell.length, 0);
  for (const fn of [10, 35, 100, 280, 500]) {
    for (const Q of [5, 50]) for (const b of [4, 7.3]) {
      const r = V.atMode(c, fn, Q, b), d = r.contributions[0];
      const acceleration = V.sineAt(fn, c.sine) * c.sineScale;
      const amp = acceleration * V.G * Q / (2 * Math.PI * fn) ** 2;
      close(r.dwell, Math.min(8 * 3600 * fn, 1e6) * 2 * (amp / V.ZREF) ** b);
      close(r.peakSine, amp);
      close(d.t, Math.min(8 * 3600, 1e6 / fn));
      assert.equal(r.contributions.length, 1);
      assert.equal(d.f, fn);
      assert.equal(d.limiter, fn < 1e6 / 28800 ? "time" : "cycles");
      const manual = V.atMode(V.parse({ ...raw, passes: 0,
        dwellText: `${fn},0,8,1000000,2` }), fn, Q, b);
      close(r.heritage, manual.heritage);
      close(r.random, manual.random);
    }
  }
});
test("Adding grid points or retained dwells cannot change assumed resonance credit", () => {
  const a = V.parse({ ...assumed, density: 24, modesText: "100" });
  const b = V.parse({ ...assumed, density: 192, modesText: "99,100,101",
    dwellText: "99,1000,8,1000000,1000\n101,1000,8,1000000,1000" });
  assert.ok(V.grid(b).length > V.grid(a).length);
  const results = [a, b].map((c) => V.grid(c).map((f) => V.atMode(c, f)).find((r) => r.fn === 100));
  assert.deepEqual(results[0], results[1]);
});
test("Assumed dwell repeats, multiplier and optional sweeps apply once", () => {
  const c = V.parse(assumed), a = V.atMode(c, 100);
  const scaled = V.atMode(V.parse({ ...assumed, sineScale: 2, assumedRepeats: 4 }), 100);
  close(scaled.dwell / a.dwell, 2 * 2 ** c.b);
  close(scaled.peakSine / a.peakSine, 2);
  const swept = V.atMode(V.parse({ ...assumed, passes: 2 }), 100);
  close(swept.dwell, a.dwell);
  close(swept.heritage, a.dwell + swept.sweep);
  close(swept.random, a.random);
  close(V.atMode(V.parse({ ...assumed, assumedCycles: 0 }), 100).contributions[0].t, 28800);
  close(V.atMode(V.parse({ ...assumed, assumedHours: 0 }), 10).contributions[0].t, 1e5);
});
test("Outside-profile assumed dwell has zero credit and finite convergence", () => {
  const c = V.parse({ ...assumed, fmin: 600, fmax: 800, inspectFn: 700, modesText: "", density: 12 });
  const r = V.analyze(c);
  assert.equal(r.worst.margin, 0);
  assert.ok(Number.isFinite(r.convergence));
  assert.equal(r.gaps.length, 1);
  assert.equal(r.gaps[0].count, r.rows.length);
  for (const row of r.rows) {
    assert.equal(row.contributions.length, 0);
    assert.equal(row.dwell, 0);
    assert.equal(row.peakSine, 0);
    assert.equal(row.eqMinutes, 0);
  }
  assert.ok(r.warnings.some((s) => s.includes("zero assumed dwell")));
  const swept = V.atMode(V.parse({ ...assumed, passes: 2 }), 700);
  assert.equal(swept.dwell, 0);
  assert.ok(swept.sweep > 0);
});
test("Assumed boundary choices are explicit and do not affect adjacent interiors", () => {
  const input = { ...assumed, sineText: "5,100,accel_g_pk,10,10\n100,500,accel_g_pk,1,1" };
  assert.throws(() => V.parse({ ...input, assumedBoundary: "reject" }), /Select the lower or higher/);
  for (const boundary of ["lower", "upper"]) {
    const c = V.parse({ ...input, assumedBoundary: boundary });
    close(V.atMode(c, 100).contributions[0].a, boundary === "lower" ? 1 : 10);
    close(V.atMode(c, 99).contributions[0].a, 10);
    close(V.atMode(c, 101).contributions[0].a, 1);
  }
});
test("Assumed mode validates caps and preserves legacy documented cases", () => {
  for (const patch of [{ assumedHours: 0, assumedCycles: 0 },
    { assumedRepeats: 1.5 }, { assumedHours: -1 }, { assumedCycles: "" },
    { assumedRepeats: 0 }, { assumedBoundary: "guess" }, { dwellMode: "unknown" }]) {
    assert.throws(() => V.parse({ ...assumed, ...patch }));
  }
  assert.equal(V.parse(raw).dwellMode, "documented");
  assert.deepEqual(V.atMode(V.parse(raw), 100), V.atMode(V.parse({
    ...raw, dwellMode: "documented", assumedHours: "invalid", assumedCycles: -1,
  }), 100));
});
test("Assumed sensitivity and known-mode gap lists retain independent scenarios", () => {
  const c = V.parse({ ...assumed, scope: "modes", modesText: "100,700", density: 12 });
  const r = V.analyze(c);
  for (const s of r.sensitivity) {
    const expected = Math.min(...[100, 700].map((f) => V.atMode(c, f, s.Q, s.b).margin));
    close(s.margin, expected);
  }
  assert.ok(r.gaps.every((g) => g.from === g.to));
  assert.ok(r.gaps.some((g) => g.from === 700 && g.minimum === 0));
});
console.log(`${tests} test groups passed.`);
