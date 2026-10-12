const assert=require('node:assert/strict'),fs=require('node:fs');
global.VDC=require('./engine.js');const R=require('./reporting.js');
const original=JSON.parse(fs.readFileSync(__dirname+'/example-case.json')).inputs;
const reference=JSON.parse(fs.readFileSync(__dirname+'/reference/irvine-2011-case.json')).inputs;
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1e-30,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
assert.equal(R.num(1e12),'1e+12');assert.equal(R.num(1.234567e18),'1.235e+18');assert.equal(R.num(1e-8),'1e-8');assert.equal(R.num(1000),'1000');assert.equal(R.num(0),'0');assert.equal(R.num(-1e20),'-1e+20');
for(const method of ['dirlik','nb']) {
 const c=VDC.parse({...reference,method,damageFactor:4}),r=VDC.analyze(c),figs=R.figures(c,r,{crosscheck:true}),f=id=>figs.find(f=>f.id===id);
 r.rows.forEach((row,i)=>{
  close(f('fatigueComparePlot').series[0].data[i][1]/f('fatigueComparePlot').series[1].data[i][1],row.margin);
  close(f('ratioPlot').series[0].data[i][1],row.ratio/4);
  close(f('peakResponsePlot').series[0].data[i][1]/f('peakResponsePlot').series[1].data[i][1],row.peakRatio);
  close(f('peakResponsePlot').series[2].data[i][1],row.sigma*1000);
 });
 assert.equal(f('ratioPlot').label,'Fatigue coverage');assert.equal(f('peakPlot').label,'Peak coverage');assert.match(f('ratioPlot').definition,/F = 4/);
 assert.ok(R.peakBasis(c,r).includes('does not change the selected-k result'));
 for(const fig of figs){const svg=R.svg(fig);assert.ok(!svg.includes('NaN'));assert.ok(!fig.label.includes('(log)'));assert.ok(svg.includes('Logarithmic axes'));}
}
const c=VDC.parse({...original,sineScale:2}),r=VDC.analyze(c),figs=R.figures(c,r),disp=figs.find(f=>f.id==='sineDisplacementPlot');
close(disp.series[0].data[0][1],.2); // Original first segment is 0.1 in DA; scale applied once.
const acceleration=figs.find(f=>f.id==='sinePlot');disp.series[0].data.forEach(([f,da],i)=>close(VDC.accel(f,'disp_da_in',da),acceleration.series[0].data[i][1]));
assert.match(disp.definition,/excludes dwell overrides/);
const huge={...figs.find(f=>f.id==='damagePlot'),series:[{name:'Large damage',data:[[10,1e18],[100,1e24]]}]};
const svg=R.svg(huge);assert.ok(svg.includes('1e+24'));assert.ok(!svg.includes('1000000000000000000000000'));
console.log('PASS report figures: normalized source-curve identities at F=4 for both estimators; peak/VRS identity; DA-inch roundtrip with scale; scientific tick formatting; truthful axis labels and peak guidance.');
