/* Study data and calculation orchestration. No browser dependencies. */
(function (root, factory) {
  const api = factory(
    typeof VDC === "undefined" ? require("../engine.js") : VDC,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WBModel = api;
})(globalThis, function (E) {
  "use strict";
  const VERSION = "3.0.0",
    SCHEMA = "vdc-workbench-1";
  const defaults = {
    caseName: "Illustrative comparison",
    sineName: "Illustrative sine",
    randomName: "Illustrative random",
    basis: "Illustrative inputs; replace with controlled specifications.",
    analystNotes: "",
    axis: "X",
    configuration: "",
    sineRevision: "",
    randomRevision: "",
    rationale:
      "Screening values only; establish material and damping evidence.",
    Q: "10",
    b: "6",
    damageFactor: "1",
    passes: "0",
    sweepRate: "1",
    sweepType: "oct",
    sineScale: "1",
    duration: "60",
    randomRepeats: "1",
    psdDb: "0",
    peakMode: "extreme",
    peakProbability: "99",
    peakFactor: "4",
    fmin: "20",
    fmax: "2000",
    density: "24",
    inspectFn: "100",
    scope: "bank",
    modesText: "100,250,500",
    method: "dirlik",
    dwellMode: "assumed",
    assumedHours: "0.25",
    assumedCycles: "100000",
    assumedRepeats: "1",
    assumedBoundary: "reject",
    sineText: "20,2000,accel_g_pk,10,10",
    dwellText: "100,0,0.25,100000,1",
    psdText: "20,0.01\n80,0.04\n350,0.04\n2000,0.007",
    example: true,
  };
  const copy = (x) => JSON.parse(JSON.stringify(x));
  function assert(ok, msg) {
    if (!ok) throw Error(msg);
  }
  function list(v, name, lo, hi) {
    const a = Array.isArray(v)
      ? v
      : String(v)
          .split(/[,;\s]+/)
          .filter(Boolean);
    assert(a.length > 0 && a.length <= 12, `${name}: enter 1–12 values.`);
    const n = a.map(Number);
    assert(
      n.every((x) => Number.isFinite(x) && x >= lo && x <= hi),
      `${name}: values must be ${lo}–${hi}.`,
    );
    return [...new Set(n)].sort((a, b) => a - b);
  }
  function raw(study, c) {
    const s = study.profiles.find(
        (p) => p.id === c.sineId && p.kind === "sine",
      ),
      r = study.profiles.find(
        (p) => p.id === c.randomId && p.kind === "random",
      );
    assert(s && r, `${c.id}: missing sine or random profile.`);
    return {
      ...defaults,
      ...c.inputs,
      caseName: c.name,
      sineName: s.name,
      randomName: r.name,
      sineRevision: s.revision,
      randomRevision: r.revision,
      sineText: s.text,
      psdText: r.text,
      Q: String(c.QValues[0]),
      b: String(c.bValues[0]),
    };
  }
  function initial() {
    return {
      schema: SCHEMA,
      version: VERSION,
      title: "Vibration comparison study",
      active: "C01",
      profiles: [
        {
          id: "S01",
          kind: "sine",
          name: defaults.sineName,
          revision: "Example",
          text: defaults.sineText,
        },
        {
          id: "R01",
          kind: "random",
          name: defaults.randomName,
          revision: "Example",
          text: defaults.psdText,
        },
      ],
      cases: [
        {
          id: "C01",
          name: defaults.caseName,
          sineId: "S01",
          randomId: "R01",
          inputs: copy(defaults),
          bValues: [4, 6, 8],
          QValues: [5, 10, 20],
          revision: 1,
          included: true,
          views: {},
        },
      ],
      linkedAxes: true,
    };
  }
  function text(v, label, max = 10000) {
    assert(
      typeof v === "string" && v.length <= max,
      `${label}: expected text up to ${max} characters.`,
    );
    return v;
  }
  function validate(x) {
    assert(x && x.schema === SCHEMA, "Expected a workbench study.");
    assert(
      Array.isArray(x.profiles) &&
        x.profiles.length > 0 &&
        x.profiles.length <= 120,
      "Provide 1–120 profiles.",
    );
    assert(
      Array.isArray(x.cases) && x.cases.length > 0 && x.cases.length <= 30,
      "Provide 1–30 cases.",
    );
    const y = {
      schema: SCHEMA,
      version: VERSION,
      title: text(x.title || "Study", "Title", 200),
      active: x.active,
      linkedAxes: x.linkedAxes !== false,
      profiles: [],
      cases: [],
    };
    const seen = new Set();
    for (const p of x.profiles) {
      assert(
        p &&
          typeof p.id === "string" &&
          /^[A-Za-z0-9_-]{1,60}$/.test(p.id) &&
          !seen.has(p.id),
        "Profile IDs must be unique letters, numbers, underscores or hyphens.",
      );
      seen.add(p.id);
      assert(["sine", "random"].includes(p.kind), "Invalid profile kind.");
      y.profiles.push({
        id: p.id,
        kind: p.kind,
        name: text(p.name, "Profile name", 200),
        revision: text(p.revision || "", "Revision", 200),
        text: text(p.text, "Profile data", 50000),
      });
    }
    seen.clear();
    for (const c of x.cases) {
      assert(
        c &&
          typeof c.id === "string" &&
          /^[A-Za-z0-9_-]{1,60}$/.test(c.id) &&
          !seen.has(c.id),
        "Case IDs must be unique letters, numbers, underscores or hyphens.",
      );
      seen.add(c.id);
      const inputs = { ...defaults };
      for (const k of Object.keys(defaults)) {
        if (c.inputs && Object.hasOwn(c.inputs, k)) {
          assert(
            ["string", "number", "boolean"].includes(typeof c.inputs[k]),
            `Invalid input ${k}`,
          );
          assert(String(c.inputs[k]).length < 50000, `Input ${k} is too long.`);
          inputs[k] = c.inputs[k];
        }
      }
      const clean = {
        id: c.id,
        name: text(c.name, "Case name", 200),
        sineId: c.sineId,
        randomId: c.randomId,
        inputs,
        bValues: list(c.bValues, "b", 2, 12),
        QValues: list(c.QValues, "Q", 0.5, 100),
        revision:
          Number.isInteger(c.revision) && c.revision > 0 ? c.revision : 1,
        included: c.included !== false,
        views: {},
      };
      if (
        c.selected &&
        clean.bValues.includes(c.selected.b) &&
        clean.QValues.includes(c.selected.Q)
      )
        clean.selected = { b: c.selected.b, Q: c.selected.Q };
      const display = c.display || {};
      for (const [key, options] of Object.entries({
        summaryScope: ["overall", "frequency"],
        summaryMetric: ["fatigue", "peak"],
        coverageView: ["selected", "envelope"],
      }))
        assert(display[key] === undefined || options.includes(display[key]), `Invalid ${key} display option.`);
      assert(display.frequency == null || (Number.isFinite(display.frequency) && display.frequency > 0), "Invalid summary frequency.");
      clean.display = {
        summaryScope: display.summaryScope || "overall",
        summaryMetric: display.summaryMetric || "fatigue",
        coverageView: display.coverageView || "selected",
        frequency: display.frequency ?? null,
      };
      assert(
        clean.bValues.length * clean.QValues.length <= 72,
        "Limit each case to 72 b × Q combinations.",
      );
      if (c.views && typeof c.views === "object")
        for (const [key, v] of Object.entries(c.views)) {
          assert(/^[\w.-]+$/.test(key), "Invalid plot view key.");
          const w = {};
          for (const axis of ["x", "y"]) {
            const a = v?.[axis];
            if (a) {
              assert(
                ["log", "linear", "category"].includes(a.type) &&
                  Array.isArray(a.range) &&
                  a.range.length === 2 &&
                  a.range.every(Number.isFinite) &&
                  (a.type !== "log" ||
                    a.range.every((v) => Math.abs(v) <= 300)) &&
                  a.range[1] > a.range[0],
                "Invalid saved axis limits.",
              );
              w[axis] = { type: a.type, range: [...a.range] };
            }
          }
          if (v?.color) {
            assert(
              v.color.length === 2 &&
                v.color.every(Number.isFinite) &&
                v.color[1] > v.color[0],
              "Invalid color limits.",
            );
            w.color = [...v.color];
          }
          clean.views[key] = w;
        }
      E.parse(raw(y, clean));
      y.cases.push(clean);
    }
    // Validate unused library entries too; no malformed dormant specifications.
    for (const p of y.profiles) {
      const i = {
        ...defaults,
        ...(p.kind === "sine" ? { sineText: p.text } : { psdText: p.text }),
        assumedBoundary: "lower",
      };
      E.parse(i);
    }
    if (!y.cases.some((c) => c.id === y.active)) y.active = y.cases[0].id;
    return y;
  }
  function legacy(x) {
    if (x.schema === SCHEMA) return validate(x);
    const entries =
      x.schema === "vdc-case-1"
        ? [{ id: "C01", inputs: x.inputs }]
        : x.schema === "vdc-study-1"
          ? x.cases
          : null;
    assert(
      Array.isArray(entries) && entries.length,
      "Unsupported study format.",
    );
    const y = {
      schema: SCHEMA,
      title: x.title || "Imported study",
      profiles: [],
      cases: [],
      active: null,
    };
    entries.forEach((e, i) => {
      const a = {
        ...defaults,
        ...e.inputs,
        peakMode: e.inputs?.peakMode ?? "fixed",
        dwellMode: e.inputs?.dwellMode ?? "documented",
      };
      const id = `C${String(i + 1).padStart(2, "0")}`;
      y.profiles.push(
        {
          id: `S${i + 1}`,
          kind: "sine",
          name: a.sineName || `Sine ${i + 1}`,
          revision: a.sineRevision || "",
          text: a.sineText,
        },
        {
          id: `R${i + 1}`,
          kind: "random",
          name: a.randomName || `Random ${i + 1}`,
          revision: a.randomRevision || "",
          text: a.psdText,
        },
      );
      y.cases.push({
        id,
        name: a.caseName || id,
        sineId: `S${i + 1}`,
        randomId: `R${i + 1}`,
        inputs: a,
        bValues: [Number(a.b)],
        QValues: [Number(a.Q)],
        included: e.included !== false,
        revision: e.revision || 1,
        views: {},
      });
    });
    return validate(y);
  }
  const signature = (s, c) =>
    JSON.stringify({
      raw: raw(s, c),
      b: c.bValues,
      Q: c.QValues,
      revision: c.revision,
    });
  async function run(
    inputs,
    bs,
    qs,
    progress = () => {},
    cancel = () => false,
  ) {
    bs = list(bs, "b", 2, 12);
    qs = list(qs, "Q", 0.5, 100);
    const scenarios = [],
      base = E.parse({ ...inputs, b: bs[0], Q: qs[0] }),
      freq = E.grid(base);
    let done = 0;
    for (const Q of qs) {
      const sets = bs.map(() => []);
      for (let j = 0; j < freq.length; j++) {
        if (cancel()) throw Error("Calculation cancelled.");
        const cache = new Map();
        for (let k = 0; k < bs.length; k++)
          sets[k].push(E.atMode(base, freq[j], Q, bs[k], 1, cache));
        if (j % 12 === 0) {
          progress(++done / (qs.length * Math.ceil(freq.length / 12)));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      for (let k = 0; k < bs.length; k++) {
        const c = E.parse({ ...inputs, Q, b: bs[k] }),
          r = E.analyze(c, { rows: sets[k], skipSensitivity: true });
        const peakCheck = E.atMode(c, r.peakWorst.fn, Q, bs[k], 2);
        r.peakConvergence = Math.abs(
          peakCheck.peakRatio / (r.peakWorst.peakRatio || 1) -
            (r.peakWorst.peakRatio ? 1 : 0),
        );
        if (r.peakConvergence > 0.005)
          r.warnings.push(
            "Peak integration refinement differs by more than 0.5%; numerical review is required.",
          );
        scenarios.push({ key: `b${bs[k]}-Q${Q}`, c, r });
      }
    }
    progress(1);
    return scenarios;
  }
  return {
    VERSION,
    SCHEMA,
    units: E.UNITS,
    defaults,
    copy,
    list,
    initial,
    raw,
    validate,
    legacy,
    signature,
    run,
  };
});
