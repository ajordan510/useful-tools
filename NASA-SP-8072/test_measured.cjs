const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./engine.js'),M=require('./measured-case.js'),p=M.compare(E),c=p.result.c;
assert.equal(c.model,'dsm2');assert.equal(c.core,'eldred');assert.equal(c.eta,.84);
assert.equal(c.reflection,0);assert.equal(c.margin,0);assert.equal(c.velocity,4000*c.diameter);
assert.ok(Math.abs(p.result.W-2681952)<1e-8);
assert.ok(Math.abs(Math.hypot(c.receivers[0].x,c.receivers[0].y)-Math.hypot(39,.35))<1e-10);
assert.ok(Math.abs(c.receivers[1].y-Math.hypot(13,1.68))<1e-10);
assert.equal(M.data.cases.length,2);
for(const [i,r] of p.receivers.entries()){
 assert.equal(r.rows.length,19);assert.equal(r.rows.filter(v=>v.assessed).length,13);
 for(const row of r.rows)for(const k of ['measured','corrected5000','corrected200000','predicted'])assert.ok(Number.isFinite(row[k]));
 for(const key of ['corrected5000','corrected200000','measured']){
  const xs=r.rows.filter(v=>v.assessed),rmse=Math.sqrt(xs.reduce((a,v)=>a+(v.predicted-v[key])**2,0)/13);
  assert.equal(r.metrics[key==='measured'?'raw':key].rmse,rmse);
 }
 const fine=E.predict({...c,slices:960}).receivers[i].levels;
 assert.ok(Math.max(...fine.map((v,j)=>Math.abs(v-r.rows[j].predicted)))<.01);
}
// Independent visual spot checks of the published axes/markers, not solver outputs.
assert.ok(Math.abs(M.data.cases[0].samples[0].measured-123.3)<.2);
assert.ok(Math.abs(M.data.cases[1].samples[5].measured-144.2)<.4);
assert.ok(Math.abs(M.data.cases[0].samples[0].corrected5000-117.7)<.2);
// Author corrections must be kept separate from actual measured readings.
assert.ok(p.receivers[1].metrics.raw.rmse>p.receivers[1].metrics.corrected5000.rmse);
fs.writeFileSync(path.join(__dirname,'reference/nal735-case.json'),JSON.stringify(c,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'reference/measured-comparison-results.json'),JSON.stringify({status:p.status,source:p.source.source,receivers:p.receivers,sensitivity:p.sensitivity},null,2)+'\n');
console.log('PASS measured fixture, published input mapping, assessment band scope, residuals and convergence. Software checks, not a physical accuracy pass.');
