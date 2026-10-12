// Numerical/physical invariants and a published check for the optional peak model.
const assert=require('node:assert/strict'),fs=require('node:fs');
const V=require('./engine.js');global.VDC=V;const R=require('./reporting.js');
const raw=JSON.parse(fs.readFileSync(__dirname+'/reference/irvine-2011-case.json')).inputs;
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(Math.abs(a),Math.abs(b),1e-30),`${a} != ${b}`);
// Irvine Rev H equation (8) and Table 1, p. 6: 500 Hz × 1200 s, 50%, 5.34.
assert.equal(V.extremePeakFactor(600000,.5).toFixed(2),'5.34');
// Invert the equation through the underlying peak CDF. This also exercises
// cancellation-safe arithmetic at the largest exposure/cycle scales in the UI.
for(const N of [100,1000,600000,1e12,6e19])for(const p of [.5,.9,.99,.9999]){
 const k=V.extremePeakFactor(N,p),a=1+.5772/(2*Math.log(N));
 const cdf=Math.exp(N*Math.log1p(-Math.exp(-.5*(k/a)**2)));
 close(cdf,p);
 assert.ok(V.extremePeakFactor(N*2,p)>k);
}
assert.ok(V.extremePeakFactor(10000,.9999)>V.extremePeakFactor(10000,.99));
for(const [n,p] of [[99,.99],[0,.99],[Infinity,.99],[100,1],[100,.49],[100,NaN]])assert.throws(()=>V.extremePeakFactor(n,p));
assert.throws(()=>V.parse({...raw,peakMode:'invalid'}),/peak response model/);
for(const p of ['bad','',49,100])assert.throws(()=>V.parse({...raw,peakMode:'extreme',peakProbability:p}),/probability/);
const fixed=V.parse(raw),cf=V.parse({...raw,peakMode:'fixed',peakProbability:'ignored'});
assert.equal(fixed.peakMode,'fixed');close(V.atMode(fixed,100).peakRatio,V.atMode(cf,100).peakRatio);
const c=V.parse({...raw,peakMode:'extreme',peakProbability:99}),r=V.analyze(c),base=V.analyze(fixed);
const noFixed=V.atMode(V.parse({...raw,peakMode:'extreme',peakFactor:''}),100);
assert.equal(noFixed.peakFixed,null);close(noFixed.peakRandom,r.inspect.peakRandom);
const figures=R.figures(c,r),get=id=>figures.find(f=>f.id===id);
assert.equal(r.worst.margin,base.worst.margin);assert.equal(r.peakWorst.fn,base.peakWorst.fn);
r.rows.forEach((row,i)=>{
 const prior=base.rows[i];assert.equal(row.random,prior.random);assert.equal(row.heritage,prior.heritage);
 close(prior.peakRandom,fixed.peakFactor*prior.sigma);close(row.peakRandom,row.effectivePeakFactor*row.sigma);
 close(row.peakCycles,row.nu0*c.T);close(row.peakFixed,prior.peakRandom);
 close(get('peakResponsePlot').series[0].data[i][1]/get('peakResponsePlot').series[1].data[i][1],get('peakPlot').series[0].data[i][1]);
});
assert.ok(new Set(r.rows.map(x=>x.effectivePeakFactor)).size>5);
assert.ok(r.inspect.effectivePeakFactor!==V.extremePeakFactor(r.inspect.fn*c.T,.99),'Must use response rate, not natural frequency');
const scaled=V.atMode(V.parse({...raw,peakMode:'extreme',psdDb:20}),100);
close(scaled.effectivePeakFactor,r.inspect.effectivePeakFactor);close(scaled.peakRandom,10*r.inspect.peakRandom);
const twice=V.atMode(V.parse({...raw,peakMode:'extreme',duration:Number(raw.duration)*2}),100);
const repeats=V.atMode(V.parse({...raw,peakMode:'extreme',randomRepeats:2}),100);
close(twice.peakRandom,repeats.peakRandom);assert.ok(twice.peakRandom>r.inspect.peakRandom);
assert.throws(()=>V.analyze(V.parse({...raw,peakMode:'extreme',duration:.001})),/100 expected response cycles/);
assert.match(R.peakBasis(c,r),/99% nominal non-exceedance per oscillator/);
assert.match(R.peakBasis(c,r),/k = .*–/);assert.match(R.peakBasis(c,r),/not a joint probability/i);
assert.match(get('peakResponsePlot').definition,/T = 30 s/);
assert.match(get('peakPlot').series[0].name,/99% per mode/);
assert.ok(r.warnings.some(x=>x.includes('Irvine Rev H equation (4)')));
assert.ok(!r.warnings.some(x=>x.includes('uses your selected k-sigma')));
const broad=V.analyze(V.parse({...raw,Q:.5,psdText:'10,0.03\n1000,0.03',peakMode:'extreme'}));
assert.ok(broad.warnings.some(x=>x.includes('Extreme-response model:')&&x.includes('alpha < 0.9')));
console.log('PASS extreme peaks: published benchmark, independent CDF inversion, extreme numeric range, validation, fixed compatibility, unchanged fatigue, response-dependent factors, duration/repeat/PSD scaling, paired figures and probability provenance.');
