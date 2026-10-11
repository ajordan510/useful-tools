/* Published spectrum comparison. The fixture is independent of engine output. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const data=node?require('./reference/smith2013-spectrum.json'):root.PUBLISHED_SPECTRUM;
function caseInputs(){return {
 schema:'rocket-acoustics-1',name:'Smith 2013 · free-jet comparison',
 notes:'Reconstruction of Smith (2013), Section 3.4, Tables 8–9 and Figure 53. Laboratory air jet, not rocket validation. F=794.3 N, U=406.6 m/s, D=0.073 m, M=1.15; 14 W acoustic power from Table 9 encoded as equivalent efficiency, not a fitted rocket efficiency. Receiver x=+3.5 m, y=3.5 m (paper Z=-3.5 m); 45 degrees from downstream at the nozzle. Ambient sound speed derived from 311 K using gamma=1.4, R=287. Workbench uses normalized historical curves, Eldred directivity, 240 slices over 0.1–5 core lengths. Smith uses fitted curves and Wilby third directivity. The audit traces the baseline 13.11 dB RMS discrepancy to model choices and a quadrant error in Appendix D. A separate diagnostic replay reproduces the graph to 0.18 dB RMS, including that source error; the calculator retains physical angles. Saved run settings are unavailable; this is not experimental validation. Source: https://auetd.auburn.edu/handle/10415/3954',
 thrust:794.3,velocity:406.6,diameter:.073,mach:1.15,engines:1,
 eta:200*14/(794.3*406.6),model:'dsm2',core:'eldred',normalize:true,
 cluster:'merged',directivity:'legacy',propagation:'none',reflection:0,margin:0,
 fmin:100,fmax:10000,slices:240,deflection:0,bend:0,terminate:false,
 c0:Math.sqrt(1.4*287*311),receivers:[{name:'45° · Figure 53',x:3.5,y:3.5}]
};}
// Smith Appendix D, printed pp. 279–282: analytical SP-8072 fits and Wilby III.
// These are forensic helpers for the fixed air-jet case, not calculator options.
const log=Math.log10,pow=v=>10**(v/10);
function smithAxial(q){return q<=1.1?13.8*log(q)-5:q<=2.6?-75*log(q/1.6)**3-65*log(q/1.6)**2-3:-53*log(q)+15.5;}
function smithSpectrum(s){return s<=.8?10*log(s)-7:s<=3.5?-12*log(s/1.5)**3-20*log(s/1.5)**2-6.8:-23*log(s)+2.5;}
function wilby3(sr,theta){
 const delta=theta<170?0:sr<.01?-28.9339:sr>.04345?0:61.7691+45.3515*log(sr);
 return .088828+7.411814*log(sr)+1.607279*log(sr)**2+delta;
}
function angles(s,p){
 const dx=p.x-s,dy=p.y;
 // Appendix D p. 262, straight jet/ramp angle -90 degrees. atan(y/(s-x))
 // loses the quadrant, giving physical angle + 180 for sources before the mic.
 return {physical:Math.atan2(dy,dx)*180/Math.PI,appendix:180-Math.atan(dy/(s-p.x))*180/Math.PI};
}
function reconstruct(E,{appendixAngle=false,raw=false,fits=false,centerBands=false,slices=240}={}){
 const c=caseInputs(),pre=E.prepare({...c,normalize:!raw,slices}),p=c.receivers[0];
 return pre.bands.map((b,j)=>10*log(pre.sources.reduce((sum,src)=>{
  const a=angles(src.s,p),r=Math.hypot(p.x-src.s,p.y),scale=src.s/c.velocity;
  // Both jet and ambient are 311 K: ae/ao = 1. Retain 14 W from Table 9.
  const spectral=centerBands?pow(smithSpectrum(b.f*scale))*scale*b.f*(2**(1/6)-2**(-1/6)):
   E.integrateLog(f=>pow(smithSpectrum(f*scale))*scale,b.lo,b.hi,16);
  const w=fits?pre.W*pow(smithAxial(src.s/pre.core))*src.width/pre.core*spectral:src.bands[j];
  return sum+w/1e-12/(4*Math.PI*r*r)*pow(wilby3(b.f*pre.D/c.velocity,appendixAngle?a.appendix:a.physical));
 },0)));
}
function metrics(values){return {bands:values.length,bias:values.reduce((s,p)=>s+p.residual,0)/values.length,
 rmse:Math.sqrt(values.reduce((s,p)=>s+p.residual**2,0)/values.length),maxAbsolute:Math.max(...values.map(p=>Math.abs(p.residual)))};}
function compare(E){
 const result=E.predict(caseInputs()),r=result.receivers[0];
 const rows=data.samples.map(p=>{
  const i=result.bands.findIndex(b=>Math.abs(Math.log(b.f/p.frequency))<1e-10);
  if(i<0)throw Error('Published comparison requires matching band centers.');
  return {frequency:p.frequency,published:p.level,predicted:r.levels[i],residual:r.levels[i]-p.level,
   directivityClamped:p.frequency*result.D/result.c.velocity>.4};
 });
 const definitions=[
  ['Workbench baseline',null],
  ['Use Wilby III; keep physical angles',{}],
  ['Replay Appendix D angle error',{appendixAngle:true}],
  ['Disable curve normalization',{appendixAngle:true,raw:true}],
  ['Use Smith axial and spectral fits',{appendixAngle:true,raw:true,fits:true}],
  ['Use center PSD × base-2 bandwidth',{appendixAngle:true,raw:true,fits:true,centerBands:true}]
 ];
 const stages=definitions.map(([name,options])=>{
  const levels=options?reconstruct(E,options):r.levels;
  return {name,options,levels,metrics:metrics(levels.map((v,i)=>({residual:v-rows[i].published})))};
 });
 const replay=stages.at(-1),corrected=reconstruct(E,{raw:true,fits:true,centerBands:true});
 rows.forEach((row,i)=>Object.assign(row,{replay:replay.levels[i],replayResidual:replay.levels[i]-row.published,correctedWilby:corrected[i]}));
 return {result,rows,metrics:metrics(rows),unclampedMetrics:metrics(rows.filter(p=>!p.directivityClamped)),
  stages,replayMetrics:replay.metrics,correctedMetrics:metrics(corrected.map((v,i)=>({residual:v-rows[i].published}))),
  status:'Discrepancy traced — diagnostic reconstruction, not a verification pass',source:data};
}
const api={data,caseInputs,compare,reconstruct,smithAxial,smithSpectrum,wilby3,angles};if(node)module.exports=api;else root.PublishedCase=api;
})(typeof window!=='undefined'?window:globalThis);
