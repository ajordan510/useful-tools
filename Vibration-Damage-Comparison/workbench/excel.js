(function (root, factory) {
  const api = factory(
    typeof WBModel === "undefined" ? require("./model.js") : WBModel,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WBExcel = api;
})(globalThis, function (M) {
  "use strict";
  const headers = {
    Profiles: ["profile_id", "kind", "name", "revision"],
    Sine: [
      "profile_id",
      "low_Hz",
      "high_Hz",
      "unit",
      "low_level",
      "high_level",
    ],
    Random: ["profile_id", "frequency_Hz", "PSD_g2_per_Hz"],
    Cases: [
      "case_id",
      "name",
      "sine_id",
      "random_id",
      "b_values",
      "Q_values",
      "included",
    ],
    Settings: ["case_id", "setting", "value"],
    Dwells: [
      "case_id",
      "frequency_Hz",
      "g_peak_override",
      "hour_cap",
      "cycle_cap",
      "repeats",
    ],
  };
  const omitted = [
    "caseName",
    "sineName",
    "randomName",
    "sineText",
    "psdText",
    "dwellText",
    "Q",
    "b",
    "sineRevision",
    "randomRevision",
  ];
  const settings = Object.keys(M.defaults).filter((k) => !omitted.includes(k));
  function fail(sheet, row, msg) {
    throw Error(`${sheet}, row ${row}: ${msg}`);
  }
  function fromRows(tables) {
    const records = {};
    for (const [sheet, cols] of Object.entries(headers)) {
      const rows = tables[sheet];
      if (!Array.isArray(rows) || !rows.length)
        fail(sheet, 1, "Required worksheet is missing.");
      if (rows.length > 10000)
        fail(sheet, 1, "Limit each worksheet to 10,000 rows.");
      if (
        cols.some((v, i) => rows[0][i] !== v) ||
        rows[0].slice(cols.length).some((v) => v !== "" && v != null)
      )
        fail(sheet, 1, `Expected columns: ${cols.join(", ")}`);
      records[sheet] = rows
        .slice(1)
        .map((r, i) => ({ row: i + 2, values: r }))
        .filter((r) => r.values.some((v) => v !== "" && v != null));
      for (const r of records[sheet])
        if (r.values.slice(cols.length).some((v) => v !== "" && v != null))
          fail(sheet, r.row, "Unexpected data beyond the defined columns.");
    }
    const study = {
        schema: M.SCHEMA,
        title: "Imported Excel study",
        profiles: [],
        cases: [],
        active: null,
      },
      ps = new Map(),
      cs = new Map();
    const str = (v) => (v == null ? "" : String(v).trim());
    for (const { row, values: r } of records.Profiles) {
      const id = str(r[0]);
      if (ps.has(id)) fail("Profiles", row, "Duplicate profile ID.");
      if (!["sine", "random"].includes(r[1]))
        fail("Profiles", row, "Kind must be sine or random.");
      const p = {
        id,
        kind: r[1],
        name: str(r[2]),
        revision: str(r[3]),
        text: "",
      };
      ps.set(id, p);
      study.profiles.push(p);
    }
    const previous = new Map();
    for (const sheet of ["Sine", "Random"])
      for (const { row, values: r } of records[sheet]) {
        const p = ps.get(str(r[0]));
        if (!p || p.kind !== sheet.toLowerCase())
          fail(sheet, row, "Unknown profile ID or wrong kind.");
        if (
          r.slice(1, headers[sheet].length).some((v) => v == null || v === "")
        )
          fail(sheet, row, "Every data cell is required.");
        for (let i = 1; i < headers[sheet].length; i++)
          if (!(sheet === "Sine" && i === 3) && !Number.isFinite(Number(r[i])))
            fail(sheet, row, `${headers[sheet][i]} must be numeric.`);
        const last = previous.get(p.id);
        if (sheet === "Random") {
          if (+r[1] <= 0 || +r[2] <= 0)
            fail(sheet, row, "Frequency and PSD must be positive.");
          if (last != null && +r[1] <= last)
            fail(
              sheet,
              row,
              "Frequencies must strictly increase within each profile.",
            );
          previous.set(p.id, +r[1]);
        } else {
          if (+r[1] <= 0 || +r[2] <= +r[1] || +r[4] <= 0 || +r[5] <= 0)
            fail(
              sheet,
              row,
              "Use positive levels and increasing segment endpoints.",
            );
          if (!Object.hasOwn(M.units, r[3]))
            fail(sheet, row, "Unknown sine unit code.");
          if (last != null && Math.abs(+r[1] / last - 1) > 1e-10)
            fail(sheet, row, "Sine segments must be contiguous and ordered.");
          previous.set(p.id, +r[2]);
        }
        p.text +=
          (p.text ? "\n" : "") + r.slice(1, headers[sheet].length).join(",");
      }
    for (const { row, values: r } of records.Cases) {
      const id = str(r[0]);
      if (cs.has(id)) fail("Cases", row, "Duplicate case ID.");
      let b, q;
      try {
        b = M.list(r[4], "b", 2, 12);
        q = M.list(r[5], "Q", 0.5, 100);
      } catch (e) {
        fail("Cases", row, e.message);
      }
      const incl = str(r[6]).toLowerCase();
      if (!["true", "false", "1", "0", "yes", "no"].includes(incl))
        fail("Cases", row, "Included must be true or false.");
      const c = {
        id,
        name: str(r[1]),
        sineId: str(r[2]),
        randomId: str(r[3]),
        bValues: b,
        QValues: q,
        included: ["true", "1", "yes"].includes(incl),
        inputs: { ...M.defaults, dwellText: "" },
        revision: 1,
        views: {},
        _row: row,
      };
      cs.set(id, c);
      study.cases.push(c);
    }
    const seen = new Set();
    for (const { row, values: r } of records.Settings) {
      const c = cs.get(str(r[0])),
        key = str(r[1]);
      if (!c) fail("Settings", row, "Unknown case ID.");
      if (!settings.includes(key))
        fail("Settings", row, `Unknown setting ${key}.`);
      const tag = c.id + ":" + key;
      if (seen.has(tag)) fail("Settings", row, "Duplicate case setting.");
      seen.add(tag);
      if (key === "example") {
        if (
          !["true", "false", "1", "0", "yes", "no"].includes(
            str(r[2]).toLowerCase(),
          )
        )
          fail("Settings", row, "example must be true or false.");
        c.inputs[key] = ["true", "1", "yes"].includes(str(r[2]).toLowerCase());
      } else c.inputs[key] = str(r[2]);
    }
    for (const { row, values: r } of records.Dwells) {
      const c = cs.get(str(r[0]));
      if (!c) fail("Dwells", row, "Unknown case ID.");
      if (
        r
          .slice(1, 6)
          .some((v) => v == null || v === "" || !Number.isFinite(Number(v)))
      )
        fail(
          "Dwells",
          row,
          "All five dwell values are required numeric inputs.",
        );
      c.inputs.dwellText +=
        (c.inputs.dwellText ? "\n" : "") + r.slice(1, 6).join(",");
    }
    for (const c of study.cases)
      try {
        M.validate({ ...study, cases: [c] });
      } catch (e) {
        fail(
          "Cases",
          c._row,
          `${c.id}: ${e.message} Check the referenced Sine, Random, Dwells and Settings rows.`,
        );
      }
    return M.validate(study);
  }
  function read(buffer, X) {
    const wb = X.read(buffer, { type: "array", cellFormula: true });
    const tables = {};
    for (const name of Object.keys(headers)) {
      const ws = wb.Sheets[name];
      if (!ws) fail(name, 1, "Required worksheet is missing.");
      const range = X.utils.decode_range(ws["!ref"] || "A1");
      if (range.e.r >= 10000 || range.e.c > 100)
        fail(name, 1, "Worksheet exceeds import size limit.");
      for (const [k, v] of Object.entries(ws))
        if (!k.startsWith("!") && v.f)
          fail(
            name,
            X.utils.decode_cell(k).r + 1,
            "Use literal input values; formulas are not imported.",
          );
      tables[name] = X.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: true,
      });
    }
    return fromRows(tables);
  }
  function exampleRows() {
    const s = M.initial();
    s.profiles.push(
      {
        id: "S02",
        kind: "sine",
        name: "Illustrative displacement to acceleration",
        revision: "Example",
        text: "20,50,disp_da_in,0.08,0.08\n50,2000,accel_g_pk,10.225,10.225",
      },
      {
        id: "R02",
        kind: "random",
        name: "Illustrative lower random",
        revision: "Example",
        text: "20,0.005\n80,0.02\n350,0.02\n2000,0.0035",
      },
    );
    const rows = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, [[...v]]]),
    );
    for (const p of s.profiles) {
      rows.Profiles.push([p.id, p.kind, p.name, p.revision]);
      for (const line of p.text.split("\n"))
        rows[p.kind === "sine" ? "Sine" : "Random"].push([
          p.id,
          ...line
            .split(",")
            .map((x) => (Number.isFinite(Number(x)) ? Number(x) : x)),
        ]);
    }
    for (let i = 0; i < 3; i++) {
      const id = `C0${i + 1}`;
      rows.Cases.push([
        id,
        [
          "Common sine / random A",
          "Common sine / random B",
          "Alternate sine / random B",
        ][i],
        i === 2 ? "S02" : "S01",
        i === 0 ? "R01" : "R02",
        "4, 6, 8",
        "5, 10, 20",
        true,
      ]);
      for (const key of settings) {
        let v = M.defaults[key];
        if (key === "assumedBoundary") v = "lower";
        rows.Settings.push([
          id,
          key,
          typeof v === "string" && v !== "" && Number.isFinite(Number(v))
            ? Number(v)
            : v,
        ]);
      }
      rows.Dwells.push([id, 100, 0, 0.25, 100000, 1]);
    }
    return rows;
  }
  return { headers, settings, fromRows, read, exampleRows };
});
