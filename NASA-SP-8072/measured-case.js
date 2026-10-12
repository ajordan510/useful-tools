/* Fixed measured-data assessment. No parameters are fitted to these spectra. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const data=node?require('./reference/fukuda2011-measured.json'):root.MEASURED_SPECTRA;
function caseInputs(){return {
 schema:'rocket-acoustics-1',name:'JAXA NAL-735 · measured-data assessment',
 notes:'Conditional comparison to Fukuda et al. (2011), Figs 17-18, Noshiro December 2007 NAL-735 static firings. Motor/efficiency from Tsutsumi et al. EUCASS 2009 Table 1 and Section 3.1: F=260 kN, De=0.614 m, Me=2.92, eta=0.84% (Sutherland estimate, not fitted here). Ue≈2456 m/s inferred from published f=4000 Hz at Sr=1. Atmospheric c0=343 m/s is an explicit assumption. M1 horizontal radius 39 m at 80 degrees; M8 axial=10 m, lateral=13 m. Nozzle height=1.8 m; microphone heights=1.45/0.12 m folded into radial distances. Free-field baseline compared with both author ground-corrected curves; original ground-affected measurements retained separately. Primary assessment nominal 125-2000 Hz; higher bands diagnostic only. Our 0.5*F*Ue power convention differs from the paper\'s fully-expanded kinetic-power convention. No fit, no physical validation pass, no Smith replay. Source: https://www.jstage.jst.go.jp/article/tjsass/54/184/54_184_120/_article',
 thrust:260000,velocity:2456,diameter:.614,mach:2.92,engines:1,eta:.84,
 model:'dsm2',core:'eldred',normalize:true,cluster:'merged',directivity:'legacy',propagation:'none',reflection:0,margin:0,
 fmin:125,fmax:8000,slices:240,deflection:0,bend:0,terminate:false,c0:343,
 receivers:[{name:'M1 · 80° arc',x:39*Math.cos(80*Math.PI/180),y:Math.hypot(39*Math.sin(80*Math.PI/180),.35)},
 {name:'M8 · near field',x:10,y:Math.hypot(13,1.68)}]
};}
function metrics(rows,key){const v=rows.map(r=>r.predicted-r[key]);return {bands:v.length,bias:v.reduce((a,b)=>a+b,0)/v.length,rmse:Math.sqrt(v.reduce((a,b)=>a+b*b,0)/v.length),maxAbsolute:Math.max(...v.map(Math.abs))};}
function compare(E){
 const result=E.predict(caseInputs());
 const receivers=data.cases.map((d,i)=>{
  const rows=d.samples.map((s,j)=>{if(Math.abs(Math.log(s.frequency/result.bands[j].f))>1e-10)throw Error('Measured band pairing mismatch');return {...s,predicted:result.receivers[i].levels[j],assessed:s.nominalHz<=2000};});
  const primary=rows.filter(r=>r.assessed);
  return {name:d.receiver,rows,metrics:{corrected5000:metrics(primary,'corrected5000'),corrected200000:metrics(primary,'corrected200000'),raw:metrics(primary,'measured')}};
 });
 const variants=[['Sound speed 331 m/s',{c0:331}],['Sound speed 355 m/s',{c0:355}],['Exit speed −5%',{velocity:2456*.95}],['Exit speed +5%',{velocity:2456*1.05}],['Acoustic efficiency 0.5%',{eta:.5}],['Acoustic efficiency 1.0%',{eta:1}]];
 const sensitivity=variants.map(([name,patch])=>{const r=E.predict({...result.c,...patch});return {name,maxBandChangeDb:Math.max(...r.receivers.flatMap((v,i)=>v.levels.slice(0,13).map((x,j)=>Math.abs(x-result.receivers[i].levels[j]))))};});
 return {status:'Conditional measured-data assessment — no validation pass claimed',result,receivers,sensitivity,source:data};
}
const api={data,caseInputs,compare};if(node)module.exports=api;else root.MeasuredCase=api;
})(typeof window!=='undefined'?window:globalThis);
