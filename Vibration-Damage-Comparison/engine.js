/* Vibration Damage Comparison 1.2.0. Original implementation; equations and scope in WHITE_PAPER.md and README.md. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VDC = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "1.2.0",
    G = 9.80665,
    ZREF = 0.001;
  const UNITS = {
    disp_da_in: "Displacement, inch double amplitude",
    disp_da_mm: "Displacement, mm double amplitude",
    disp_pk_in: "Displacement, inch peak",
    disp_pk_mm: "Displacement, mm peak",
    vel_pk_ips: "Velocity, inch/s peak",
    vel_pk_mmps: "Velocity, mm/s peak",
    vel_rms_ips: "Velocity, inch/s RMS",
    vel_rms_mmps: "Velocity, mm/s RMS",
    accel_g_pk: "Acceleration, g peak",
    accel_g_rms: "Acceleration, g RMS",
    accel_g_pp: "Acceleration, g peak-to-peak",
  };
  function assert(c, m) {
    if (!c) throw Error(m);
  }
  function number(v, label, lo, hi) {
    assert(
      v !== "" && v !== null && Number.isFinite(+v),
      label + " must be a finite number.",
    );
    v = +v;
    assert(
      v >= lo && v <= hi,
      label + " must be between " + lo + " and " + hi + ".",
    );
    return v;
  }
  function lines(s) {
    return s
      .split(/\r?\n/)
      .map((x) => x.split("#")[0].trim())
      .filter(Boolean)
      .map((x) => x.split(/[,;\t ]+/));
  }
  function logspace(a, b, n) {
    return Array.from(
      { length: n },
      (_, i) => a * Math.exp((Math.log(b / a) * i) / (n - 1)),
    );
  }
  function unique(a) {
    return [...new Set(a)].sort((x, y) => x - y);
  }
  function gamma(z) {
    const p = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    z--;
    let x = 0.99999999999980993;
    for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
    let t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
  }
  function accel(f, type, v) {
    const w = 2 * Math.PI * f;
    switch (type) {
      case "disp_da_in":
        return (((v * 0.0254) / 2) * w * w) / G;
      case "disp_da_mm":
        return (((v * 0.001) / 2) * w * w) / G;
      case "disp_pk_in":
        return (v * 0.0254 * w * w) / G;
      case "disp_pk_mm":
        return (v * 0.001 * w * w) / G;
      case "vel_pk_ips":
        return (v * 0.0254 * w) / G;
      case "vel_pk_mmps":
        return (v * 0.001 * w) / G;
      case "vel_rms_ips":
        return (v * Math.SQRT2 * 0.0254 * w) / G;
      case "vel_rms_mmps":
        return (v * Math.SQRT2 * 0.001 * w) / G;
      case "accel_g_pk":
        return v;
      case "accel_g_rms":
        return v * Math.SQRT2;
      case "accel_g_pp":
        return v / 2;
      default:
        throw Error("Unknown sine unit " + type);
    }
  }
  function power(f, f1, f2, y1, y2) {
    return (
      y1 * Math.exp((Math.log(y2 / y1) * Math.log(f / f1)) / Math.log(f2 / f1))
    );
  }
  function sineAt(f, segments, boundary = "reject") {
    const matches = segments.filter(
      (s) => f >= s.f1 * (1 - 1e-12) && f <= s.f2 * (1 + 1e-12),
    );
    const values = matches.map((s) =>
      accel(f, s.unit, power(f, s.f1, s.f2, s.a1, s.a2)),
    );
    assert(
      boundary !== "reject" ||
        values.length < 2 ||
        Math.max(...values) / Math.min(...values) - 1 <= 1e-6,
      "Dwell at a discontinuous sine segment boundary requires an explicit peak-G override.",
    );
    if (!values.length) return 0;
    return boundary === "lower"
      ? Math.min(...values)
      : boundary === "upper" ? Math.max(...values) : values[0];
  }
  function dwellExposure(f, a, hours, cycleCap, repeats) {
    const timeCap = hours > 0 ? hours * 3600 : Infinity,
      cycleTime = cycleCap > 0 ? cycleCap / f : Infinity,
      t = Math.min(timeCap, cycleTime);
    return {
      f, a, t, cycles: f * t * repeats, repeats, hours, cycleCap,
      limiter: timeCap <= cycleTime ? "time" : "cycles",
    };
  }
  // Alternative scenarios: generate only the dwell belonging to this oscillator.
  function dwellsAtMode(c, fn) {
    if (c.dwellMode !== "assumed") return c.dwell;
    const rule = c.assumedDwell,
      a = sineAt(fn, c.sine, rule.boundary) * c.sineScale;
    return a > 0 ? [dwellExposure(fn, a, rule.hours, rule.cycleCap, rule.repeats)] : [];
  }
  // Exact stationary points for power-law acceleration times the SDOF FRF.
  // u=(f/fn)^2: (p-2)u^2+(p-1)(Q^-2-2)u+p=0.
  function sinePeak(s, fn, Q, scale) {
    const a1 = accel(s.f1, s.unit, s.a1),
      a2 = accel(s.f2, s.unit, s.a2);
    const p = Math.log(a2 / a1) / Math.log(s.f2 / s.f1);
    const A = p - 2,
      B = (p - 1) * (1 / (Q * Q) - 2),
      C = p;
    const roots = [];
    if (Math.abs(A) < 1e-12) {
      if (B !== 0) roots.push(-C / B);
    } else {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const q = -0.5 * (B + (B >= 0 ? 1 : -1) * Math.sqrt(disc));
        roots.push(q / A);
        if (q !== 0) roots.push(C / q);
      }
    }
    const frequencies = [
      s.f1,
      s.f2,
      ...roots.filter((u) => u > 0).map((u) => fn * Math.sqrt(u)),
    ];
    return Math.max(
      ...frequencies
        .filter((f) => f >= s.f1 && f <= s.f2)
        .map(
          (f) =>
            accel(f, s.unit, power(f, s.f1, s.f2, s.a1, s.a2)) *
            scale *
            transfer(f, fn, Q),
        ),
    );
  }
  function psdAt(f, p) {
    if (f < p[0][0] || f > p[p.length - 1][0]) return 0;
    for (let i = 1; i < p.length; i++)
      if (f <= p[i][0])
        return power(f, p[i - 1][0], p[i][0], p[i - 1][1], p[i][1]);
    return 0;
  }
  function integralPSD(p) {
    let s = 0;
    for (let i = 1; i < p.length; i++) {
      const [a, x] = p[i - 1],
        [b, y] = p[i],
        k = Math.log(y / x) / Math.log(b / a);
      s +=
        Math.abs(k + 1) < 1e-10
          ? x * a * Math.log(b / a)
          : (x * a * Math.expm1((k + 1) * Math.log(b / a))) / (k + 1);
    }
    return s;
  }
  // Relative displacement per base acceleration in g, metres/g.
  function transfer(f, fn, Q) {
    const w = 2 * Math.PI * f,
      wn = 2 * Math.PI * fn;
    return G / Math.hypot(wn * wn - w * w, (wn * w) / Q);
  }
  const GX = [
      0.1834346424956498, 0.525532409916329, 0.7966664774136267,
      0.9602898564975363,
    ],
    GW = [
      0.362683783378362, 0.3137066458778873, 0.2223810344533745,
      0.1012285362903763,
    ];
  function quadrature(a, b, fn, Q, breaks, refine = 1) {
    let pts = [a, b, ...breaks.filter((x) => x > a && x < b)];
    let n = Math.ceil(Math.log(b / a) / (Math.log(2) / (12 * refine)));
    pts.push(...logspace(a, b, n + 1));
    for (const k of [
      -32, -16, -8, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 8, 16, 32,
    ]) {
      let x = fn * (1 + k / (2 * Q));
      if (x > a && x < b) pts.push(x);
    }
    pts = unique(pts);
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.log(pts[i - 1]),
        r = Math.log(pts[i]),
        mid = (l + r) / 2,
        h = (r - l) / 2;
      for (let j = 0; j < 4; j++)
        for (const sign of [-1, 1]) {
          let f = Math.exp(mid + sign * h * GX[j]);
          out.push([f, h * GW[j] * f]);
        }
    }
    return out;
  }
  function spectral(m, b, T) {
    const [m0, m1, m2, m4] = m;
    assert(
      m0 > 0 && m2 > 0 && m4 > 0,
      "Response moments underflowed; check levels and frequencies.",
    );
    const sigma = Math.sqrt(m0),
      nu0 = Math.sqrt(m2 / m0),
      nup = Math.sqrt(m4 / m2),
      alpha = m2 / Math.sqrt(m0 * m4),
      xm = (m1 / m0) * Math.sqrt(m2 / m4);
    const nb = T * nu0 * ((Math.SQRT2 * sigma) / ZREF) ** b * gamma(1 + b / 2);
    let dirlik,
      method = "Dirlik",
      coeff = null;
    if (1 - alpha < 1e-7) {
      dirlik = nb;
      method = "Rayleigh limit";
    } else {
      const d1 = (2 * (xm - alpha * alpha)) / (1 + alpha * alpha),
        den = 1 - alpha - d1 + d1 * d1,
        R = (alpha - xm - d1 * d1) / den,
        d2 = den / (1 - R),
        d3 = 1 - d1 - d2,
        q = (1.25 * (alpha - d3 - d2 * R)) / d1;
      assert(
        [d1, d2, d3, q, R].every(Number.isFinite) &&
          d1 >= -1e-8 &&
          d2 >= -1e-8 &&
          d3 >= -1e-8 &&
          q > 0,
        "Invalid Dirlik coefficients; use a validated time-domain method for this spectrum.",
      );
      coeff = { d1, d2, d3, q, R };
      dirlik =
        T *
        nup *
        (sigma / ZREF) ** b *
        (d1 * q ** b * gamma(1 + b) +
          2 ** (b / 2) * gamma(1 + b / 2) * (d2 * Math.abs(R) ** b + d3));
    }
    assert(
      Number.isFinite(dirlik) && dirlik > 0 && Number.isFinite(nb),
      "Damage is outside numerical range.",
    );
    return { sigma, nu0, nup, alpha, nb, dirlik, method, coeff };
  }
  function parse(raw) {
    const c = { ...raw };
    c.sine = lines(raw.sineText).map((r, i) => {
      assert(
        r.length === 5,
        "Sine row " + (i + 1) + ": use f_low,f_high,unit,level_low,level_high.",
      );
      let f1 = number(r[0], "Sine low frequency", 0.1, 1e5),
        f2 = number(r[1], "Sine high frequency", 0.1, 1e5);
      assert(f2 > f1, "Sine segment high frequency must exceed low frequency.");
      assert(UNITS[r[2]], "Unknown unit " + r[2]);
      return {
        f1,
        f2,
        unit: r[2],
        a1: number(r[3], "Sine level", 1e-9, 1e8),
        a2: number(r[4], "Sine level", 1e-9, 1e8),
      };
    });
    assert(
      c.sine.length > 0 && c.sine.length <= 100,
      "Provide 1 to 100 sine segments.",
    );
    for (let i = 1; i < c.sine.length; i++)
      assert(
        Math.abs(c.sine[i].f1 / c.sine[i - 1].f2 - 1) < 1e-10,
        "Sine segments must be ordered and contiguous (no gaps or overlaps).",
      );
    c.psd = lines(raw.psdText).map((r, i) => {
      assert(r.length === 2, "PSD row " + (i + 1) + ": use frequency,PSD.");
      return [
        number(r[0], "PSD frequency", 0.1, 1e5),
        number(r[1], "PSD level", 1e-16, 1e8),
      ];
    });
    assert(
      c.psd.length >= 2 && c.psd.length <= 300,
      "Provide 2 to 300 PSD breakpoints.",
    );
    for (let i = 1; i < c.psd.length; i++)
      assert(
        c.psd[i][0] > c.psd[i - 1][0],
        "PSD frequencies must strictly increase.",
      );
    const ranges = {
      Q: [0.5, 100],
      b: [2, 12],
      duration: [0.001, 1e7],
      randomRepeats: [1, 1e6],
      passes: [0, 1e5],
      sweepRate: [0.001, 1e5],
      fmin: [0.1, 1e5],
      fmax: [0.1, 1e5],
      density: [12, 192],
      damageFactor: [1, 1e6],
      peakFactor: [1, 20],
      psdDb: [-100, 100],
      sineScale: [0.001, 1000],
      inspectFn: [0.1, 1e5],
    };
    for (const [k, r] of Object.entries(ranges)) c[k] = number(raw[k], k, ...r);
    assert(c.fmax > c.fmin, "Maximum mode frequency must exceed minimum.");
    assert(
      Number.isInteger(c.density) &&
        Number.isInteger(c.passes) &&
        Number.isInteger(c.randomRepeats),
      "Density, sweep traversals and random repetitions must be integers.",
    );
    assert(
      Math.log2(c.fmax / c.fmin) * c.density <= 2400,
      "Limit the mode bank to 2400 intervals; reduce range or density.",
    );
    assert(["oct", "linear"].includes(c.sweepType), "Invalid sweep rate type.");
    assert(["dirlik", "nb"].includes(c.method), "Invalid random method.");
    assert(["bank", "modes"].includes(c.scope), "Invalid assessment scope.");
    c.dwellMode = raw.dwellMode ?? "documented";
    assert(["documented", "assumed"].includes(c.dwellMode), "Invalid dwell analysis mode.");
    if (c.dwellMode === "assumed") {
      const hours = number(raw.assumedHours, "Assumed dwell hour cap", 0, 1e7),
        cycleCap = number(raw.assumedCycles, "Assumed dwell cycle cap", 0, 1e15),
        repeats = number(raw.assumedRepeats, "Assumed dwell repeats", 1, 1e6),
        boundary = raw.assumedBoundary ?? "reject";
      assert(hours > 0 || cycleCap > 0, "Assumed dwell needs a positive time or cycle cap.");
      assert(Number.isInteger(repeats), "Assumed dwell repeats must be an integer.");
      assert(["reject", "lower", "upper"].includes(boundary), "Invalid assumed dwell boundary rule.");
      c.assumedDwell = { hours, cycleCap, repeats, boundary };
      // Boundaries are always included in the bank. Fail before a long calculation.
      if (boundary === "reject") {
        for (const f of c.sine.flatMap((s) => [s.f1, s.f2])) {
          if (f >= c.fmin && f <= c.fmax) {
            try {
              sineAt(f, c.sine);
            } catch {
              throw Error(`Assumed dwell at ${f} Hz has a discontinuous sine boundary. Select the lower or higher boundary amplitude, or correct the profile.`);
            }
          }
        }
      }
    }
    c.dwell = (c.dwellMode === "assumed" ? [] : lines(raw.dwellText)).map((r, i) => {
      assert(
        r.length === 5,
        "Dwell row " +
          (i + 1) +
          ": use Hz,g_peak_override,hour_cap,cycle_cap,repeats.",
      );
      const f = number(r[0], "Dwell frequency", 0.1, 1e5),
        override = number(r[1], "Dwell override", 0, 1e6),
        hours = number(r[2], "Dwell hour cap", 0, 1e7),
        cycles = number(r[3], "Dwell cycle cap", 0, 1e15),
        repeats = number(r[4], "Dwell repeats", 1, 1e6);
      assert(Number.isInteger(repeats), "Dwell repeats must be an integer.");
      assert(
        hours > 0 || cycles > 0,
        "Every dwell needs a positive time or cycle cap.",
      );
      const a = (override || sineAt(f, c.sine)) * c.sineScale;
      assert(
        a > 0,
        "Dwell outside sine band requires a nonzero acceleration override.",
      );
      const t = Math.min(
        hours > 0 ? hours * 3600 : Infinity,
        cycles > 0 ? cycles / f : Infinity,
      );
      return {
        f,
        a,
        t,
        cycles: f * t * repeats,
        repeats,
        hours,
        cycleCap: cycles,
        override,
        limiter:
          hours > 0 && hours * 3600 <= (cycles || Infinity) / f
            ? "time"
            : "cycles",
      };
    });
    assert(c.dwell.length <= 100, "Maximum 100 dwells.");
    assert(
      c.dwellMode === "assumed" || c.dwell.length || c.passes > 0,
      "Enter a dwell or at least one sweep traversal.",
    );
    c.modes = raw.modesText.trim()
      ? unique(
          lines(raw.modesText)
            .flat()
            .map((x) => number(x, "Known mode frequency", c.fmin, c.fmax)),
        )
      : [];
    assert(
      c.scope !== "modes" || c.modes.length,
      "Known-modes scope requires at least one mode.",
    );
    assert(
      c.inspectFn >= c.fmin && c.inspectFn <= c.fmax,
      "Inspection frequency must lie within the mode bank.",
    );
    c.T = c.duration * 60 * c.randomRepeats;
    c.psdScale = 10 ** (c.psdDb / 10);
    return c;
  }
  function atMode(c, fn, Q = c.Q, b = c.b, refine = 1) {
    let m = [0, 0, 0, 0];
    const pq = quadrature(
      c.psd[0][0],
      c.psd.at(-1)[0],
      fn,
      Q,
      c.psd.map((p) => p[0]),
      refine,
    );
    for (const [f, w] of pq) {
      const s = psdAt(f, c.psd) * c.psdScale * transfer(f, fn, Q) ** 2 * w;
      m[0] += s;
      m[1] += s * f;
      m[2] += s * f * f;
      m[3] += s * f ** 4;
    }
    const rand = spectral(m, b, c.T);
    let sweep = 0,
      peak = 0;
    for (const s of c.sine) {
      if (!c.passes) break;
      const sq = quadrature(s.f1, s.f2, fn, Q, [], refine);
      for (const [f, w] of sq) {
        const a =
          accel(f, s.unit, power(f, s.f1, s.f2, s.a1, s.a2)) *
          c.sineScale *
          transfer(f, fn, Q);
        const dt =
          c.sweepType === "oct"
            ? 60 / (c.sweepRate * Math.LN2 * f)
            : 60 / c.sweepRate;
        sweep += c.passes * f * (a / ZREF) ** b * dt * w;
        peak = Math.max(peak, a);
      }
      peak = Math.max(peak, sinePeak(s, fn, Q, c.sineScale));
    }
    const contributions = dwellsAtMode(c, fn).map((d) => {
      const amp = d.a * transfer(d.f, fn, Q);
      peak = Math.max(peak, amp);
      return { ...d, amp, index: d.cycles * (amp / ZREF) ** b };
    });
    const dwell = contributions.reduce((s, d) => s + d.index, 0),
      heritage = sweep + dwell,
      random = rand[c.method],
      ratio = heritage / random,
      peakRandom = c.peakFactor * rand.sigma;
    assert(
      [sweep, dwell, heritage, ratio, peakRandom].every(Number.isFinite),
      "Numerical overflow; reduce extreme levels, frequency range or exponent.",
    );
    return {
      fn,
      Q,
      b,
      m,
      ...rand,
      sweep,
      dwell,
      heritage,
      random,
      ratio,
      margin: ratio / c.damageFactor,
      eqMinutes: c.duration * c.randomRepeats * ratio,
      amplitudeReserve: (ratio / c.damageFactor) ** (1 / b),
      psdReserve: (ratio / c.damageFactor) ** (2 / b),
      peakSine: peak,
      peakRandom,
      peakRatio: peak / peakRandom,
      contributions,
      dwellStatus: c.dwellMode === "assumed"
        ? (contributions.length ? "assumed at resonance" : "outside sine profile; no dwell credit")
        : (contributions.length ? "documented schedule" : "no dwell credit"),
    };
  }
  function grid(c) {
    const n = Math.ceil(Math.log2(c.fmax / c.fmin) * c.density);
    return unique([
      ...logspace(c.fmin, c.fmax, n + 1),
      ...c.modes,
      c.inspectFn,
      ...c.dwell.map((d) => d.f).filter((f) => f >= c.fmin && f <= c.fmax),
      ...c.sine
        .flatMap((s) => [s.f1, s.f2])
        .filter((f) => f >= c.fmin && f <= c.fmax),
      ...c.psd.map((p) => p[0]).filter((f) => f >= c.fmin && f <= c.fmax),
    ]);
  }
  function minBy(rows, k) {
    return rows.reduce((a, b) => (a[k] < b[k] ? a : b));
  }
  function analyze(c) {
    const rows = grid(c).map((f) => atMode(c, f));
    const assessed =
      c.scope === "modes" ? rows.filter((r) => c.modes.includes(r.fn)) : rows;
    const worst = minBy(assessed, "margin"),
      peakWorst = minBy(assessed, "peakRatio"),
      inspect = rows.find((r) => r.fn === c.inspectFn);
    const check = atMode(c, worst.fn, c.Q, c.b, 2),
      convergence = worst.ratio === 0
        ? Math.abs(check.random / worst.random - 1)
        : Math.abs(check.ratio / worst.ratio - 1);
    const gaps = [];
    for (let i = 0; i < assessed.length; i++) {
      const row = assessed[i];
      if (row.margin >= 1) continue;
      const previous = i > 0 && assessed[i - 1].margin < 1 && c.scope === "bank"
        ? gaps.at(-1) : null;
      if (previous) {
        previous.to = row.fn;
        previous.count++;
        previous.minimum = Math.min(previous.minimum, row.margin);
      } else gaps.push({ from: row.fn, to: row.fn, count: 1, minimum: row.margin });
    }
    const qs = unique([5, 10, 20, 50, c.Q]),
      bs = unique([4, 6, 8, c.b]);
    const sensitivity = [];
    for (const Q of qs)
      for (const b of bs) {
        let w;
        if (Q === c.Q && b === c.b) w = worst;
        else
          w = minBy(
            assessed.map((r) => atMode(c, r.fn, Q, b)),
            "margin",
          );
        sensitivity.push({ Q, b, margin: w.margin, fn: w.fn });
      }
    const warnings = [];
    if (c.example)
      warnings.push(
        "Illustrative example only: replace all inputs with controlled test and requirement records.",
      );
    if (c.dwellMode === "assumed") {
      warnings.push("Hypothetical resonance screening: each oscillator receives only its own resonant dwell plus enabled sweeps. Neighboring hypothetical dwells contribute no damage or peak credit; these scenarios are not a combined test schedule.");
      if (rows.some((r) => !r.contributions.length))
        warnings.push("Some bank frequencies lie outside the sine profile. They receive zero assumed dwell credit; enabled sweeps may still contribute off-resonant response.");
      if (c.assumedDwell.boundary !== "reject")
        warnings.push(`At shared sine boundaries the ${c.assumedDwell.boundary === "lower" ? "lower" : "higher"} peak acceleration is used by explicit assumption.`);
    } else if (!c.dwell.length)
      warnings.push("No resonance dwell exposure is credited.");
    if (c.psd[0][0] < c.sine[0].f1 || c.psd.at(-1)[0] > c.sine.at(-1).f2)
      warnings.push(
        "Random excitation extends beyond the sine sweep band. Off-resonant heritage response is still included; confirm actual modal coverage.",
      );
    if (
      c.fmin > Math.min(c.sine[0].f1, c.psd[0][0]) ||
      c.fmax < Math.max(c.sine.at(-1).f2, c.psd.at(-1)[0])
    )
      warnings.push(
        "The mode bank does not span all excitation frequencies. Extend it or justify the excluded modes.",
      );
    if (c.scope === "bank")
      warnings.push(
        "The oscillator bank is a screening envelope. A gap at a hypothetical mode is not proof that the actual hardware fails.",
      );
    else
      warnings.push(
        "Only the listed modes govern the summary; omitted modes are not assessed.",
      );
    const eps = c.passes
      ? Math.max(
          ...c.sine.map((s) => {
            const f = s.f1,
              fdot =
                c.sweepType === "oct"
                  ? (c.sweepRate * Math.LN2 * f) / 60
                  : c.sweepRate / 60;
            return fdot / (2 * Math.PI * (1 / (2 * c.Q)) ** 2 * f * f);
          }),
        )
      : 0;
    if (eps > 0.1)
      warnings.push(
        "Sweep quasi-steady indicator exceeds 0.1 (" +
          eps.toPrecision(3) +
          "). Transient sweep analysis is needed before crediting sweep damage or peak response.",
      );
    if (rows.some((r) => r.contributions.some((d) => d.t < (5 * c.Q) / (Math.PI * d.f))))
      warnings.push(
        "At least one dwell is shorter than five resonant decay time constants. Steady-state dwell response needs a transient check.",
      );
    if (assessed.some((r) => r.alpha < 0.9))
      warnings.push(
        "Some responses are broadband (alpha < 0.9). Inspect the Dirlik/narrowband spread; consider stress-history rainflow near a decision boundary.",
      );
    if (assessed.some((r) => r.nu0 * c.T < 100))
      warnings.push(
        "Fewer than 100 expected zero-upcrossings occur at some modes. Stationary expected damage may poorly represent this short exposure.",
      );
    if (convergence > 0.005)
      warnings.push(
        "Integration refinement changed the governing damage ratio (or random damage when coverage is zero) by more than 0.5%; numerical review is required.",
      );
    warnings.push(
      "Peak response uses your selected k-sigma factor; it is not a duration-based maximum confidence level.",
    );
    warnings.push(
      "This is relative exposure severity, not an absolute Miner fraction, failure probability, remaining-life estimate or qualification approval.",
    );
    return {
      version: VERSION,
      rows,
      assessed,
      worst,
      peakWorst,
      inspect,
      sensitivity,
      grms: Math.sqrt(integralPSD(c.psd) * c.psdScale),
      convergence,
      gaps,
      warnings,
      eps,
      generated: new Date().toISOString(),
    };
  }
  return {
    VERSION,
    G,
    ZREF,
    UNITS,
    accel,
    transfer,
    spectral,
    integralPSD,
    psdAt,
    sineAt,
    quadrature,
    parse,
    atMode,
    grid,
    analyze,
    gamma,
  };
});
