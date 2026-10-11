'use strict';
let publishedComparison=null;
function runPublished(){
 publishedComparison=window.PublishedCase.compare(E);
 const p=publishedComparison,m=p.metrics;
 $('publishedOutput').hidden=false;
 $('publishedMetrics').innerHTML=[['Mean difference',m.bias],['RMS difference',m.rmse],['Largest difference',m.maxAbsolute]].map(([label,v])=>`<div class="kpi"><span>${label}</span><strong>${v.toFixed(2)} <i>dB</i></strong><small>Workbench minus published · ${m.bands} bands</small></div>`).join('');
 chart('publishedSpectrum',[{name:'Workbench DSM-II',points:p.rows.map(r=>[r.frequency,r.predicted])},{name:'Smith published prediction',points:p.rows.map(r=>[r.frequency,r.published]),color:colors[1]}],{xlabel:'Frequency · Hz (log scale)',ylabel:'Band SPL · dB re 20 µPa',logx:true});
 chart('publishedResidual',[{name:'Workbench minus published',points:p.rows.map(r=>[r.frequency,r.residual])},{name:'Zero difference',points:[[100,0],[10000,0]],color:'#697d88'}],{xlabel:'Frequency · Hz (log scale)',ylabel:'Difference · dB',logx:true,ymin:-5,ymax:Math.ceil(m.maxAbsolute/5)*5+5});
 $('publishedDomain').textContent=`Positive differences mean the workbench is higher. ${p.rows.filter(r=>r.directivityClamped).length} bands exceed the legacy directivity table (Sr > 0.4) and use its boundary value. Restricting the comparison to ${p.unclampedMetrics.bands} in-range centers still gives an RMS difference of ${p.unclampedMetrics.rmse.toFixed(2)} dB.`;
 $('publishedRows').innerHTML=p.rows.map(r=>`<tr><td>${Number(r.frequency.toPrecision(6))}</td><td>${r.predicted.toFixed(2)}</td><td>${r.published.toFixed(2)}</td><td>${r.residual.toFixed(2)}</td><td>${r.directivityClamped?'Boundary held':'In table range'}</td></tr>`).join('');
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
  'frequency_Hz,workbench_SPL_dB,published_SPL_dB,workbench_minus_published_dB,directivity_boundary_held'];
 p.rows.forEach(r=>rows.push([r.frequency,r.predicted,r.published,r.residual,r.directivityClamped].join(',')));
 download(rows.join('\r\n'),'smith2013-spectrum-comparison.csv','text/csv');
};
$('publishedReport').onclick=()=>{
 if(!publishedComparison)return;
 const copy=$('publishedPanel').cloneNode(true);copy.querySelectorAll('button,.actions').forEach(e=>e.remove());copy.querySelectorAll('details').forEach(e=>e.open=true);
 const p=publishedComparison;
 download(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Published DSM-II comparison · Smith 2013</title><style>body{max-width:1000px;margin:30px auto;padding:0 20px;font:14px/1.65 Segoe UI,Arial;color:#1b303d}svg{width:100%;height:auto}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:7px;text-align:right;border-bottom:1px solid #d9e2e7}.tablewrap{overflow:auto}.notice{background:#fff8eb;padding:14px}.kpis{display:flex;gap:30px}.kpi span,.kpi strong,.kpi small{display:block}.kpi strong{font-size:25px}.legend{margin-top:20px}.legend span{margin-right:25px}.legend span:first-child{color:#007d83}.comparison{color:#ab551e}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}summary{font-weight:bold}a{color:#006b73}</style>${copy.outerHTML}<h2>Reproducible inputs</h2><pre>${esc(JSON.stringify(p.result.c,null,2))}</pre><h2>Digitization provenance</h2><pre>${esc(JSON.stringify(p.source,null,2))}</pre></html>`,'smith2013-spectrum-comparison.html','text/html');
};
