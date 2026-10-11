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
assert.ok(p.metrics.rmse>10,'The discrepancy must not silently become a passed validation.');
const fine=E.predict({...c,slices:960}).receivers[0].levels;
const maxSliceChange=Math.max(...fine.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
assert.ok(maxSliceChange<.01);
const raw=E.predict({...c,normalize:false}).receivers[0].levels;
const maxNormalizationChange=Math.max(...raw.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
const cooler=E.predict({...c,c0:Math.sqrt(1.4*287*300)}).receivers[0].levels;
const maxAmbientChange=Math.max(...cooler.map((v,i)=>Math.abs(v-p.rows[i].predicted)));
const out={status:p.status,source:P.data.source,metrics:p.metrics,unclampedMetrics:p.unclampedMetrics,
 numericalDiagnostics:{maxSliceChange240to960Db:maxSliceChange,maxNormalizationChangeDb:maxNormalizationChange,maxAmbientChange311to300KDb:maxAmbientChange},rows:p.rows};
fs.writeFileSync(path.join(__dirname,'reference/published-comparison-results.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'reference/smith2013-case.json'),JSON.stringify(c,null,2)+'\n');
console.log('PASS comparison integrity, power/geometry mapping, residuals and convergence; published agreement remains unresolved.');
console.log(JSON.stringify(out.numericalDiagnostics));
