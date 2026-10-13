const WBPlots = (() => {
  const colors = ["#2563a6", "#b66b16", "#7964a5", "#197b83"],
    dash = ["solid", "dash", "dot", "dashdot"];
  const order = {
    requirements: ["sinePlot", "sineDisplacementPlot", "psdPlot"],
    fatigue: ["fatigueComparePlot", "ratioPlot"],
    peak: ["peakResponsePlot", "peakPlot"],
    scenarios: ["heatmap", "bars"],
    additional: ["damagePlot", "responsePlot"],
  };
  const esc = VDCReport.xml,
    n = VDCReport.num;
  function displayContext(run, display = {}) {
    const frequencies = run.r.rows
      .filter(r => run.c.scope !== "modes" || run.c.modes.includes(r.fn))
      .map(r => r.fn);
    const requested = display.frequency || run.c.inspectFn;
    const frequency = frequencies.reduce((a, b) =>
      Math.abs(Math.log(a / requested)) <= Math.abs(Math.log(b / requested)) ? a : b);
    return {
      summaryScope: display.summaryScope || "overall",
      summaryMetric: display.summaryMetric || "fatigue",
      coverageView: display.coverageView || "selected",
      frequency, frequencies,
    };
  }
  function coverageAt(s, key, frequency) {
    if (frequency != null) return s.r.rows.find(r => r.fn === frequency)[key];
    return key === "margin" ? s.r.worst.margin : s.r.peakWorst.peakRatio;
  }
  function displayNote(run, display) {
    const d = displayContext(run, display);
    return `Summary charts: ${d.summaryScope === "frequency" ? `at ${n(d.frequency, 7)} Hz (calculated point)` : "minimum over assessed frequencies"}. Coverage curves: ${d.coverageView === "envelope" ? "all-scenario range with selected b/Q overlaid; not a confidence interval" : "selected b/Q"}. Source spectra and headline minima remain scenario-specific and full-scope respectively.`;
  }
  function specs(run, all, display = {}) {
    const d = displayContext(run, display),
      frequency = d.summaryScope === "frequency" ? d.frequency : null,
      scopeLabel = frequency == null ? "Minimum" : `${n(frequency, 7)} Hz`,
      metric = d.summaryMetric === "peak" ? "peak" : "fatigue";
    const fs = VDCReport.figures(run.c, run.r, { crosscheck: true });
    fs.find(f=>f.id==='fatigueComparePlot').definition="Coverage on the right = sine damage / required random damage. Common Q and b; each exposure uses its recorded duration.";
    for (const f of fs)
      f.meta = `${run.c.caseName.slice(0, 70)} | b ${run.c.b}, Q ${run.c.Q} | ${run.c.dwellMode === "assumed" ? "Independent assumed resonances" : "Documented exposure"}`;
    for (const f of fs.filter(f => !order.requirements.includes(f.id)))
      f.definition = `Selected b = ${run.c.b}, Q = ${run.c.Q}. ${f.definition || ""}`;
    if (d.coverageView === "envelope") {
      for (const [id, key] of [["ratioPlot", "margin"], ["peakPlot", "peakRatio"]]) {
        const f = fs.find(f => f.id === id);
        const lo = [], hi = [], selected = [];
        run.r.rows.forEach((r, i) => {
          const values = all.map(s => s.r.rows[i][key]);
          lo.push([r.fn, Math.min(...values)]);
          hi.push([r.fn, Math.max(...values)]);
          selected.push([r.fn, r[key]]);
        });
        f.series = [
          {name: "Scenario minimum", data: lo, color: "#8298ad", dash: "dash"},
          {name: "Scenario maximum", data: hi, color: "#8298ad", dash: "dash", fill: "tonexty"},
          {name: `Selected b ${run.c.b}, Q ${run.c.Q}`, data: selected, color: colors[0], dash: "solid"},
        ];
        f.title = id === "ratioPlot" ? "Fatigue coverage · all scenarios" : "Peak coverage · all scenarios";
        delete f.governing;
        f.definition = `Shading spans the calculated b × Q scenarios at each frequency; the blue curve is b ${run.c.b}, Q ${run.c.Q}. This is an assumption range, not a confidence interval or simultaneous resonances. Target = 1. ${run.c.scope === "modes" ? "Only marked, listed modes are assessed." : ""}`;
        f.meta = `All-scenario range | selected b ${run.c.b}, Q ${run.c.Q} | Not a confidence interval`;
      }
    }
    const bs = [...new Set(all.map((s) => s.c.b))],
      qs = [...new Set(all.map((s) => s.c.Q))];
    fs.push({
      id: "heatmap",
      title: `${scopeLabel} ${metric} coverage by b and Q`,
      kind: "heatmap",
      bs,
      qs,
      all,
      frequency,
      metric,
      selected: { b: run.c.b, Q: run.c.Q },
      meta: frequency == null ? "Minimum over assessed frequencies; governing frequencies can differ by cell." : `At ${n(frequency, 7)} Hz; one calculated oscillator, not an overall minimum.`,
      definition:
        `${frequency == null ? "Cells show minimum assessed coverage." : `Cells show coverage at ${n(frequency, 7)} Hz; no interpolation.`} Select a cell to inspect that b/Q pair; the outline marks your selection. ${metric === "peak" ? "Peak response is independent of b. " : ""}Below 1 = modeled gap. Color defaults to 0–2 and saturates above 2; labels retain actual values.`,
    });
    fs.push({
      id: "bars",
      title: `${scopeLabel} coverage at b = ${run.c.b}`,
      kind: "bars",
      all: all.filter((s) => s.c.b === run.c.b),
      frequency,
      label: "Coverage",
      meta: frequency == null ? "Minimum over assessed frequencies; fatigue and peak minima can occur at different frequencies." : `At ${n(frequency, 7)} Hz; fatigue and peak evaluated at the same oscillator.`,
      definition:
        `Grouped columns compare fatigue and peak coverage by Q at b = ${run.c.b}. ${frequency == null ? "Minima may govern at different frequencies." : `Both metrics use ${n(frequency, 7)} Hz.`} Peak response is independent of b.`,
    });
    return fs;
  }
  function figure(f, view = {}, large = false) {
    const layout = {
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff",
      font: {
        family: "Arial, sans-serif",
        size: large ? 25 : 13,
        color: "#253647",
      },
      margin: { l: 85, r: 25, t: 65, b: 80 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.2,
        font: { size: large ? 21 : 11 },
      },
      hovermode: "closest",
      dragmode: "zoom",
      barmode: "group",
      xaxis: {
        title: { text: f.xLabel || "Quality factor Q", standoff: 12 },
        type: "log",
        showline: true,
        linecolor: "#46545f",
        linewidth: 1.2,
        layer: "above traces",
        mirror: true,
        showgrid: true,
        gridcolor: "#dce2e6",
        gridwidth: 1,
        ticks: "outside",
        exponentformat: "e",
        minexponent: 3,
        automargin: true,
      },
      yaxis: {
        title: { text: f.label || "Minimum coverage", standoff: 15 },
        type: "log",
        showline: true,
        linecolor: "#46545f",
        linewidth: 1.2,
        layer: "above traces",
        mirror: true,
        showgrid: true,
        gridcolor: "#dce2e6",
        gridwidth: 1,
        ticks: "outside",
        exponentformat: "e",
        minexponent: 3,
        automargin: true,
      },
    };
    let data;
    if (f.kind === "heatmap") {
      const z = f.bs.map((b) =>
        f.qs.map(
          (Q) => coverageAt(f.all.find((s) => s.c.b === b && s.c.Q === Q), f.metric === "peak" ? "peakRatio" : "margin", f.frequency),
        ),
      );
      data = [
        {
          type: "heatmap",
          x: f.qs.map(String),
          y: f.bs.map(String),
          z,
          text: z.map((row) => row.map((v) => n(v) + "×")),
          texttemplate: "%{text}",
          textfont: { size: large ? 17 : 14 },
          hovertemplate:
            `b %{y}, Q %{x}<br>${f.frequency == null ? "Minimum" : n(f.frequency, 7) + " Hz"} ${f.metric} coverage %{z:.4g}×<extra></extra>`,
          colorscale: [
            [0, "#eed4ac"],
            [0.5, "#f4f6f8"],
            [1, "#769ebd"],
          ],
          zmin: 0,
          zmax: 2,
          colorbar: { title: { text: "Coverage" }, thickness: 14 },
          ...(view.color ? { zmin: view.color[0], zmax: view.color[1] } : {}),
        },
      ];
      layout.xaxis.type = "category";
      layout.yaxis.type = "category";
      layout.yaxis.title.text = "Fatigue exponent b";
      layout.showlegend = false;
      layout.margin.t = 25;
      const ix = f.qs.indexOf(f.selected.Q), iy = f.bs.indexOf(f.selected.b);
      layout.shapes = [{type: "rect", xref: "x", yref: "y", x0: ix - 0.48, x1: ix + 0.48,
        y0: iy - 0.48, y1: iy + 0.48, line: {color: "#24384b", width: 3}, fillcolor: "rgba(0,0,0,0)"}];
    } else if (f.kind === "bars") {
      data = [
        ["Fatigue coverage", "margin"],
        ["Peak coverage", "peakRatio"],
      ].map(([name, k], i) => ({
        type: "bar",
        name,
        x: f.all.map((s) => String(s.c.Q)),
        y: f.all.map((s) =>
          coverageAt(s, k, f.frequency),
        ),
        marker: { color: colors[i], pattern: { shape: i ? "/" : "" } },
        hovertemplate: "Q %{x}<br>%{y:.4g}×<extra>" + name + "</extra>",
      }));
      layout.xaxis.type = "category";
      layout.yaxis.type = "linear";
      layout.yaxis.rangemode = "tozero";
      layout.shapes = [threshold()];
    } else {
      const bounds = VDCReport.limits(f.series, f.threshold),
        floor = bounds.ymin;
      data = [];
      const markers = [];
      f.series.forEach((s, i) => {
        data.push({
          type: "scatter",
          mode: "lines",
          name: esc(s.name.length > 55 ? s.name.slice(0, 54) + "…" : s.name),
          x: s.data.map((p) => p[0]),
          y: s.data.map((p) => (p[1] > 0 ? p[1] : null)),
          line: { color: s.color || colors[i % 4], width: 2, dash: s.dash || dash[i % 4] },
          fill: s.fill || "none",
          fillcolor: "rgba(87,126,160,0.15)",
          opacity: f.scopeModes?.length ? 0.4 : 1,
          connectgaps: false,
          hovertemplate:
            "%{x:.6g} Hz<br>%{y:.5g}<extra>" + esc(s.name) + "</extra>",
        });
        const marks = s.data.filter(
          (p) => p[1] === 0 || f.scopeModes?.includes(p[0]),
        );
        if (marks.length)
          markers.push({
            type: "scatter",
            mode: "markers",
            name: s.name + " assessed / zero",
            showlegend: false,
            x: marks.map((p) => p[0]),
            y: marks.map((p) =>
              p[1] === 0 && view.y?.type !== "linear" ? floor : p[1],
            ),
            customdata: marks.map((p) => p[1]),
            marker: {
              color: s.color || colors[i % 4],
              size: 7,
              symbol: marks.map((p) =>
                p[1] === 0 ? "triangle-down" : "circle",
              ),
            },
            hovertemplate:
              "%{x:.6g} Hz<br>Actual value %{customdata:.5g}<extra></extra>",
          });
      });
      data.push(...markers);
      if (f.threshold) layout.shapes = [threshold()];
      if (f.governing) {
        const [x, y] = f.governing;
        data.push({
          type: "scatter",
          mode: "markers",
          showlegend: false,
          x: [x],
          y: [y || floor],
          marker: {
            size: 11,
            color: "#fff",
            line: { color: "#a6482d", width: 2 },
          },
          customdata: [y],
          hovertemplate:
            "Governing: %{x:.6g} Hz<br>%{customdata:.5g}×<extra></extra>",
        });
      }
    }
    for (const a of ["x", "y"])
      if (view[a]) {
        layout[a + "axis"].type = view[a].type;
        layout[a + "axis"].range = view[a].range;
        layout[a + "axis"].autorange = false;
      }
    if (!f.kind) {
      for (const a of ["x", "y"]) {
        const ax = layout[a + "axis"];
        if (ax.type === "log") {
          if (!view[a]) {
            const values = data
              .flatMap((s) => s[a] || [])
              .filter((v) => Number.isFinite(v) && v > 0);
            if (a === "y" && f.threshold) values.push(f.threshold);
            const low = Math.log10(Math.min(...values)),
              high = Math.log10(Math.max(...values));
            const pad =
              high > low ? (high - low) * (a === "x" ? 0.015 : 0.05) : 0.5;
            ax.range = [low - pad, high + pad];
            ax.autorange = false;
          }
          Object.assign(ax, logTicks(ax.range));
        }
      }
    }
    for (const a of ["x", "y"]) {
      const axis = layout[a + "axis"];
      axis.minor = minorGrid(axis);
      if (axis.type === "category") axis.showgrid = false;
    }
    return {
      data,
      layout,
      config: {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        toImageButtonOptions: { format: "png", scale: 2 },
        modeBarButtonsToRemove: ["toImage", "select2d", "lasso2d"],
      },
    };
  }
  function minorGrid(axis) {
    const numeric = axis.type === "log" || axis.type === "linear";
    const minor = {
      showgrid: numeric,
      gridcolor: "#edf0f2",
      gridwidth: 0.7,
      ticks: "",
      tickmode: "auto",
    };
    if (axis.type === "log" && axis.range) {
      const decades = axis.range[1] - axis.range[0];
      // Thin out very wide log ranges; use automatic subdivisions at close zoom.
      if (decades >= 0.3) {
        minor.tickmode = "linear";
        minor.dtick = decades <= 3 ? "D1" : decades <= 8 ? "D2" : 1;
      }
    }
    return minor;
  }
  function logTicks(range) {
    const lo = 10 ** range[0],
      hi = 10 ** range[1];
    let vals = [];
    for (let k = Math.floor(range[0]); k <= Math.ceil(range[1]); k++)
      for (const a of [1, 2, 5]) {
        const v = a * 10 ** k;
        if (v >= lo * 0.999999 && v <= hi * 1.000001) vals.push(v);
      }
    if (vals.length < 2) vals = [lo, Math.sqrt(lo * hi), hi];
    if (range[1] - range[0] > 3) {
      vals = [];
      const step = Math.ceil((range[1] - range[0]) / 6);
      for (let k = Math.ceil(range[0] / step) * step; k <= range[1]; k += step)
        vals.push(10 ** k);
    } else {
      const step = Math.max(1, Math.ceil(vals.length / 7));
      vals = vals.filter((_, i) => i % step === 0);
      if (lo <= 1 && hi >= 1 && !vals.includes(1)) vals.push(1);
      vals.sort((a, b) => a - b);
    }
    return {
      tickmode: "array",
      tickvals: vals,
      ticktext: vals.map((v) => n(v, 3)),
    };
  }
  function updateTicks(el) {
    const change = {};
    for (const a of ["x", "y"]) {
      const axis = el._fullLayout?.[a + "axis"];
      if (axis) {
        const minor = minorGrid(axis);
        if (JSON.stringify(el.layout[a + "axis"].minor) !== JSON.stringify(minor))
          change[a + "axis.minor"] = minor;
      }
      if (axis?.type === "log") {
        const ticks = logTicks(axis.range);
        if (
          JSON.stringify(el.layout[a + "axis"].tickvals) !==
          JSON.stringify(ticks.tickvals)
        )
          for (const [k, v] of Object.entries(ticks))
            change[a + "axis." + k] = v;
      } else if (
        axis?.type === "linear" &&
        el.layout[a + "axis"].tickmode === "array"
      )
        change[a + "axis.tickmode"] = "auto";
    }
    if (Object.keys(change).length) Plotly.relayout(el, change);
  }
  function threshold() {
    return {
      type: "line",
      xref: "paper",
      x0: 0,
      x1: 1,
      yref: "y",
      y0: 1,
      y1: 1,
      line: { color: "#9e4829", dash: "dash", width: 1.5 },
    };
  }
  function viewOf(el) {
    const l = el._fullLayout;
    const v = {};
    for (const a of ["x", "y"])
      if (l?.[a + "axis"]?.range)
        v[a] = { type: l[a + "axis"].type, range: [...l[a + "axis"].range] };
    if (el.data?.[0]?.type === "heatmap")
      v.color = [el.data[0].zmin, el.data[0].zmax];
    return v;
  }
  async function image(f, view, format = "png", width = 1000, height = 600) {
    const div = document.createElement("div");
    div.style.cssText =
      "position:fixed;left:-10000px;width:" +
      width +
      "px;height:" +
      height +
      "px";
    document.body.append(div);
    try {
      const g = figure(f, view, true);
      g.layout.width = width;
      g.layout.height = height;
      g.layout.title = {
        text: esc(f.title),
        font: { size: 28 },
        x: 0.02,
        y: 0.98,
        yanchor: "top",
      };
      g.layout.margin.t = 150;
      g.layout.legend.y = 1.02;
      g.layout.legend.yanchor = "bottom";
      if (f.meta) {
        const zeroNote=g.layout.yaxis.type==='log' && f.series?.some(s=>s.data.some(p=>p[1]===0))?' | ▼ = 0 at log floor':'';
        g.layout.margin.b = 150;
        g.layout.annotations = [
          {
            xref: "paper",
            yref: "paper",
            x: 0,
            y: -0.38,
            xanchor: "left",
            yanchor: "top",
            showarrow: false,
            font: { size: 14, color: "#526572" },
            text: VDCReport.wrap(f.meta+zeroNote, 100).slice(0, 2).map(esc).join("<br>"),
          },
        ];
      }
      await Plotly.newPlot(div, g.data, g.layout, g.config);
      return await Plotly.toImage(div, {
        format,
        width,
        height,
        scale: format === "png" ? 2 : 1,
      });
    } finally {
      Plotly.purge(div);
      div.remove();
    }
  }
  return { order, specs, figure, viewOf, image, updateTicks, displayContext, displayNote };
})();
