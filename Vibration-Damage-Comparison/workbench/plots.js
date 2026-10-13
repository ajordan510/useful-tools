const WBPlots = (() => {
  const colors = ["#17689b", "#b45a29", "#747487", "#34836e"],
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
  function specs(run, all) {
    const fs = VDCReport.figures(run.c, run.r, { crosscheck: true });
    fs.find(f=>f.id==='fatigueComparePlot').definition="Coverage on the right = sine damage / required random damage. Common Q and b; each exposure uses its recorded duration.";
    for (const f of fs)
      f.meta = `${run.c.caseName.slice(0, 70)} | b ${run.c.b}, Q ${run.c.Q} | ${run.c.dwellMode === "assumed" ? "Independent assumed resonances" : "Documented exposure"}`;
    const bs = [...new Set(all.map((s) => s.c.b))],
      qs = [...new Set(all.map((s) => s.c.Q))];
    fs.push({
      id: "heatmap",
      title: "Minimum fatigue coverage by b and Q",
      kind: "heatmap",
      bs,
      qs,
      all,
      definition:
        "Cells show minimum assessed coverage. Select a cell to inspect that scenario. A value below 1 identifies a modeled gap. Color defaults to 0–2 and saturates above 2; labels retain actual values.",
    });
    fs.push({
      id: "bars",
      title: `Minimum coverage at b = ${run.c.b}`,
      kind: "bars",
      all: all.filter((s) => s.c.b === run.c.b),
      definition:
        "Grouped columns compare minimum fatigue and peak coverage by Q. Their governing frequencies may differ. Peak response is independent of b.",
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
        linecolor: "#657784",
        mirror: true,
        gridcolor: "#e3e8eb",
        ticks: "outside",
        exponentformat: "e",
        minexponent: 3,
        automargin: true,
      },
      yaxis: {
        title: { text: f.label || "Minimum coverage", standoff: 15 },
        type: "log",
        showline: true,
        linecolor: "#657784",
        mirror: true,
        gridcolor: "#e3e8eb",
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
          (Q) => f.all.find((s) => s.c.b === b && s.c.Q === Q).r.worst.margin,
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
            "b %{y}, Q %{x}<br>Minimum fatigue coverage %{z:.4g}×<extra></extra>",
          colorscale: [
            [0, "#f6e4d2"],
            [0.5, "#edf1f4"],
            [1, "#4084a8"],
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
    } else if (f.kind === "bars") {
      data = [
        ["Fatigue coverage", "margin"],
        ["Peak coverage", "peakRatio"],
      ].map(([name, k], i) => ({
        type: "bar",
        name,
        x: f.all.map((s) => String(s.c.Q)),
        y: f.all.map((s) =>
          k === "margin" ? s.r.worst.margin : s.r.peakWorst.peakRatio,
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
      f.series.forEach((s, i) => {
        data.push({
          type: "scatter",
          mode: "lines",
          name: esc(s.name.length > 55 ? s.name.slice(0, 54) + "…" : s.name),
          x: s.data.map((p) => p[0]),
          y: s.data.map((p) => (p[1] > 0 ? p[1] : null)),
          line: { color: colors[i % 4], width: 2, dash: dash[i % 4] },
          opacity: f.scopeModes?.length ? 0.4 : 1,
          connectgaps: false,
          hovertemplate:
            "%{x:.6g} Hz<br>%{y:.5g}<extra>" + esc(s.name) + "</extra>",
        });
        const marks = s.data.filter(
          (p) => p[1] === 0 || f.scopeModes?.includes(p[0]),
        );
        if (marks.length)
          data.push({
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
              color: colors[i % 4],
              size: 7,
              symbol: marks.map((p) =>
                p[1] === 0 ? "triangle-down" : "circle",
              ),
            },
            hovertemplate:
              "%{x:.6g} Hz<br>Actual value %{customdata:.5g}<extra></extra>",
          });
      });
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
  return { order, specs, figure, viewOf, image, updateTicks };
})();
