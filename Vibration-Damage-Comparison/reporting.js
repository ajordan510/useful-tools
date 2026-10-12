/* Report figures: calculated VDC data, never resampled across scenarios.
 * Vector text, redundant line styles, explicit assessment scope and input snapshot.
 * Shared by the screen, SVG/PNG downloads, HTML report and PowerPoint exporter. */
const VDCReport = (() => {
  const xml = (v) => String(v).replace(/[&<>"']/g, (x) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[x]);
  const num = (v, p = 4) => !Number.isFinite(v) ? "—" : v === 0 ? "0" : (Math.abs(v)>=1e4 || Math.abs(v)<1e-3 ? v.toExponential(p-1).replace(/\.?0+e/,"e") : Number(v.toPrecision(p)).toString());
  const slug = (v) => String(v).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 75) || "case";
  function wrap(value, n) {
    const words = String(value).split(/\s+/), lines = []; let line = "";
    for (let word of words) {
      while (word.length > n) { if (line) { lines.push(line); line = ""; } lines.push(word.slice(0, n)); word = word.slice(n); }
      if ((line + " " + word).trim().length > n) { lines.push(line); line = ""; }
      line = (line + " " + word).trim();
    }
    if (line) lines.push(line); return lines;
  }
  function summary(c, r) {
    return {
      fatigue: `${r.worst.margin >= 1 ? "Modeled fatigue target met" : "Modeled fatigue coverage gap"}: ${num(r.worst.margin)}× at ${num(r.worst.fn, 6)} Hz`,
      peak: `${r.peakWorst.peakRatio >= 1 ? "Peak screen covered" : "Peak-screen gap"}: ${num(r.peakWorst.peakRatio)}× at ${num(r.peakWorst.fn, 6)} Hz (${peakLabel(c)})`,
      scope: c.scope === "bank" ? `Full bank, ${num(c.fmin)}–${num(c.fmax)} Hz` : `Listed modes only: ${c.modes.map((f) => num(f, 6)).join(", ")} Hz`,
      dwell: c.dwellMode === "assumed" ? `Independent assumed dwell: ${c.assumedDwell.hours ? c.assumedDwell.hours+" h cap" : "no time cap"}, ${c.assumedDwell.cycleCap ? c.assumedDwell.cycleCap+" cycle cap" : "no cycle cap"}, ${c.assumedDwell.repeats} repeat(s)` : `${c.dwell.length} documented dwell(s)`,
      gaps: r.gaps.length ? r.gaps.map((g) => `${num(g.from, 5)}${g.to !== g.from ? "–" + num(g.to, 5) : ""} Hz`).join(", ") : "None at assessed frequencies",
      noDwell: c.dwellMode === "assumed" ? r.assessed.filter((x) => !x.contributions.length).length : 0,
    };
  }
  function peakLabel(c) {
    return c.peakMode === "extreme" ? `Extreme ${num(c.peakProbability)}% per mode` : `Selected k = ${num(c.peakFactor)}`;
  }
  function peakCaption(c) {
    return c.peakMode === "extreme"
      ? `${c.peakProbability}% nominal non-exceedance per oscillator over ${num(c.T)} s; approximate Gaussian, nearly narrowband model. Not a joint probability across modes.`
      : `Selected k = ${num(c.peakFactor)}; this fixed factor is not a duration-based confidence level.`;
  }
  function peakBasis(c,r) {
    if(c.peakMode === "extreme") {
      const factors=r.rows.map(x=>x.effectivePeakFactor);
      return `${peakCaption(c)} Irvine Rev H equation (4), with N = ν₀T from each response spectrum. `+
        `Across the plotted bank, k = ${num(Math.min(...factors))}–${num(Math.max(...factors))}. `+
        `At the inspected ${num(r.inspect.fn)} Hz oscillator: ν₀ = ${num(r.inspect.nu0)} Hz, N = ${num(r.inspect.peakCycles)}, k = ${num(r.inspect.effectivePeakFactor)}, RMS = ${num(r.inspect.sigma*1000)} mm, random extreme = ${num(r.inspect.peakRandom*1000)} mm. `+
        `At the peak-governing ${num(r.peakWorst.fn)} Hz oscillator, k = ${num(r.peakWorst.effectivePeakFactor)}. `+
        `Total duration combines ${c.randomRepeats} exposure(s); startup transients are excluded. The tool requires N ≥ 100 as a practical long-exposure guard. Review bandwidth and measured peak behavior before relying on the nominal probability.`;
    }
    const n=r.inspect.nu0*c.T;
    const estimate=n>1?Math.sqrt(2*Math.log(n)):null;
    return `Selected k = ${num(c.peakFactor)}. At the inspected ${num(r.inspect.fn)} Hz oscillator, RMS = ${num(r.inspect.sigma*1000)} mm and the selected random peak = ${num(r.inspect.peakRandom*1000)} mm. `+
      `Total random exposure = ${num(c.T)} s (${c.randomRepeats} exposure(s)); response ν₀ = ${num(r.inspect.nu0)} Hz. `+
      (estimate!==null?`The leading narrowband duration estimate √[2 ln(ν₀T)] gives k ≈ ${num(estimate)}. It is an indicative extreme level, not a non-exceedance bound, and does not change the selected-k result.`:"Too few response cycles for the leading narrowband duration estimate.")+
      (n<100?" Short exposure: the many-cycle approximation is poorly supported.":"");
  }
  function specs(c, r) {
    return [
      ["Sine specification", c.sineName || "Not identified"], ["Random specification", c.randomName || "Not identified"],
      ["Scope", summary(c, r).scope], ["Dwell basis", summary(c, r).dwell],
      ["Sweep exposure", `${c.passes} traversals, ${c.sweepRate} ${c.sweepType === "oct" ? "oct/min" : "Hz/min"}`],
      ["Sine amplitude scale", `${c.sineScale}× (including dwell overrides)`],
      ["Random exposure", `${num(c.T / 60, 6)} min total, ${c.randomRepeats} exposure(s), ${c.psdDb} dB`],
      ["Random input", `${num(r.grms, 5)} gRMS, ${c.psd[0][0]}–${c.psd.at(-1)[0]} Hz`],
      ["Model", `Q = ${c.Q}, b = ${c.b}, ${c.method === "dirlik" ? "Dirlik" : "Narrowband"}`],
      ["Targets", `Damage factor ${c.damageFactor}; ${peakLabel(c)}`],
    ];
  }
  function figures(c, r, settings = {}) {
    const selected = c.method === "dirlik" ? "Dirlik" : "Narrowband";
    const scope = summary(c, r).scope;
    const meta = `${c.caseName} | Q ${c.Q}, b ${c.b} | ${c.dwellMode === "assumed" ? "Hypothetical resonances" : "Documented exposure"}`;
    const bank = (key) => r.rows.map((x) => [x.fn, x[key]]);
    const fig = (id, title, label, series, extra = {}) => ({id, title, label, series, meta, scope,
      xLabel: "Natural frequency, Hz", method: selected, version: r.version,
      scopeModes: c.scope === "modes" ? c.modes : null, generated: r.generated, ...extra});
    const ratio = [{name: `${selected} coverage`, data: bank("margin")}];
    if (settings.crosscheck) ratio.push({name: c.method === "dirlik" ? "Narrowband cross-check" : "Dirlik cross-check", dashed: true,
      data: r.rows.map((x) => [x.fn, x.heritage / (c.method === "dirlik" ? x.nb : x.dirlik) / c.damageFactor])});
    const sine = [];
    for (const s of c.sine) for (let j = 0; j <= 30; j++) {
      const f = s.f1 * (s.f2 / s.f1) ** (j / 30);
      sine.push([f, VDC.accel(f, s.unit, s.a1 * (s.a2 / s.a1) ** (j / 30)) * c.sineScale]);
    }
    const response = VDC.quadrature(c.psd[0][0], c.psd.at(-1)[0], c.inspectFn, c.Q, c.psd.map((x) => x[0])).map(([f]) =>
      [f, VDC.psdAt(f, c.psd) * c.psdScale * VDC.transfer(f, c.inspectFn, c.Q) ** 2 * 1e6]);
    const displacement = sine.map(([f,a])=>[f,2*a*9.80665/((2*Math.PI*f)**2)/0.0254]);
    return [
      fig("ratioPlot", "Fatigue coverage", "Fatigue coverage", ratio, {threshold: 1, gaps: r.gaps, governing: [r.worst.fn, r.worst.margin], limits: settings.coverageLimits, definition: `Coverage = R / F; R = sine damage / random damage; F = ${num(c.damageFactor)}. Target = 1.`}),
      fig("peakPlot", "Peak-response coverage", "Peak coverage", [{name: peakLabel(c), data: bank("peakRatio")}], {threshold: 1, governing: [r.peakWorst.fn, r.peakWorst.peakRatio], limits: settings.peakLimits, scope: `${scope} | ${peakLabel(c)}${c.peakMode === "extreme" ? `; T = ${num(c.T)} s` : ""}`, definition: `Peak coverage = sine peak / random peak. Target = 1.${c.peakMode === "extreme" ? ` Approximate extreme; T = ${num(c.T)} s.` : ""}`}),
      fig("sinePlot", "Sine input profile", "Acceleration, g peak", [{name: c.sineName || "Sine specification", data: sine}], {scopeModes: null, scope: "Input spectrum", xLabel: "Excitation frequency, Hz"}),
      fig("psdPlot", "Random input PSD", "Acceleration PSD, g²/Hz", [{name: c.randomName || "Random specification", data: c.psd.map(([f, p]) => [f, p * c.psdScale])}], {scopeModes: null, scope: `Input spectrum: ${num(r.grms)} gRMS, ${num(c.T / 60)} min`, xLabel: "Excitation frequency, Hz"}),
      fig("fatigueComparePlot", "Fatigue comparison", "Normalized damage index", [
        {name:"Sine damage",data:bank("heritage")},
        {name:`Required random damage (F = ${num(c.damageFactor)})`,data:r.rows.map(x=>[x.fn,x.random*c.damageFactor])},
      ], {xLimits:settings.coverageLimits, definition:"Coverage on the right = sine damage / required random damage. Same Q, b and duration basis."}),
      fig("peakResponsePlot", "Peak response and RMS VRS", "Relative displacement, mm", [
        {name:"Sine peak",data:r.rows.map(x=>[x.fn,x.peakSine*1000])},
        {name:c.peakMode === "extreme" ? `Random extreme (${num(c.peakProbability)}% per mode)` : `Random peak (${num(c.peakFactor)} × RMS)`,data:r.rows.map(x=>[x.fn,x.peakRandom*1000])},
        {name:"Random RMS (VRS; reference)",data:r.rows.map(x=>[x.fn,x.sigma*1000])},
      ], {xLimits:settings.peakLimits, scope: c.peakMode === "extreme" ? `${scope} | Approximate extreme; T = ${num(c.T)} s` : scope, definition:c.peakMode === "extreme" ? `Coverage uses sine / random extreme. Approximate ${num(c.peakProbability)}% per mode; T = ${num(c.T)} s. RMS = context.` : "Coverage uses the two peak curves. RMS is shown for context; it is not a peak."}),
      fig("sineDisplacementPlot", "Sine input displacement", "Displacement, inches DA", [{name:c.sineName||"Sine specification",data:displacement}],
        {scopeModes:null,scope:"Base input · double amplitude = peak-to-peak",xLabel:"Excitation frequency, Hz",definition:`DA = 2 × peak displacement. Includes sine scale ${num(c.sineScale)}; excludes dwell overrides.`}),
      fig("damagePlot", "Fatigue-damage spectra", "Normalized damage index", [
        {name: "Sine total", data: bank("heritage")}, {name: `Random ${selected}`, data: bank("random"), dashed: true},
        {name: "Dwell contribution", data: bank("dwell")}, {name: "Sweep contribution", data: bank("sweep")},
      ]),
      fig("responsePlot", `Response PSD at ${num(c.inspectFn)} Hz`, "Relative-displacement PSD, mm²/Hz", [{name: "Response PSD", data: response}], {scopeModes: null, scope: `Inspected oscillator: ${num(c.inspectFn)} Hz`, xLabel: "Excitation frequency, Hz"}),
    ];
  }
  function limits(series, threshold) {
    const pts = series.flatMap((s) => s.data).filter(([x,y]) => x > 0 && Number.isFinite(y));
    const positive = pts.filter((p) => p[1] > 0).map((p) => p[1]);
    let ymin = positive.length ? positive.reduce((a,b)=>Math.min(a,b),Infinity) : 0.1, ymax = positive.length ? positive.reduce((a,b)=>Math.max(a,b),0) : 1;
    if (threshold) { ymin = Math.min(ymin, threshold / (pts.some((p) => p[1] === 0) ? 10 : 1)); ymax = Math.max(ymax, threshold); }
    ymin = 10 ** Math.floor(Math.log10(ymin)); ymax = 10 ** Math.ceil(Math.log10(ymax)); if (ymax <= ymin) ymax = ymin * 10;
    let xmin = pts.reduce((a,p)=>Math.min(a,p[0]),Infinity), xmax = pts.reduce((a,p)=>Math.max(a,p[0]),0);
    if (xmin === xmax) { xmin /= 1.01; xmax *= 1.01; }
    return {xmin, xmax, ymin, ymax};
  }
  function commonLimits(runs, crosscheck) {
    const all = runs.map((x) => figures(x.c, x.r, {crosscheck}));
    return Object.fromEntries([["coverageLimits", 0], ["peakLimits", 1]].map(([key, i]) => [key, limits(all.flatMap((f) => f[i].series), 1)]));
  }
  function svg(f) {
    const W = 1000, H = 620, L = 150, R = 35, T = 180, B = 140;
    const bounds=f.limits || limits(f.series, f.threshold);
    const {xmin,xmax}=f.xLimits||bounds, {ymin,ymax}=bounds;
    const X = (v) => L + Math.log(v / xmin) / Math.log(xmax / xmin) * (W-L-R);
    const Y = (v) => H-B - Math.log(Math.max(ymin, v) / ymin) / Math.log(ymax / ymin) * (H-T-B);
    const text = (v,x,y,size=16,more="") => `<text x="${x}" y="${y}" font-size="${size}" ${more}>${xml(v)}</text>`;
    let out = `<rect width="1000" height="620" fill="white"/>${text(f.title, 28, 32, 28, 'font-weight="700"')}`;
    wrap(f.meta, 110).slice(0, 2).forEach((line,i) => out += text(line,28,57+i*19,15));
    out += text(f.scopeModes ? "Dots = assessed modes; faint curve = unassessed context" : f.scope,28,98,15);
    const colors = ["#087f83", "#172d40", "#7950a3", "#9a5425"], styles = ["", "8 5", "3 4", "10 3 2 3"];
    f.series.forEach((s,i) => {
      const xx=28+(i%2)*480, yy=123+Math.floor(i/2)*23;
      out += `<line x1="${xx}" y1="${yy-5}" x2="${xx+30}" y2="${yy-5}" stroke="${colors[i]}" stroke-width="3" stroke-dasharray="${styles[i]}"/>`;
      wrap(s.name,f.series.length===1?90:42).slice(0,2).forEach((line,j)=>out += text(line,xx+40,yy+j*21,19));
    });
    for (const g of f.gaps || []) out += `<rect x="${X(g.from)}" y="${T}" width="${Math.max(2,X(g.to)-X(g.from))}" height="${H-T-B}" fill="#a93636" opacity="0.08"/>`;
    let ticks=[];
    for(let k=Math.floor(Math.log10(xmin));k<=Math.ceil(Math.log10(xmax));k++) for(const a of [1,2,5]) if(a*10**k>=xmin && a*10**k<=xmax) ticks.push(a*10**k);
    if(ticks.length<3) ticks=[xmin,Math.sqrt(xmin*xmax),xmax];
    // Thin very broad frequency ranges so printed tick labels do not collide.
    if(ticks.length>9) ticks=ticks.filter((_,i)=>i%Math.ceil(ticks.length/9)===0);
    for(const x of ticks) out += `<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H-B}" stroke="#e1e8ed"/>`+text(num(x),X(x),H-B+29,23,'text-anchor="middle"');
    const step=Math.max(1,Math.ceil(Math.log10(ymax/ymin)/7));
    for(let k=Math.log10(ymin);k<=Math.log10(ymax)+1e-8;k+=step) {const y=10**k; out+=`<line x1="${L}" x2="${W-R}" y1="${Y(y)}" y2="${Y(y)}" stroke="#e1e8ed"/>`+text(num(y,2),L-12,Y(y)+7,23,'text-anchor="end"');}
    if(f.threshold) out+=`<line x1="${L}" x2="${W-R}" y1="${Y(f.threshold)}" y2="${Y(f.threshold)}" stroke="#a93636" stroke-dasharray="5 4"/>`+text("Target = 1",W-R-6,Y(f.threshold)-8,15,'text-anchor="end"');
    let hasZero=false;
    f.series.forEach((s,i)=>{
      let d="",pen=false;
      for(const [x,y] of s.data){if(!Number.isFinite(y)||y<=0){pen=false;if(y===0)hasZero=true;continue;}d+=(pen?"L":"M")+X(x).toFixed(2)+","+Y(y).toFixed(2)+" ";pen=true;}
      out+=`<path d="${d}" fill="none" stroke="${colors[i]}" stroke-width="2.7" stroke-dasharray="${styles[i]}" opacity="${f.scopeModes ? 0.4 : 1}"/>`;
      for(const [x,y] of s.data) if((y===0 && !f.scopeModes) || f.scopeModes?.includes(x)) out+=`<circle cx="${X(x)}" cy="${Y(y)}" r="${f.scopeModes?.includes(x)?4.5:2.5}" fill="${colors[i]}"/>`;
    });
    if(f.governing){const [x,y]=f.governing;out+=`<circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="white" stroke="#a93636" stroke-width="2.5"/>`;out+=text(`Minimum assessed: ${num(y)}× at ${num(x,6)} Hz`,28,H-30,16,'font-weight="600"');}
    else if(!f.definition) out+=text("Calculated from the recorded inputs",28,H-30,14);
    if(f.definition) out+=text(f.definition,28,H-52,14);
    if(hasZero) out+=text("Zero values shown at floor",W-R,H-B-10,14,'text-anchor="end"');
    out+=text(f.xLabel,(L+W-R)/2,H-B+59,22,'text-anchor="middle"');
    out+=`<text transform="translate(25,${(T+H-B)/2}) rotate(-90)" text-anchor="middle" font-size="22">${xml(f.label)}</text>`;
    out+=text("Logarithmic axes; values are ratios or physical quantities, not logarithms",28,H-9,11);
    out+=text(`Engine ${f.version} · ${f.generated}`,W-R,H-9,11,'text-anchor="end"');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620" role="img" aria-label="${xml(f.title+": "+f.meta)}" style="font-family:Arial,sans-serif;fill:#172d40"><title>${xml(f.title+" — "+f.meta)}</title>${out}</svg>`;
  }
  return {xml, num, slug, wrap, summary, peakLabel, peakCaption, peakBasis, specs, figures, svg, limits, commonLimits};
})();
if (typeof module !== "undefined" && module.exports) module.exports = VDCReport;
