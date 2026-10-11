const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./engine.js'),P=require('./published-case.js');
const p=P.compare(E),c=p.result.c;
assert.equal(c.model,'dsm2');assert.equal(c.core,'eldred');
assert.ok(Math.abs(p.result.W-14)<1e-12);
assert.ok(Math.abs(Math.hypot(c.receivers[0].x,c.receivers[0].y)-Math.sqrt(24.5))<1e-12);
assert.equal(p.rows.length,21);assert.equal(p.rows.filter(r=>r.directivityClamped).length,7);
assert.ok(Math.abs(P.data.samples[10].level-91.7)<.15,'Independent visual reading at 1 kHz');
assert.ok(Math.abs(P.data.samples.at(-1).level-89.2)<.15,'Independent visual reading at 10 kHz');
for(const r of p.rows){assert.ok(Number.isFinite(r.residual));assert.equal(r.residual,r.predicted-r.published);}
assert.match(p.status,/not a verification pass/);
assert.ok(p.replayMetrics.rmse<.5&&p.replayMetrics.maxAbsolute<.5,'Source-code diagnostic should reproduce the independent readings within graph precision.');
assert.equal(p.stages.length,6);
assert.ok(p.correctedMetrics.rmse>4,'Fixing the source angle must not silently retain the erroneous low-frequency attenuation.');
// This is a quadrant bug in the source, not an angle convention to copy into E.
const angles=P.angles(.8,c.receivers[0]);
assert.ok(angles.physical>50&&angles.physical<55);
assert.ok(Math.abs(angles.appendix-angles.physical-180)<1e-12);
assert.deepEqual(P.angles(3.5,c.receivers[0]),{physical:90,appendix:90});
const downstream=E.receive({...E.prepare(c),sources:[{s:.8,pos:{x:.8,y:0,tx:1,ty:0},bands:E.bandGrid(c).map(()=>1)}]},c.receivers[0]);
assert.ok(Math.abs(downstream.minTheta-angles.physical)<1e-12);
const upstream=E.receive({...E.prepare(c),sources:[{s:.8,pos:{x:.8,y:0,tx:1,ty:0},bands:E.bandGrid(c).map(()=>1)}]},{name:'Upstream',x:-3.5,y:3.5});
assert.ok(upstream.minTheta>90&&upstream.maxTheta<180);
// Wilby's gate: inactive at a physical 45 degrees; activates only >=170.
for(const sr of [.005,.01,.02,.04345,.1]){
 assert.equal(P.wilby3(sr,45),P.wilby3(sr,169.999));
 const delta=sr<.01?-28.9339:sr>.04345?0:61.7691+45.3515*Math.log10(sr);
 assert.ok(Math.abs(P.wilby3(sr,170)-P.wilby3(sr,45)-delta)<1e-12);
}
assert.ok(Math.abs(p.rows[0].replay-p.rows[0].correctedWilby+17.4075674849)<1e-8);
assert.ok(Math.abs(p.rows[4].replay-p.rows[4].correctedWilby)<1e-12,'No angle penalty above Sr 0.04345');
const fineReplay=P.reconstruct(E,{raw:true,fits:true,centerBands:true,appendixAngle:true,slices:960});
const maxReplaySliceChange=Math.max(...fineReplay.map((v,i)=>Math.abs(v-p.rows[i].replay)));
assert.ok(maxReplaySliceChange<.01);
const fine=E.predict({...c,slices:960}).receivers[0].levels;
const maxSliceChange=Math.max(...fine.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
assert.ok(maxSliceChange<.01);
const raw=E.predict({...c,normalize:false}).receivers[0].levels;
const maxNormalizationChange=Math.max(...raw.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
const cooler=E.predict({...c,c0:Math.sqrt(1.4*287*300)}).receivers[0].levels;
const maxAmbientChange=Math.max(...cooler.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
const out={status:p.status,source:P.data.source,metrics:p.metrics,unclampedMetrics:p.unclampedMetrics,
 replayMetrics:p.replayMetrics,correctedMetrics:p.correctedMetrics,stages:p.stages,
 numericalDiagnostics:{maxSliceChange240to960Db:maxSliceChange,maxNormalizationChangeDb:maxNormalizationChange,maxAmbientChange311to300KDb:maxAmbientChange,maxReplaySliceChange240to960Db:maxReplaySliceChange},rows:p.rows};
fs.writeFileSync(path.join(__dirname,'reference/published-comparison-results.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'reference/smith2013-case.json'),JSON.stringify(c,null,2)+'\n');
console.log('PASS comparison integrity, angle-error isolation, source-formula reconstruction and convergence; no experimental validation claimed.');
console.log(JSON.stringify(out.numericalDiagnostics));
