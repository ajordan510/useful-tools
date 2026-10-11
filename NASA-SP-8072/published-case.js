/* Published spectrum comparison. The fixture is independent of engine output. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const data=node?require('./reference/smith2013-spectrum.json'):root.PUBLISHED_SPECTRUM;
function caseInputs(){return {
 schema:'rocket-acoustics-1',name:'Smith 2013 · free-jet comparison',
 notes:'Reconstruction of Smith (2013), Section 3.4, Tables 8–9 and Figure 53. Laboratory air jet, not rocket validation. F=794.3 N, U=406.6 m/s, D=0.073 m, M=1.15; 14 W acoustic power from Table 9 encoded as equivalent efficiency, not a fitted rocket efficiency. Receiver x=+3.5 m, y=3.5 m (paper Z=-3.5 m); 45 degrees from downstream at the nozzle. Ambient sound speed derived from 311 K using gamma=1.4, R=287. Workbench uses normalized historical curves, Eldred directivity, 240 slices over 0.1–5 core lengths. Smith uses fitted curves and Wilby third directivity; saved settings and the external source-power dataset referenced by the appended code are unavailable; code-to-figure provenance is unresolved. Comparison has unresolved differences; no verification pass claimed. Source: https://auetd.auburn.edu/handle/10415/3954',
 thrust:794.3,velocity:406.6,diameter:.073,mach:1.15,engines:1,
 eta:200*14/(794.3*406.6),model:'dsm2',core:'eldred',normalize:true,
 cluster:'merged',directivity:'legacy',propagation:'none',reflection:0,margin:0,
 fmin:100,fmax:10000,slices:240,deflection:0,bend:0,terminate:false,
 c0:Math.sqrt(1.4*287*311),receivers:[{name:'45° · Figure 53',x:3.5,y:3.5}]
};}
function compare(E){
 const result=E.predict(caseInputs()),r=result.receivers[0];
 const rows=data.samples.map(p=>{
  const i=result.bands.findIndex(b=>Math.abs(Math.log(b.f/p.frequency))<1e-10);
  if(i<0)throw Error('Published comparison requires matching band centers.');
  return {frequency:p.frequency,published:p.level,predicted:r.levels[i],residual:r.levels[i]-p.level,
   directivityClamped:p.frequency*result.D/result.c.velocity>.4};
 });
 const metrics=values=>({bands:values.length,bias:values.reduce((s,p)=>s+p.residual,0)/values.length,
  rmse:Math.sqrt(values.reduce((s,p)=>s+p.residual**2,0)/values.length),maxAbsolute:Math.max(...values.map(p=>Math.abs(p.residual)))});
 return {result,rows,metrics:metrics(rows),unclampedMetrics:metrics(rows.filter(p=>!p.directivityClamped)),
  status:'Unresolved comparison — not a verification pass',source:data};
}
const api={data,caseInputs,compare};if(node)module.exports=api;else root.PublishedCase=api;
})(typeof window!=='undefined'?window:globalThis);
