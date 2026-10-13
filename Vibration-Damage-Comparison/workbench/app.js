/* Desktop workspace. Inputs mutate only on a validated dialog Apply. */
const Workbench = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    esc = VDCReport.xml,
    n = VDCReport.num,
    M = WBModel;
  let study = M.initial(),
    runs = new Map(),
    selection = {},
    worker = null,
    busy = false,
    dirty = false,
    renderId = 0,
    renderedId = 0,
    undo = null,
    plotSpecs = new Map(),
    suppressLink = false;
  const active = () => study.cases.find((c) => c.id === study.active);
  const result = (c) => {
    const v = runs.get(c.id);
    return v?.signature === M.signature(study, c) ? v.scenarios : null;
  };
  const chosen = (c) => {
    const a = result(c);
    return (
      a?.find(
        (s) => s.c.b === selection[c.id]?.b && s.c.Q === selection[c.id]?.Q,
      ) ||
      a?.find((s) => s.c.b === 6 && s.c.Q === 10) ||
      a?.[0]
    );
  };
  const status = (s) => ($("status").textContent = s);
  const error = (e) => {
    $("error").textContent = e?.message || String(e || "");
  };
  const save = (name, blob) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const setDirty = () => {
    dirty = true;
  };
  function editor(title, body, buttons = []) {
    $("editorTitle").textContent = title;
    $("editorBody").innerHTML = body;
    $("editorFoot").replaceChildren();
    for (const [label, fn, primary] of buttons) {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = primary ? "primary" : "";
      b.onclick = async () => {
        try {
          await fn();
        } catch (e) {
          let x = $("dialogError");
          if (!x) {
            x = document.createElement("div");
            x.id = "dialogError";
            x.className = "error";
            $("editorBody").prepend(x);
          }
          x.textContent = e.message;
          x.scrollIntoView({ block: "nearest" });
        }
      };
      $("editorFoot").append(b);
    }
    if (!$("editor").open) $("editor").showModal();
  }
  function apply(next) {
    study = M.validate(next);
    setDirty();
    $("editor").close();
    refresh();
  }
  function ensureIdle() {
    if (busy)
      throw Error("Cancel or finish the calculation before changing inputs.");
  }
  const selectHTML = (id, values, value) =>
    `<select id="${id}">${values.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  const field = (key, label, value, help = "", opts = null, wide = false) =>
    `<label class="field ${wide ? "wide" : ""}"><span>${esc(label)}</span>${opts ? selectHTML("f_" + key, opts, value) : wide ? `<textarea id="f_${key}">${esc(value)}</textarea>` : `<input id="f_${key}" value="${esc(value)}">`}${help ? `<small>${esc(help)}</small>` : ""}</label>`;
  const choices = {
    dwellMode: [
      ["assumed", "Independent assumed resonance"],
      ["documented", "Documented dwell schedule"],
    ],
    sweepType: [
      ["oct", "Octaves/minute"],
      ["linear", "Hz/minute"],
    ],
    assumedBoundary: [
      ["reject", "Reject discontinuity"],
      ["lower", "Use lower level"],
      ["upper", "Use higher level"],
    ],
    peakMode: [
      ["extreme", "Duration + probability estimate"],
      ["fixed", "Selected k × RMS"],
    ],
    method: [
      ["dirlik", "Dirlik"],
      ["nb", "Narrowband / Rayleigh"],
    ],
    scope: [
      ["bank", "Full oscillator bank"],
      ["modes", "Listed known modes only"],
    ],
  };
  function settingsDialog() {
    ensureIdle();
    const c = active(),
      r = M.raw(study, c);
    const defs = [
      [
        "bValues",
        "Fatigue exponents b",
        c.bValues.join(", "),
        "Every b × Q combination is evaluated. Enter 2–12; choose from material/detail evidence.",
      ],
      [
        "QValues",
        "Quality factors Q",
        c.QValues.join(", "),
        "Q = 1 / (2ζ). Enter 0.5–100; damping may vary with configuration and level.",
      ],
      [
        "method",
        "Random fatigue method",
        r.method,
        "Stationary Gaussian response; narrowband is a cross-check.",
        choices.method,
      ],
      [
        "damageFactor",
        "Required fatigue factor F",
        r.damageFactor,
        "Coverage = sine damage / (F × random damage); target is 1.",
      ],
      [
        "peakMode",
        "Random peak model",
        r.peakMode,
        "Extreme uses the approximate Irvine Rev H model.",
        choices.peakMode,
      ],
      [
        "peakProbability",
        "Nominal non-exceedance (%)",
        r.peakProbability,
        "50–99.99%, per oscillator over total exposure. A higher value raises random demand.",
      ],
      [
        "peakFactor",
        "Selected peak factor k",
        r.peakFactor,
        "Used only in selected-k mode; record a justification.",
      ],
      [
        "scope",
        "Assessment scope",
        r.scope,
        "View limits never change assessment scope.",
        choices.scope,
      ],
      ["fmin", "Minimum natural frequency (Hz)", r.fmin],
      ["fmax", "Maximum natural frequency (Hz)", r.fmax],
      [
        "density",
        "Points per octave",
        r.density,
        "12–192. Refine near coverage crossings and narrow features.",
      ],
      ["inspectFn", "Inspected oscillator (Hz)", r.inspectFn],
      [
        "modesText",
        "Known frequencies (Hz)",
        r.modesText,
        "Comma or space separated.",
      ],
      [
        "rationale",
        "Assumption rationale",
        r.rationale,
        "Record evidence for b, Q, target and peak probability/factor.",
        null,
        true,
      ],
    ];
    editor(
      "Scenario & method settings",
      `<p class="helptext">A scenario matrix explores assumptions. It is not a statistical confidence interval.</p><div class="fields">${defs.map((d) => field(...d)).join("")}</div>`,
      [
        ["Cancel", () => $("editor").close()],
        [
          "Apply settings",
          () => {
            const next = M.copy(study),
              a = next.cases.find((x) => x.id === c.id);
            for (const [k] of defs)
              if (!["bValues", "QValues"].includes(k))
                a.inputs[k] = $("f_" + k).value;
            a.bValues = M.list($("f_bValues").value, "b", 2, 12);
            a.QValues = M.list($("f_QValues").value, "Q", 0.5, 100);
            a.revision++;
            apply(next);
          },
          true,
        ],
      ],
    );
    const sync = () => {
      $("f_peakProbability").disabled = $("f_peakMode").value !== "extreme";
      $("f_peakFactor").disabled = $("f_peakMode").value !== "fixed";
    };
    $("f_peakMode").onchange = sync;
    sync();
  }
  function appearanceDialog() {
    ensureIdle();
    const c = active(), d = c.display || {};
    editor("Plot appearance & VRS", `<div class="fields">${field("vrsFactor", "VRS reference factor k", d.vrsFactor ?? 3,
      "Reference curve = k × response RMS; default 3 (3σ). Enter a value greater than 0 and at most 20. This does not change the selected peak model or coverage.")}${field("legendMode", "Default legend placement", d.legendMode || "above", "Individual Legend buttons can override this setting.",
      [["above", "Above plot"], ["boxed", "Boxed inside plot (draggable)"]])}</div><p class="helptext">Boxed legends have a white background and thin border. Drag their background or title to reposition them. Positions are saved with the study and used in exported figures. MATLAB’s default gem colors are used for solid data lines.</p>`, [
      ["Cancel", () => $("editor").close()],
      ["Apply appearance", async () => {
        const next = M.copy(study), a = next.cases.find(x => x.id === c.id);
        a.display = { ...d, vrsFactor: Number($("f_vrsFactor").value), legendMode: $("f_legendMode").value };
        if (a.display.vrsFactor !== (d.vrsFactor ?? 3) && a.views.peakResponsePlot) delete a.views.peakResponsePlot.y;
        if (a.display.legendMode !== (d.legendMode || "above"))
          for (const v of Object.values(a.views)) delete v.legend;
        study = M.validate(next);
        setDirty(); $("editor").close(); await refresh();
      }, true],
    ]);
  }
  function caseDialog() {
    ensureIdle();
    const c = active(),
      r = M.raw(study, c);
    const defs = [
      ["name", "Comparison name", c.name],
      ["axis", "Axis", r.axis],
      ["configuration", "Hardware configuration", r.configuration],
      [
        "basis",
        "Evidence and specification basis",
        r.basis,
        "Record test completion and traceable source records.",
        null,
        true,
      ],
      [
        "dwellMode",
        "Dwell analysis",
        r.dwellMode,
        "Assumed dwells are independent hypothetical scenarios.",
        choices.dwellMode,
      ],
      [
        "assumedHours",
        "Assumed dwell hour cap",
        r.assumedHours,
        "Zero disables this cap. Earlier positive time/cycle cap governs.",
      ],
      ["assumedCycles", "Assumed dwell cycle cap", r.assumedCycles],
      ["assumedRepeats", "Assumed dwell repeats", r.assumedRepeats],
      [
        "assumedBoundary",
        "Shared sine boundary",
        r.assumedBoundary,
        "An explicit choice is required for a discontinuity.",
        choices.assumedBoundary,
      ],
      [
        "sineScale",
        "Sine amplitude multiplier",
        r.sineScale,
        "Also applies to documented dwell overrides.",
      ],
      [
        "passes",
        "One-way sweep traversals",
        r.passes,
        "Zero excludes sweep exposure.",
      ],
      ["sweepRate", "Sweep rate", r.sweepRate],
      [
        "sweepType",
        "Sweep rate units",
        r.sweepType,
        "Quasi-steady response assumption.",
        choices.sweepType,
      ],
      ["duration", "Random duration per exposure (min)", r.duration],
      ["randomRepeats", "Random repetitions", r.randomRepeats],
      [
        "psdDb",
        "Random PSD adjustment (dB)",
        r.psdDb,
        "PSD multiplier = 10^(dB/10).",
      ],
      [
        "analystNotes",
        "Analyst interpretation",
        r.analystNotes,
        "Exported separately from calculated findings.",
        null,
        true,
      ],
    ];
    editor(
      "Comparison & exposure",
      `<div class="fields">${field(
        "sineId",
        "Sine specification",
        c.sineId,
        "Edit shared data in Spectrum library.",
        study.profiles
          .filter((p) => p.kind === "sine")
          .map((p) => [p.id, p.id + " · " + p.name]),
      )}${field(
        "randomId",
        "Random specification",
        c.randomId,
        "",
        study.profiles
          .filter((p) => p.kind === "random")
          .map((p) => [p.id, p.id + " · " + p.name]),
      )}${defs.map((d) => field(...d)).join("")}</div><h3>Documented dwells</h3><p class="small">Ignored in assumed mode. Zero override uses the sine profile; zero cap disables that cap.</p><div id="dwellEditor"></div><label><input id="f_example" type="checkbox" ${r.example ? "checked" : ""}> Illustrative inputs</label>`,
      [
        ["Cancel", () => $("editor").close()],
        [
          "Apply comparison",
          () => {
            const next = M.copy(study),
              a = next.cases.find((x) => x.id === c.id);
            for (const [k] of defs)
              if (k !== "name") a.inputs[k] = $("f_" + k).value;
            a.name = $("f_name").value;
            a.sineId = $("f_sineId").value;
            a.randomId = $("f_randomId").value;
            a.inputs.dwellText = readTable("dwellEditor");
            a.inputs.example = $("f_example").checked;
            a.revision++;
            apply(next);
          },
          true,
        ],
      ],
    );
    makeTable("dwellEditor", r.dwellText, [
      "Frequency (Hz)",
      "Peak g override",
      "Hours cap",
      "Cycles cap",
      "Repeats",
    ]);
    const sync = () => {
      const assumed = $("f_dwellMode").value === "assumed";
      for (const k of [
        "assumedHours",
        "assumedCycles",
        "assumedRepeats",
        "assumedBoundary",
      ])
        $("f_" + k).disabled = !assumed;
      $("dwellEditor")
        .querySelectorAll("input,button")
        .forEach((x) => (x.disabled = assumed));
    };
    $("f_dwellMode").onchange = sync;
    sync();
  }
  function makeTable(id, text, labels, units = false) {
    const host = $(id);
    host.innerHTML = `<div class="tablewrap"><table><thead><tr>${labels.map((x) => `<th>${esc(x)}</th>`).join("")}<th></th></tr></thead><tbody></tbody></table></div><div class="split"><button type="button" class="addrow">Add row</button><button type="button" class="paste">Paste rows…</button></div>`;
    function add(values = []) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        labels
          .map(
            (_, i) =>
              `<td>${
                units && i === 2
                  ? `<select aria-label="${labels[i]}">${Object.entries(
                      VDC.UNITS,
                    )
                      .map(
                        ([v, t]) =>
                          `<option value="${v}" ${v === (values[i] || "accel_g_pk") ? "selected" : ""}>${esc(t)}</option>`,
                      )
                      .join("")}</select>`
                  : `<input aria-label="${labels[i]}" value="${esc(values[i] ?? "")}">`
              }</td>`,
          )
          .join("") +
        '<td><button type="button" aria-label="Remove row">×</button></td>';
      tr.querySelector("button").onclick = () => tr.remove();
      host.querySelector("tbody").append(tr);
    }
    text
      .split(/\r?\n/)
      .map((s) => s.split("#")[0].trim())
      .filter(Boolean)
      .forEach((l) => add(l.split(/[,;\t ]+/)));
    host.querySelector(".addrow").onclick = () => add();
    host.querySelector(".paste").onclick = () => {
      const area = document.createElement("textarea");
      area.placeholder = "Paste comma- or tab-separated rows here";
      const b = document.createElement("button");
      b.textContent = "Replace table with pasted rows";
      b.onclick = () => {
        makeTable(id, area.value, labels, units);
      };
      host.append(area, b);
      area.focus();
    };
  }
  function readTable(id) {
    return [...$(id).querySelectorAll("tbody tr")]
      .map((tr) =>
        [...tr.querySelectorAll("input,select")].map((x) => x.value.trim()),
      )
      .filter((r) => r.some(Boolean))
      .map((r) => r.join(","))
      .join("\n");
  }
  function profilesDialog(id) {
    ensureIdle();
    let selected =
      study.profiles.find((p) => p.id === id) ||
      study.profiles.find((p) => p.id === active().sineId);
    const p = selected;
    editor(
      "Spectrum library",
      `<div class="split">${selectHTML(
        "profileSelect",
        study.profiles.map((x) => [x.id, x.id + " · " + x.name]),
        p.id,
      )}<button id="newSine">New sine</button><button id="newRandom">New random</button><button id="duplicateProfile">Duplicate</button><button id="deleteProfile">Delete</button></div><p class="helptext">Profiles are shared. Applying changes invalidates every case that references this profile. Switching profiles discards unapplied edits.</p><div class="fields">${field("profileName", "Profile name", p.name)}${field("profileRevision", "Revision", p.revision)}</div><h3>${p.kind === "sine" ? "Sine segments" : "One-sided random PSD"}</h3><div id="profileTable"></div>`,
      [
        ["Cancel", () => $("editor").close()],
        [
          "Apply shared profile",
          () => {
            const next = M.copy(study),
              a = next.profiles.find((x) => x.id === p.id);
            a.name = $("f_profileName").value;
            a.revision = $("f_profileRevision").value;
            a.text = readTable("profileTable");
            for (const c of next.cases)
              if (c.sineId === p.id || c.randomId === p.id) c.revision++;
            apply(next);
          },
          true,
        ],
      ],
    );
    makeTable(
      "profileTable",
      p.text,
      p.kind === "sine"
        ? ["Low Hz", "High Hz", "Unit", "Low level", "High level"]
        : ["Frequency (Hz)", "PSD (g²/Hz)"],
      p.kind === "sine",
    );
    $("profileSelect").onchange = (e) => profilesDialog(e.target.value);
    const add = (kind, source) => {
      const prefix = kind === "sine" ? "S" : "R";
      let i = 1;
      while (study.profiles.some((p) => p.id === prefix + i)) i++;
      study.profiles.push({
        id: prefix + i,
        kind,
        name: source ? source.name + " copy" : "New " + kind,
        revision: "",
        text: source
          ? source.text
          : M.defaults[kind === "sine" ? "sineText" : "psdText"],
      });
      setDirty();
      profilesDialog(prefix + i);
    };
    $("newSine").onclick = () => add("sine");
    $("newRandom").onclick = () => add("random");
    $("duplicateProfile").onclick = () => add(p.kind, p);
    $("deleteProfile").onclick = () => {
      if (study.cases.some((c) => c.sineId === p.id || c.randomId === p.id)) {
        alert(
          "This profile is referenced by a case. Change the case references before deleting it.",
        );
        return;
      }
      study.profiles = study.profiles.filter((x) => x.id !== p.id);
      setDirty();
      profilesDialog();
    };
  }
  function casesDialog() {
    ensureIdle();
    editor(
      "Manage comparison cases",
      `<p class="helptext">Cases may share specifications and retain independent exposure settings. Included cases are used by Run included and report selection.</p><div class="split"><button id="addCase">Add case</button><button id="copyCase">Duplicate active case</button><button id="undoCase" ${undo ? "" : "disabled"}>Undo last removal</button></div><div class="tablewrap"><table><thead><tr><th>Use</th><th>ID</th><th>Case</th><th>Sine</th><th>Random</th><th>Results</th><th></th></tr></thead><tbody>${study.cases.map((c) => `<tr data-case="${c.id}"><td><input type="checkbox" ${c.included ? "checked" : ""} class="included"></td><td>${c.id}</td><td><button class="activate">${esc(c.name)}</button></td><td>${esc(c.sineId)}</td><td>${esc(c.randomId)}</td><td>${result(c) ? "Current" : "Needs calculation"}</td><td><button class="remove" ${study.cases.length === 1 ? "disabled" : ""}>Remove</button></td></tr>`).join("")}</tbody></table></div>`,
      [["Done", () => $("editor").close(), true]],
    );
    $("editorBody")
      .querySelectorAll("[data-case]")
      .forEach((tr) => {
        const c = study.cases.find((x) => x.id === tr.dataset.case);
        tr.querySelector(".included").onchange = (e) => {
          c.included = e.target.checked;
          setDirty();
        };
        tr.querySelector(".activate").onclick = () => {
          study.active = c.id;
          refresh();
          $("editor").close();
          caseDialog();
        };
        tr.querySelector(".remove").onclick = () => {
          undo = { c: M.copy(c), index: study.cases.indexOf(c) };
          study.cases = study.cases.filter((x) => x.id !== c.id);
          if (study.active === c.id) study.active = study.cases[0].id;
          setDirty();
          refresh();
          casesDialog();
        };
      });
    function add(copy) {
      if (study.cases.length >= 30) throw Error("Maximum 30 cases.");
      let i = 1;
      while (study.cases.some((c) => c.id === `C${String(i).padStart(2, "0")}`))
        i++;
      const c = M.copy(copy ? active() : M.initial().cases[0]);
      c.id = `C${String(i).padStart(2, "0")}`;
      c.name = copy ? c.name + " copy" : "New comparison";
      if (!copy) {
        c.sineId = study.profiles.find((p) => p.kind === "sine").id;
        c.randomId = study.profiles.find((p) => p.kind === "random").id;
      }
      c.views = {};
      c.revision = 1;
      study.cases.push(c);
      study.active = c.id;
      setDirty();
      refresh();
      caseDialog();
    }
    $("addCase").onclick = () => safe(() => add(false));
    $("copyCase").onclick = () => safe(() => add(true));
    $("undoCase").onclick = () => {
      if (undo) {
        study.cases.splice(undo.index, 0, undo.c);
        undo = null;
        setDirty();
        refresh();
        casesDialog();
      }
    };
  }
  function controls() {
    const c = active(),
      run = chosen(c);
    $("activeCase").innerHTML = study.cases
      .map(
        (x) =>
          `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.id + " · " + x.name)}</option>`,
      )
      .join("");
    const s = selection[c.id] ||
      c.selected || {
        b: run?.c.b || Number(c.inputs.b) || c.bValues[0],
        Q: run?.c.Q || Number(c.inputs.Q) || c.QValues[0],
      };
    if (!c.bValues.includes(s.b)) s.b = c.bValues[0];
    if (!c.QValues.includes(s.Q)) s.Q = c.QValues[0];
    selection[c.id] = s;
    c.selected = s;
    for (const [id, arr, key] of [
      ["activeB", c.bValues, "b"],
      ["activeQ", c.QValues, "Q"],
    ])
      $(id).innerHTML = arr
        .map((v) => `<option ${v === s[key] ? "selected" : ""}>${v}</option>`)
        .join("");
    $("linked").checked = study.linkedAxes;
    $("runButton").disabled = busy;
    $("cancelButton").disabled = !busy;
    $("caseTitle").textContent = c.name;
    $("caseMeta").textContent =
      `${c.id} · revision ${c.revision} · ${M.raw(study, c).axis || "Axis not recorded"} · ${c.bValues.length * c.QValues.length} scenarios · ${c.inputs.scope === "modes" ? "Listed modes only" : "Full oscillator bank"}`;
  }
  async function refresh() {
    controls();
    const rid = ++renderId,
      c = active(),
      all = result(c),
      run = chosen(c);
    $("results").hidden = !run;
    $("empty").hidden = !!run;
    $("summary").replaceChildren();
    if (!run) {
      status(busy ? "Calculating…" : "Inputs ready · calculation required");
      renderedId = rid;
      return;
    }
    const display = WBPlots.displayContext(run, c.display);
    c.display = {
      summaryScope: display.summaryScope, summaryMetric: display.summaryMetric,
      coverageView: display.coverageView, frequency: display.frequency,
      vrsFactor: display.vrsFactor, legendMode: display.legendMode,
    };
    for (const id of ["summaryScope", "summaryMetric", "coverageView"])
      $(id).value = display[id];
    $("summaryFrequency").innerHTML = display.frequencies.map(f =>
      `<option value="${f}" ${f === display.frequency ? "selected" : ""}>${n(f, 7)} Hz</option>`).join("");
    $("frequencySlider").max = display.frequencies.length - 1;
    $("frequencySlider").value = display.frequencies.indexOf(display.frequency);
    $("frequencySlider").setAttribute("aria-valuetext", `${n(display.frequency, 7)} Hz`);
    $("frequencyPreview").textContent = `${n(display.frequency, 7)} Hz`;
    $("summaryFrequency").disabled = display.summaryScope !== "frequency";
    $("frequencySlider").disabled = display.summaryScope !== "frequency" || display.frequencies.length < 2;
    $("plotContext").textContent = `Source spectra: selected b ${run.c.b}, Q ${run.c.Q}. Coverage: ${display.coverageView === "envelope" ? "all calculated pairs, with selected pair overlaid" : "selected pair"}.`;
    $("summaryContext").textContent = `${display.summaryScope === "overall" ? "Each cell uses its minimum over assessed frequencies; the governing frequency can differ between cells." : `Showing ${n(display.frequency, 7)} Hz from the calculated ${run.c.scope === "modes" ? "listed modes" : "oscillator bank"}; no interpolation.`} Headline minima remain overall.`;
    const worst = all.reduce((a, b) =>
        a.r.worst.margin < b.r.worst.margin ? a : b,
      ),
      peak = all.reduce((a, b) =>
        a.r.peakWorst.peakRatio < b.r.peakWorst.peakRatio ? a : b,
      );
    $("summary").innerHTML =
      `<div class="${run.r.worst.margin < 1 ? "gap" : ""}">Selected scenario fatigue coverage<strong>${n(run.r.worst.margin)}×</strong><small>At ${n(run.r.worst.fn)} Hz · b ${run.c.b}, Q ${run.c.Q}<br>Target ≥ 1 · ${esc(run.c.method)}</small></div><div class="${run.r.peakWorst.peakRatio < 1 ? "gap" : ""}">Selected scenario peak coverage<strong>${n(run.r.peakWorst.peakRatio)}×</strong><small>At ${n(run.r.peakWorst.fn)} Hz · ${esc(VDCReport.peakLabel(run.c))}<br>Relative displacement · ${n(run.c.T)} s random exposure</small></div><div class="${worst.r.worst.margin < 1 || peak.r.peakWorst.peakRatio < 1 ? "gap" : ""}">Governing across assumptions<strong>${n(worst.r.worst.margin)}× fatigue / ${n(peak.r.peakWorst.peakRatio)}× peak</strong><small>Fatigue: b ${worst.c.b}, Q ${worst.c.Q}, ${n(worst.r.worst.fn)} Hz<br>Peak: Q ${peak.c.Q}, ${n(peak.r.peakWorst.fn)} Hz</small></div>`;
    $("review").innerHTML =
      `<p>${esc(VDCReport.summary(run.c, run.r).scope)}. View limits do not change this scope. Sampled minima and gap endpoints are not exact frequency crossings.</p><p>Integration refinement at governing frequencies: fatigue ${n(100 * run.r.convergence)}%; peak ${n(100 * run.r.peakConvergence)}%.</p><ul>${[...new Set(all.flatMap((s) => s.r.warnings))].map((w) => `<li>${esc(w)}</li>`).join("")}</ul><p><b>Assumption rationale:</b> ${esc(run.c.rationale || "Not recorded")}</p><p><b>Analyst interpretation:</b> ${esc(run.c.analystNotes || "Not recorded")}</p>`;
    plotSpecs = new Map(WBPlots.specs(run, all, c.display).map((f) => [f.id, f]));
    for (const [group, ids] of Object.entries(WBPlots.order)) {
      const host = $(group);
      host.querySelectorAll(".plot").forEach((p) => Plotly.purge(p));
      host.innerHTML = ids
        .map((id) => {
          const f = plotSpecs.get(id);
          const boxed = (c.views[id]?.legend?.mode || f.legendMode) === "boxed";
          return `<section class="plotcard" id="card_${id}"><div class="plothead"><strong>${esc(f.title)}</strong><button data-axis="${id}">Axes</button>${f.kind !== "heatmap" ? `<button data-legend="${id}" aria-pressed="${boxed}" title="Toggle boxed legend">Legend</button>` : ""}<button data-fit="${id}" title="Fit data">Fit</button><button data-expand="${id}">Expand</button><button data-image="${id}" data-format="svg">SVG</button><button data-image="${id}" data-format="png">PNG</button></div><div class="plot" id="plot_${id}" role="img" aria-label="${esc(f.title)}"></div><div class="caption">${esc(f.definition || f.scope || "")}${f.series?.some(s => s.data.some(p => p[1] === 0)) ? " Zero values are marked at the log floor." : ""}</div></section>`;
        })
        .join("");
      for (const id of ids) {
        if (rid !== renderId) return;
        const f = plotSpecs.get(id),
          p = $("plot_" + id),
          g = WBPlots.figure(f, c.views[id]);
        await Plotly.newPlot(p, g.data, g.layout, g.config);
        p.on("plotly_relayout", changes => recordView(id, changes));
        if (id === "heatmap")
          p.on("plotly_click", (d) => {
            selection[c.id] = {
              b: Number(d.points[0].y),
              Q: Number(d.points[0].x),
            };
            setDirty();
            refresh();
          });
      }
    }
    if (!busy)
      status(`${all.length} scenarios current · b ${run.c.b}, Q ${run.c.Q}`);
    if (rid === renderId) renderedId = rid;
  }
  function recordView(id, changes) {
    const c = active(),
      p = $("plot_" + id);
    if (!p?._fullLayout) return;
    c.views[id] = WBPlots.viewOf(p);
    WBPlots.updateTicks(p);
    setDirty();
    if (changes && !Object.keys(changes).some(k => k.startsWith("xaxis.range") || k === "xaxis.autorange" || k === "xaxis.type")) return;
    if (
      suppressLink ||
      !study.linkedAxes ||
      ![
        "ratioPlot",
        "fatigueComparePlot",
        "peakPlot",
        "peakResponsePlot",
      ].includes(id)
    )
      return;
    const other = {
        ratioPlot: "fatigueComparePlot",
        fatigueComparePlot: "ratioPlot",
        peakPlot: "peakResponsePlot",
        peakResponsePlot: "peakPlot",
      }[id],
      x = c.views[id].x;
    const el = $("plot_" + other);
    if (el?._fullLayout) {
      suppressLink = true;
      Plotly.relayout(el, {
        "xaxis.type": x.type,
        "xaxis.range": x.range,
        "xaxis.autorange": false,
      }).finally(() => {
        c.views[other] = WBPlots.viewOf(el);
        suppressLink = false;
      });
    }
  }
  function axisDialog(id) {
    const p = $("plot_" + id),
      v = WBPlots.viewOf(p),
      f = plotSpecs.get(id);
    editor(
      "Axis limits · " + f.title,
      `<p class="helptext">Limits affect this view and its exports only. Enter physical values for numeric axes. For category axes, limits are zero-based category positions (−0.5 to N−0.5 shows N full categories).</p><div class="fields">${[
        "x",
        "y",
      ]
        .map((a) => {
          const q = v[a],
            cat = q.type === "category",
            r = q.range.map((x) => (q.type === "log" ? 10 ** x : x));
          return (
            field(
              a + "Type",
              a.toUpperCase() + " scale",
              q.type,
              "",
              cat
                ? [["category", "Category"]]
                : [
                    ["log", "Logarithmic"],
                    ["linear", "Linear"],
                  ],
            ) +
            field(
              a + "Min",
              a.toUpperCase() + " minimum",
              Number(r[0].toPrecision(10)),
            ) +
            field(
              a + "Max",
              a.toUpperCase() + " maximum",
              Number(r[1].toPrecision(10)),
            )
          );
        })
        .join(
          "",
        )}${f.kind === "heatmap" ? field("colorMin", "Color minimum", v.color[0]) + field("colorMax", "Color maximum", v.color[1]) : ""}</div>`,
      [
        ["Cancel", () => $("editor").close()],
        [
          "Apply limits",
          async () => {
            const update = {};
            for (const a of ["x", "y"]) {
              const type = $("f_" + a + "Type").value,
                min = Number($("f_" + a + "Min").value),
                max = Number($("f_" + a + "Max").value);
              if (
                !Number.isFinite(min) ||
                !Number.isFinite(max) ||
                max <= min ||
                (type === "log" && min <= 0) ||
                $("f_" + a + "Min").value === "" ||
                $("f_" + a + "Max").value === ""
              )
                throw Error(
                  "Enter finite increasing limits; logarithmic limits must be positive.",
                );
              update[a + "axis.type"] = type;
              update[a + "axis.range"] =
                type === "log"
                  ? [Math.log10(min), Math.log10(max)]
                  : [min, max];
              update[a + "axis.autorange"] = false;
            }
            if (f.kind === "heatmap") {
              const lo = Number($("f_colorMin").value),
                hi = Number($("f_colorMax").value);
              if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo)
                throw Error("Color maximum must exceed minimum.");
              await Plotly.restyle(p, { zmin: lo, zmax: hi }, [0]);
            }
            await Plotly.relayout(p, update);
            recordView(id);
            $("editor").close();
          },
          true,
        ],
      ],
    );
  }
  async function fit(id) {
    const legend = WBPlots.viewOf($("plot_" + id)).legend;
    active().views[id] = legend ? { legend } : {};
    const f = plotSpecs.get(id),
      g = WBPlots.figure(f, active().views[id]);
    await Plotly.react($("plot_" + id), g.data, g.layout, g.config);
    recordView(id);
  }
  async function toggleLegend(id) {
    const c = active(), p = $("plot_" + id), view = WBPlots.viewOf(p);
    view.legend = { mode: view.legend.mode === "boxed" ? "above" : "boxed" };
    c.views[id] = view;
    const g = WBPlots.figure(plotSpecs.get(id), view);
    await Plotly.react(p, g.data, g.layout, g.config);
    document.querySelector(`[data-legend="${id}"]`).setAttribute("aria-pressed", String(view.legend.mode === "boxed"));
    recordView(id);
  }
  async function calculate(all = false) {
    ensureIdle();
    error("");
    const cases = all ? study.cases.filter((c) => c.included) : [active()];
    if (!cases.length) throw Error("Include at least one case.");
    study = M.validate(study);
    busy = true;
    controls();
    try {
      for (let i = 0; i < cases.length; i++) {
        const c = study.cases.find((x) => x.id === cases[i].id),
          sig = M.signature(study, c);
        status(`Calculating ${i + 1}/${cases.length}: ${c.name}`);
        const output = await new Promise((resolve, reject) => {
          const url = URL.createObjectURL(
            new Blob([WORKER_SOURCE], { type: "text/javascript" }),
          );
          worker = new Worker(url);
          URL.revokeObjectURL(url);
          worker._reject = reject;
          worker.onmessage = (e) => {
            if (e.data.progress != null)
              $("progress").style.width =
                (100 * (i + e.data.progress)) / cases.length + "%";
            else if (e.data.error) reject(Error(`${c.id}: ${e.data.error}`));
            else resolve(e.data.scenarios);
          };
          worker.onerror = (e) => reject(Error(e.message));
          worker.postMessage({
            inputs: M.raw(study, c),
            bs: c.bValues,
            qs: c.QValues,
          });
        });
        worker.terminate();
        worker = null;
        runs.set(c.id, { signature: sig, scenarios: output });
      }
    } finally {
      worker?.terminate();
      worker = null;
      busy = false;
      $("progress").style.width = "0";
      await refresh();
    }
  }
  function cancel() {
    if (worker) {
      worker._reject(
        Error("Calculation cancelled. Completed cases are retained."),
      );
      worker.terminate();
      worker = null;
    }
  }
  function tableDialog() {
    const all = result(active());
    if (!all) throw Error("Run the case first.");
    editor(
      "Scenario results",
      `<p>Minima use the assessment scope, independent of plot zoom.</p><div class="scenarioTable"><table><thead><tr><th>b</th><th>Q</th><th>Fatigue coverage</th><th>Frequency Hz</th><th>Peak coverage</th><th>Frequency Hz</th><th>Refinement %</th></tr></thead><tbody>${all.map((s) => `<tr><td>${s.c.b}</td><td>${s.c.Q}</td><td>${n(s.r.worst.margin)}</td><td>${n(s.r.worst.fn)}</td><td>${n(s.r.peakWorst.peakRatio)}</td><td>${n(s.r.peakWorst.fn)}</td><td>${n(s.r.convergence * 100)}</td></tr>`).join("")}</tbody></table></div><p class="small">Peak results repeat here for traceability within each scenario; the peak method does not depend on b.</p>`,
      [["Close", () => $("editor").close()]],
    );
  }
  function readme(section) {
    $("readme").showModal();
    if (section)
      setTimeout(
        () =>
          $("readmeArticle")
            .querySelector("#" + section)
            ?.scrollIntoView(),
        50,
      );
  }
  async function safe(fn) {
    try {
      await fn();
    } catch (e) {
      error(e);
      status(e.message);
    }
  }
  const actions = {
    case: caseDialog,
    settings: settingsDialog,
    appearance: appearanceDialog,
    profiles: () => profilesDialog(),
    cases: casesDialog,
    run: () => calculate(),
    runAll: () => calculate(true),
    cancel,
    table: tableDialog,
    readme: () => readme(),
    worked: () => readme("worked-example"),
    about: () =>
      editor(
        "About the workbench",
        "<p>Workbench 3.0.0 · calculation engine " +
          VDC.VERSION +
          "</p><p>Local, offline calculations. Study data is saved only when you download it.</p><p>Plotly.js 4.1.1 (MIT), SheetJS CE 0.20.3 (Apache 2.0), PptxGenJS 4.0.1 (MIT). Full licenses accompany the repository distribution.</p>",
        [["Close", () => $("editor").close()]],
      ),
    save: () => {
      save(
        VDCReport.slug(study.title) + ".json",
        new Blob([JSON.stringify(study, null, 2)], {
          type: "application/json",
        }),
      );
      dirty = false;
      status("Study saved; results will be recalculated when reopened.");
    },
    open: () => {
      ensureIdle();
      $("openFile").click();
    },
    excel: () => {
      ensureIdle();
      $("excelFile").click();
    },
    template: () =>
      save(
        "vibration_spectra_template.xlsx",
        new Blob(
          [Uint8Array.from(atob(TEMPLATE_BASE64), (c) => c.charCodeAt(0))],
          {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ),
      ),
    new: () => {
      ensureIdle();
      editor(
        "New study",
        "<p>Create a new illustrative study? Save the current study first if you need to retain it.</p>",
        [
          ["Cancel", () => $("editor").close()],
          [
            "Create study",
            () => {
              study = M.initial();
              runs.clear();
              selection = {};
              dirty = true;
              $("editor").close();
              refresh();
            },
            true,
          ],
        ],
      );
    },
    reset: async () => {
      active().views = {};
      setDirty();
      await refresh();
    },
    link: () => {
      study.linkedAxes = !study.linkedAxes;
      setDirty();
      controls();
    },
    refine: () => {
      ensureIdle();
      const c = active();
      editor(
        "Refine frequency sampling",
        `<p>Increase points per octave from ${esc(c.inputs.density)} to ${Math.min(192, Number(c.inputs.density) * 2)}. This changes the calculation grid and invalidates the active case results. Integration refinement is checked separately.</p>`,
        [
          ["Cancel", () => $("editor").close()],
          [
            "Apply density",
            () => {
              const next = M.copy(study),
                a = next.cases.find((x) => x.id === c.id);
              a.inputs.density = String(
                Math.min(192, Number(a.inputs.density) * 2),
              );
              a.revision++;
              apply(next);
            },
            true,
          ],
        ],
      );
    },
    csv: () => WBExports.csv(active(), result(active()), save),
    export: () => exportDialog(),
  };
  function exportDialog() {
    const c = active();
    editor(
      "Report & export selection",
      `<p class="helptext">Select cases and scenarios. Requirement plots are included. Saved plot limits are honored. All selected cases must have current calculations.</p><div class="fields">${field("reportTitle", "Report title", study.title)}${field(
        "reportScenarios",
        "Scenarios",
        "selected",
        "Selected b/Q is remembered independently for each case.",
        [
          ["selected", "Selected scenario per case"],
          ["all", "All b × Q scenarios"],
        ],
      )}</div><p>${study.cases.map((x) => `<label style="display:block;margin:10px"><input type="checkbox" class="exportCase" value="${x.id}" ${x.included ? "checked" : ""}> ${esc(x.id + " · " + x.name)} (${result(x) ? "current" : "needs calculation"})</label>`).join("")}</p><p class="small">PowerPoint adds a study summary and four slides per exported scenario. Seven cases with one scenario each produce 29 slides.</p>`,
      [
        ["Close", () => $("editor").close()],
        ["Summary CSV", () => doExport("summary")],
        ["HTML report", () => doExport("html")],
        ["PowerPoint", () => doExport("pptx"), true],
      ],
    );
    async function doExport(kind) {
      ensureIdle();
      const ids = [...document.querySelectorAll(".exportCase:checked")].map(
        (x) => x.value,
      );
      if (!ids.length) throw Error("Select at least one case.");
      const selected = ids.map((id) => study.cases.find((c) => c.id === id));
      for (const c of selected)
        if (!result(c))
          throw Error(
            `${c.id} has missing or changed results; calculate before exporting.`,
          );
      const title = $("f_reportTitle").value.trim();
      if (!title || title.length > 200)
        throw Error("Report title must be 1–200 characters.");
      study.title = title;
      setDirty();
      const items = selected.flatMap((c) =>
        ($("f_reportScenarios").value === "all" ? result(c) : [chosen(c)]).map(
          (run) => ({ entry: M.copy(c), run, all: result(c) }),
        ),
      );
      const labels = [...$("editorFoot").querySelectorAll("button")];
      labels.forEach((b) => (b.disabled = true));
      status("Preparing report…");
      try {
        await WBExports[kind](title, items, save);
        status("Report exported.");
      } finally {
        labels.forEach((b) => (b.disabled = false));
      }
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.close) {
      $(b.dataset.close).close();
      return;
    }
    if (b.dataset.action) {
      document
        .querySelectorAll(".menu details")
        .forEach((d) => (d.open = false));
      safe(actions[b.dataset.action]);
    }
    if (b.dataset.axis) safe(() => axisDialog(b.dataset.axis));
    if (b.dataset.legend) safe(() => toggleLegend(b.dataset.legend));
    if (b.dataset.fit) safe(() => fit(b.dataset.fit));
    if (b.dataset.expand) {
      const card = $("card_" + b.dataset.expand);
      card.classList.toggle("expanded");
      b.textContent = card.classList.contains("expanded")
        ? "Restore"
        : "Expand";
      Plotly.Plots.resize($("plot_" + b.dataset.expand));
    }
    if (b.dataset.image)
      safe(async () => {
        const id = b.dataset.image;
        if (!result(active())) throw Error("Recalculate before exporting.");
        const url = await WBPlots.image(
          plotSpecs.get(id),
          WBPlots.viewOf($("plot_" + id)),
          b.dataset.format,
        );
        save(
          `${active().id}-${id}.${b.dataset.format}`,
          await (await fetch(url)).blob(),
        );
      });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document.querySelectorAll(".plotcard.expanded").forEach((c) => {
        c.classList.remove("expanded");
        c.querySelector("[data-expand]").textContent = "Expand";
        Plotly.Plots.resize(c.querySelector(".plot"));
      });
  });
  $("activeCase").onchange = (e) => {
    study.active = e.target.value;
    setDirty();
    refresh();
  };
  for (const [id, k] of [
    ["activeB", "b"],
    ["activeQ", "Q"],
  ])
    $(id).onchange = (e) => {
      selection[active().id][k] = Number(e.target.value);
      setDirty();
      refresh();
    };
  function changeDisplay(key, value) {
    const c = active();
    c.display = { ...c.display, [key]: value };
    if (key === "coverageView")
      for (const id of ["ratioPlot", "peakPlot"])
        if (c.views[id]) delete c.views[id].y;
    if (key === "frequency" || key === "summaryScope")
      if (c.views.bars) delete c.views.bars.y;
    setDirty();
    refresh();
  }
  for (const id of ["summaryScope", "summaryMetric", "coverageView"])
    $(id).onchange = e => changeDisplay(id, e.target.value);
  $("summaryFrequency").onchange = e => changeDisplay("frequency", Number(e.target.value));
  $("frequencySlider").oninput = e => {
    const option = $("summaryFrequency").options[Number(e.target.value)];
    $("summaryFrequency").value = option.value;
    $("frequencyPreview").textContent = option.text;
    e.target.setAttribute("aria-valuetext", option.text);
  };
  $("frequencySlider").onchange = () => changeDisplay("frequency", Number($("summaryFrequency").value));
  $("linked").onchange = (e) => {
    study.linkedAxes = e.target.checked;
    setDirty();
  };
  async function load(file, excel) {
    if (!file) return;
    ensureIdle();
    if (file.size > 20 * 1024 * 1024) throw Error("File exceeds 20 MB.");
    const next = excel
      ? WBExcel.read(await file.arrayBuffer(), XLSX)
      : M.legacy(JSON.parse(await file.text()));
    editor(
      excel ? "Review Excel import" : "Review study import",
      `<p>Replace the current study with ${next.cases.length} cases and ${next.profiles.length} profiles?</p><table><thead><tr><th>Case</th><th>Sine / random</th><th>Scenarios</th><th>Peak model</th></tr></thead><tbody>${next.cases.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.sineId + " / " + c.randomId)}</td><td>${c.bValues.length * c.QValues.length}</td><td>${esc(c.inputs.peakMode)}</td></tr>`).join("")}</tbody></table><p>Import is all-or-nothing. Results must be recalculated. Save the current study first if needed.</p>`,
      [
        ["Cancel", () => $("editor").close()],
        [
          "Apply import",
          () => {
            study = next;
            runs.clear();
            selection = {};
            dirty = true;
            $("editor").close();
            refresh();
          },
          true,
        ],
      ],
    );
  }
  $("openFile").onchange = (e) => {
    safe(() => load(e.target.files[0], false));
    e.target.value = "";
  };
  $("excelFile").onchange = (e) => {
    safe(() => load(e.target.files[0], true));
    e.target.value = "";
  };
  $("printReadme").onclick = () => window.print();
  $("downloadReadme").onclick = () =>
    save(
      "vibration_technical_readme.html",
      new Blob(
        [
          '<!doctype html><meta charset="utf-8"><title>Vibration comparison method</title><style>' +
            document.querySelector("style").textContent +
            '</style><article class="reading">' +
            $("readmeArticle").innerHTML +
            "</article>",
        ],
        { type: "text/html" },
      ),
    );
  let searchIndex = -1;
  $("findReadme").onclick = () => {
    const q = $("readmeSearch").value.toLowerCase().trim();
    const nodes = [...$("readmeArticle").querySelectorAll("h2,h3,p,td,li")];
    nodes.forEach((x) => (x.style.background = ""));
    const found = nodes.filter(
      (x) => q && x.textContent.toLowerCase().includes(q),
    );
    if (found.length) {
      searchIndex = (searchIndex + 1) % found.length;
      found[searchIndex].style.background = "#fff0bf";
      found[searchIndex].scrollIntoView({ block: "center" });
    } else $("readmeSearch").setCustomValidity("No matches");
  };
  $("readmeSearch").oninput = () => {
    searchIndex = -1;
    $("readmeSearch").setCustomValidity("");
  };
  document
    .querySelector("#additional")
    .parentElement.addEventListener("toggle", () =>
      document
        .querySelectorAll("#additional .plot")
        .forEach((p) => p._fullLayout && Plotly.Plots.resize(p)),
    );
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  actions.example = () => {
    ensureIdle();
    if (study.cases.length >= 30) throw Error("Maximum 30 cases.");
    let i = 1;
    while (
      study.cases.some((c) => c.id === "Example" + i) ||
      study.profiles.some(
        (p) => p.id === "ExampleS" + i || p.id === "ExampleR" + i,
      )
    )
      i++;
    const id = "Example" + i;
    study.profiles.push(
      {
        id: "ExampleS" + i,
        kind: "sine",
        name: "Worked example: 1 g sine",
        revision: "Illustrative",
        text: "90,110,accel_g_pk,1,1",
      },
      {
        id: "ExampleR" + i,
        kind: "random",
        name: "Worked example: flat PSD",
        revision: "Illustrative",
        text: "90,0.03\n110,0.03",
      },
    );
    study.cases.push({
      id,
      name: "Worked example at 100 Hz",
      sineId: "ExampleS" + i,
      randomId: "ExampleR" + i,
      bValues: [4],
      QValues: [10],
      included: true,
      revision: 1,
      views: {},
      inputs: {
        ...M.defaults,
        dwellMode: "documented",
        dwellText: "100,1,0,3000,1",
        duration: "0.5",
        fmin: "90",
        fmax: "110",
        inspectFn: "100",
        modesText: "100",
        scope: "modes",
        passes: "0",
        assumedHours: "0",
        assumedCycles: "3000",
      },
    });
    study.active = id;
    setDirty();
    $("readme").close();
    refresh();
  };
  refresh();
  return {
    get study() {
      return study;
    },
    get runs() {
      return runs;
    },
    get busy() {
      return busy;
    },
    get rendering() {
      return renderedId !== renderId;
    },
    result,
    chosen,
    refresh,
    calculate,
    load,
    actions,
  };
})();
