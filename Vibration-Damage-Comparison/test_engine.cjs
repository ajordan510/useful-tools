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
console.log(`${tests} test groups passed.`);
