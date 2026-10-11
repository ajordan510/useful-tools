'use strict';
let publishedComparison=null;
function runPublished(){
 publishedComparison=window.PublishedCase.compare(E);
 const p=publishedComparison,m=p.metrics;
 $('publishedOutput').hidden=false;
 $('publishedMetrics').innerHTML=[['Baseline RMS difference',m.rmse],['Diagnostic replay RMS',p.replayMetrics.rmse],['Replay largest difference',p.replayMetrics.maxAbsolute]].map(([label,v])=>`<div class="kpi"><span>${label}</span><strong>${v.toFixed(2)} <i>dB</i></strong><small>Compared with published curve · ${m.bands} bands</small></div>`).join('');
 chart('publishedSpectrum',[{name:'Workbench DSM-II',points:p.rows.map(r=>[r.frequency,r.predicted])},{name:'Smith published prediction',points:p.rows.map(r=>[r.frequency,r.published]),color:colors[1],markers:true},{name:'Diagnostic replay (includes source angle error)',points:p.rows.map(r=>[r.frequency,r.replay]),color:'#7850a0'}],{xlabel:'Frequency · Hz (log scale)',ylabel:'Band SPL · dB re 20 µPa',logx:true});
 chart('publishedResidual',[{name:'Workbench minus published',points:p.rows.map(r=>[r.frequency,r.residual])},{name:'Diagnostic replay minus published',points:p.rows.map(r=>[r.frequency,r.replayResidual]),color:'#7850a0'},{name:'Zero difference',points:[[100,0],[10000,0]],color:'#697d88'}],{xlabel:'Frequency · Hz (log scale)',ylabel:'Difference · dB',logx:true,ymin:-5,ymax:Math.ceil(m.maxAbsolute/5)*5+5});
 $('publishedStages').innerHTML=p.stages.map((s,i)=>`<tr><td>${i+1}. ${esc(s.name)}</td><td>${s.metrics.rmse.toFixed(3)}</td><td>${s.metrics.bias.toFixed(3)}</td><td>${(i?s.levels[0]-p.stages[i-1].levels[0]:0).toFixed(3)}</td></tr>`).join('');
 const a=window.PublishedCase.angles(.8,p.result.c.receivers[0]),first=p.rows[0];
 $('publishedAngle').textContent=`Example source 0.8 m downstream: the physical angle is ${a.physical.toFixed(2)}°, while Appendix D returns ${a.appendix.toFixed(2)}°. That triggers an extra ${(first.replay-first.correctedWilby).toFixed(2)} dB at 100 Hz. Using physical angles with Smith’s fits gives ${first.correctedWilby.toFixed(2)} dB at 100 Hz; the diagnostic replay gives ${first.replay.toFixed(2)} dB and the plotted source reads ${first.published.toFixed(2)} dB.`;
 $('publishedDomain').textContent=`Positive differences mean the workbench is higher. ${p.rows.filter(r=>r.directivityClamped).length} bands exceed the legacy directivity table (Sr > 0.4) and use its boundary value. Restricting the comparison to ${p.unclampedMetrics.bands} in-range centers still gives an RMS difference of ${p.unclampedMetrics.rmse.toFixed(2)} dB.`;
 $('publishedRows').innerHTML=p.rows.map(r=>`<tr><td>${Number(r.frequency.toPrecision(6))}</td><td>${r.predicted.toFixed(2)}</td><td>${r.published.toFixed(2)}</td><td>${r.replay.toFixed(2)}</td><td>${r.replayResidual.toFixed(2)}</td><td>${r.correctedWilby.toFixed(2)}</td></tr>`).join('');
 $('publishedCSV').disabled=$('publishedReport').disabled=false;
 return p;
}
$('runPublished').onclick=runPublished;
$('loadPublished').onclick=()=>{
 const p=runPublished();fill(p.result.c);$('mapRange').value=8;
 pinned={name:'Smith (2013), Fig. 53 · published prediction',receiver:'45° receiver',case:structuredClone(p.result.c),
  points:p.rows.map(r=>[r.frequency,r.published]),source:p.source.source,
  status:p.status,provenance:p.source};
 stale();document.querySelector('[data-tab="calculator"]').click();run();
};
$('publishedCSV').onclick=()=>{
 if(!publishedComparison)return;
 const p=publishedComparison;
 const rows=['# '+p.status,'# Source: '+p.source.source+'; '+p.source.figure,
  '# Published curve: '+p.source.curve,'# Estimated graph-reading precision: +/-0.5 dB (not model uncertainty)',
  '# Case JSON: '+JSON.stringify(p.result.c),
  '# Diagnostic replay uses Smith fits and the erroneous Appendix D angle; NOT a physical prediction mode. Fixed 240 slices / 0.1-5 core lengths; no fitted offsets.',
  '# Cumulative stages: '+JSON.stringify(p.stages.map(({name,options,metrics})=>({name,options,metrics}))),
  'frequency_Hz,workbench_SPL_dB,published_SPL_dB,workbench_minus_published_dB,directivity_boundary_held,diagnostic_replay_SPL_dB,replay_minus_published_dB,smith_fits_physical_angles_SPL_dB'];
 p.rows.forEach(r=>rows.push([r.frequency,r.predicted,r.published,r.residual,r.directivityClamped,r.replay,r.replayResidual,r.correctedWilby].join(',')));
 download(rows.join('\r\n'),'smith2013-spectrum-comparison.csv','text/csv');
};
$('publishedReport').onclick=()=>{
 if(!publishedComparison)return;
 const copy=$('publishedPanel').cloneNode(true);copy.querySelectorAll('button,.actions').forEach(e=>e.remove());copy.querySelectorAll('details').forEach(e=>e.open=true);
 const p=publishedComparison;
 download(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Published DSM-II comparison · Smith 2013</title><style>body{max-width:1000px;margin:30px auto;padding:0 20px;font:14px/1.65 Segoe UI,Arial;color:#1b303d}svg{width:100%;height:auto}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:7px;text-align:right;border-bottom:1px solid #d9e2e7}.tablewrap{overflow:auto}.notice{background:#fff8eb;padding:14px}.kpis{display:flex;gap:30px}.kpi span,.kpi strong,.kpi small{display:block}.kpi strong{font-size:25px}.legend{margin-top:20px}.legend span{margin-right:25px}.legend span:first-child{color:#007d83}.comparison{color:#ab551e}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}summary{font-weight:bold}a{color:#006b73}</style>${copy.outerHTML}<h2>Reproducible inputs</h2><pre>${esc(JSON.stringify(p.result.c,null,2))}</pre><h2>Digitization provenance</h2><pre>${esc(JSON.stringify(p.source,null,2))}</pre></html>`,'smith2013-spectrum-comparison.html','text/html');
};
