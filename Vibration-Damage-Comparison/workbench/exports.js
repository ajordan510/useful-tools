const WBExports = (() => {
  const esc = VDCReport.xml,
    num = VDCReport.num;
  const short = (v, n = 70) => {
    const s = String(v).replace(/\s+/g, " ");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+@\-]/.test(s) && !Number.isFinite(Number(s))) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csvBlob = (rows) =>
    new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
  function csv(entry, all, save) {
    if (!all) throw Error("Run the case first.");
    const rows = [
      [
        "case",
        "revision",
        "workbench_version",
        "engine_version",
        "b",
        "Q",
        "frequency_Hz",
        "assessed",
        "sine_damage",
        "random_damage",
        "required_random_damage",
        "fatigue_R",
        "fatigue_coverage",
        "sine_peak_m",
        "random_peak_m",
        "RMS_m",
        "peak_coverage",
        "peak_model",
        "nominal_probability_percent",
        "effective_k",
        "expected_cycles",
        "random_total_s",
        "bandwidth_alpha",
        "sweep_damage",
        "dwell_damage",
        "equivalent_random_minutes",
      ],
    ];
    for (const s of all)
      for (const r of s.r.rows)
        rows.push([
          entry.name,
          entry.revision,
          WBModel.VERSION,
          s.r.version,
          s.c.b,
          s.c.Q,
          r.fn,
          s.c.scope === "bank" || s.c.modes.includes(r.fn),
          r.heritage,
          r.random,
          s.c.damageFactor * r.random,
          r.ratio,
          r.margin,
          r.peakSine,
          r.peakRandom,
          r.sigma,
          r.peakRatio,
          s.c.peakMode,
          s.c.peakMode === "extreme" ? s.c.peakProbability : "",
          r.effectivePeakFactor,
          r.peakCycles,
          s.c.T,
          r.alpha,
          r.sweep,
          r.dwell,
          r.eqMinutes,
        ]);
    save(entry.id + "-all-scenarios.csv", csvBlob(rows));
  }
  function summary(title, items, save) {
    const rows = [
      [
        "case",
        "revision",
        "b",
        "Q",
        "scope",
        "minimum_fatigue_coverage",
        "fatigue_Hz",
        "minimum_peak_coverage",
        "peak_Hz",
        "peak_model",
        "nominal_probability_percent",
        "random_seconds",
        "fatigue_integration_change_percent",
        "peak_integration_change_percent",
        "generated",
        "assumption_rationale",
      ],
    ];
    for (const { entry, run: s } of items)
      rows.push([
        entry.name,
        entry.revision,
        s.c.b,
        s.c.Q,
        s.c.scope,
        s.r.worst.margin,
        s.r.worst.fn,
        s.r.peakWorst.peakRatio,
        s.r.peakWorst.fn,
        s.c.peakMode,
        s.c.peakMode === "extreme" ? s.c.peakProbability : "",
        s.c.T,
        s.r.convergence * 100,
        s.r.peakConvergence * 100,
        s.r.generated,
        s.c.rationale,
      ]);
    save(VDCReport.slug(title) + "-summary.csv", csvBlob(rows));
  }
  async function images(item, format = "png") {
    const figs = WBPlots.specs(item.run, item.all, item.entry.display);
    const map = {};
    for (const id of [
      ...WBPlots.order.requirements,
      ...WBPlots.order.fatigue,
      ...WBPlots.order.peak,
      ...WBPlots.order.scenarios,
    ])
      map[id] = await WBPlots.image(
        figs.find((f) => f.id === id),
        item.entry.views[id],
        format,
        WBPlots.order.requirements.includes(id) ? 800 : 1000,
        WBPlots.order.requirements.includes(id) ? 550 : 600,
      );
    return map;
  }
  function provenance(item) {
    return JSON.stringify(
      {
        caseId: item.entry.id,
        caseRevision: item.entry.revision,
        workbenchVersion: WBModel.VERSION,
        engineVersion: item.run.r.version,
        inputs: item.run.c,
        generated: item.run.r.generated,
        views: item.entry.views,
        display: item.entry.display,
        assessment: VDCReport.summary(item.run.c, item.run.r),
        warnings: item.run.r.warnings,
        convergence: item.run.r.convergence,
        peakConvergence: item.run.r.peakConvergence,
      },
      null,
      2,
    );
  }
  async function html(title, items, save) {
    let body = `<h1>${esc(title)}</h1><p>Relative exposure comparison · Workbench ${WBModel.VERSION} · engine ${VDC.VERSION}. Plot limits affect presentation only.</p>`;
    for (const item of items) {
      const s = item.run,
        t = VDCReport.summary(s.c, s.r),
        img = await images(item, "svg");
      body += `<section><h2>${esc(item.entry.name)} · b ${s.c.b}, Q ${s.c.Q}</h2><p class="display-note">${esc(WBPlots.displayNote(s, item.entry.display))}</p><div class="takeaway">Selected b ${s.c.b}, Q ${s.c.Q} — overall assessment<br>${esc(t.fatigue)}<br>${esc(t.peak)}</div><p>${esc(t.scope)}. ${esc(VDCReport.peakCaption(s.c))}</p><table>${VDCReport.specs(
        s.c,
        s.r,
      )
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
        .join(
          "",
        )}</table><h3>Requirements</h3><div class="three">${WBPlots.order.requirements.map((id) => `<img alt="${esc(id)}" src="${img[id]}">`).join("")}</div><h3>Fatigue</h3><div class="pair">${WBPlots.order.fatigue.map((id) => `<img alt="${esc(id)}" src="${img[id]}">`).join("")}</div><p>Fatigue coverage = R / F, where R = sine damage / random damage and F = ${s.c.damageFactor}. The source plot includes F in the required random curve. Target = 1.</p><h3>Peak response</h3><div class="pair">${WBPlots.order.peak.map((id) => `<img alt="${esc(id)}" src="${img[id]}">`).join("")}</div><p>${esc(VDCReport.peakBasis(s.c, s.r))}</p><h3>Assumption comparison</h3><div class="pair">${WBPlots.order.scenarios.map((id) => `<img alt="${esc(id)}" src="${img[id]}">`).join("")}</div><p>Assumption rationale: ${esc(s.c.rationale || "Not recorded")}</p><p>Analyst interpretation: ${esc(s.c.analystNotes || "Not recorded")}</p><ul>${s.r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><details><summary>Exact calculation inputs, views and provenance</summary><pre>${esc(provenance(item))}</pre></details></section>`;
    }
    save(
      VDCReport.slug(title) + ".html",
      new Blob(
        [
          `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.5 Arial;color:#253647;max-width:1400px;margin:35px auto;padding:20px}h1,h2{color:#174d70}h2{margin-top:38px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:7px;border-bottom:1px solid #ddd}th{width:220px}.pair,.three{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.three{grid-template-columns:repeat(3,1fr)}img{width:100%}.takeaway{padding:15px;border-left:4px solid #246b94;background:#f1f5f7}pre{white-space:pre-wrap;font-size:12px}section{break-before:page}@media print{body{margin:0;padding:0}.pair,.three{break-inside:avoid}details{display:block}}</style>${body}</html>`,
        ],
        { type: "text/html" },
      ),
    );
  }
  async function pptx(title, items, save) {
    const ppt = new PptxGenJS();
    ppt.layout = "LAYOUT_WIDE";
    ppt.author = "Vibration comparison workbench";
    ppt.subject = "Relative fatigue and peak exposure assessment";
    ppt.title = title;
    ppt.company = "";
    ppt.lang = "en-US";
    ppt.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-US" };
    const text = (slide, t, x, y, w, h, size = 14, extra = {}) =>
      slide.addText(String(t), {
        x,
        y,
        w,
        h,
        fontFace: "Arial",
        fontSize: size,
        color: "253647",
        margin: 0,
        breakLine: false,
        ...extra,
      });
    const page = (heading, item) => {
      const slide = ppt.addSlide();
      slide.background = { color: "FFFFFF" };
      text(slide, short(heading, 70), 0.4, 0.22, 12.5, 0.5, 23, {
        bold: true,
        color: "164D70",
        fit: "shrink",
      });
      slide.addShape(ppt.ShapeType.line, {
        x: 0.4,
        y: 0.85,
        w: 12.5,
        h: 0,
        line: { color: "BCC9D2", width: 1 },
      });
      if (item) {
        text(
          slide,
          `${short(item.entry.name, 65)} | b ${item.run.c.b}, Q ${item.run.c.Q} | ${short(VDCReport.summary(item.run.c, item.run.r).scope, 70)}`,
          0.4,
          0.91,
          12.5,
          0.35,
          11,
          { fit: "shrink" },
        );
        slide.addNotes(provenance(item));
      }
      text(
        slide,
        `Workbench ${WBModel.VERSION} · engine ${VDC.VERSION} · relative exposure severity`,
        0.4,
        7.17,
        12.5,
        0.18,
        9,
        { color: "647786" },
      );
      return slide;
    };
    for (let off = 0; off < items.length; off += 10) {
      const sl = page(off ? title + " — continued" : title);
      text(sl, "Assessment summary", 0.4, 1.05, 12, 0.35, 18, { bold: true });
      const rows = [
        [
          { text: "Case / scenario" },
          { text: "Fatigue coverage" },
          { text: "Peak coverage" },
        ],
        ...items
          .slice(off, off + 10)
          .map((i) => [
            {
              text: `${short(i.entry.name, 65)} · b ${i.run.c.b}, Q ${i.run.c.Q}`,
            },
            {
              text: `${num(i.run.r.worst.margin)}× at ${num(i.run.r.worst.fn)} Hz`,
            },
            {
              text: `${num(i.run.r.peakWorst.peakRatio)}× at ${num(i.run.r.peakWorst.fn)} Hz`,
            },
          ]),
      ];
      sl.addTable(rows, {
        x: 0.4,
        y: 1.6,
        w: 12.5,
        colW: [6.1, 3.2, 3.2],
        fontSize: 12,
        fontFace: "Arial",
        color: "253647",
        border: { pt: 0.4, color: "D9E1E6" },
        rowH: 0.34,
        margin: 0.08,
        autoPage: true,
      });
      text(
        sl,
        "Target ≥ 1. Minima use the recorded assessment scope. Assumption ranges are sensitivity cases; they are not a joint probability or an absolute life prediction.",
        0.4,
        6.6,
        12.5,
        0.42,
        12,
      );
      sl.addNotes(
        "Report title: " + title + "\n" + items.map(provenance).join("\n\n"),
      );
    }
    for (const item of items) {
      const s = item.run,
        t = VDCReport.summary(s.c, s.r),
        img = await images(item);
      let sl = page("Input requirements", item);
      const ids = WBPlots.order.requirements;
      ids.forEach((id, j) =>
        sl.addImage({
          data: img[id],
          x: 0.22 + j * 4.37,
          y: 1.35,
          w: 4.28,
          h: 2.94,
        }),
      );
      const lines = VDCReport.specs(s.c, s.r).map(
        ([k, v]) => `${k}: ${short(v, 55)}`,
      );
      text(sl, lines.slice(0, 5).join("\n"), 0.4, 4.55, 6.1, 2.2, 12, {
        paraSpaceAfterPt: 4,
        fit: "shrink",
      });
      text(sl, lines.slice(5).join("\n"), 6.8, 4.55, 6.1, 2.2, 12, {
        paraSpaceAfterPt: 4,
        fit: "shrink",
      });
      for (const [k, heading, takeaway] of [
        ["fatigue", "Fatigue coverage", t.fatigue],
        ["peak", "Peak response coverage", t.peak],
        [
          "scenarios",
          "Sensitivity to fatigue exponent and damping",
          "Each heatmap cell is an independent b × Q comparison; peak response depends on Q, not b.",
        ],
      ]) {
        sl = page(heading, item);
        WBPlots.order[k].forEach((id, j) =>
          sl.addImage({
            data: img[id],
            x: 0.25 + j * 6.55,
            y: 1.35,
            w: 6.3,
            h: 3.78,
          }),
        );
        sl.addShape(ppt.ShapeType.rect, {
          x: 0.4,
          y: 5.25,
          w: 12.5,
          h: 0.75,
          fill: { color: "EDF3F6" },
          line: { color: "EDF3F6" },
        });
        text(sl, k !== "scenarios" && item.entry.display?.coverageView === "envelope" ? "Selected b/Q: " + takeaway : takeaway, 0.6, 5.42, 12.1, 0.4, 17, {
          bold: true,
          fit: "shrink",
        });
        const definition =
          k === "fatigue"
            ? `Coverage = sine damage / (F × random damage), F = ${s.c.damageFactor}. Target = 1. Same b, Q and response coordinate on both curves.`
            : k === "peak"
              ? VDCReport.peakCaption(s.c) + " RMS is context, not a peak."
              : WBPlots.displayNote(s, item.entry.display);
        text(sl, definition, 0.4, 6.2, 12.5, 0.65, 13, { fit: "shrink" });
      }
    }
    const blob = await ppt.write({ outputType: "blob" });
    save(VDCReport.slug(title) + ".pptx", blob);
  }
  return { csv, summary, html, pptx };
})();
