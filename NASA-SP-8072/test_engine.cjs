const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./engine.js');let count=0;const results=[];
function test(name,fn){fn();count++;results.push(name);console.log('PASS',name);}
function close(a,b,t=1e-8){assert.ok(Math.abs(a-b)<t,`${a} != ${b}, tolerance ${t}`);}
const base={...E.defaults(),model:'dsm1'},run=p=>E.predict({...base,...p}),r=run({});
test('Default is DSM-II with free plume and Eldred core',()=>{const c=E.defaults();assert.equal(c.model,'dsm2');assert.equal(c.core,'eldred');assert.equal(c.deflection,0);assert.equal(c.terminate,false);assert.ok(E.predict(c).receivers.every(p=>Number.isFinite(p.oa)));});
test('NASA Stennis Table 3 published power-level check',()=>assert.ok(E.selfCheck().pass));
test('Thrust and efficiency doubling add 3.0103 dB',()=>{for(const p of [{thrust:2e6},{eta:1}]){const q=run(p);q.receivers.forEach((x,i)=>close(x.oa-r.receivers[i].oa,10*Math.log10(2)));}});
test('Independent engine count sums uncorrelated power',()=>{const q=run({engines:4,cluster:'independent'});close(q.D,r.D);close(q.receivers[0].oa-r.receivers[0].oa,10*Math.log10(4));});
test('Merged engine diameter follows square-root count',()=>close(run({engines:4}).D,2));
test('Reflection applies once and design allowance separately',()=>{const q=run({reflection:6.0205999133,margin:7});close(q.receivers[0].oa-r.receivers[0].oa,6.0205999133);close(q.receivers[0].design-q.receivers[0].oa,7);});
test('Pressure conversion and linear band summation',()=>{const p=r.receivers[0];close(20*Math.log10(p.rms/20e-6),p.oa);close(E.db(p.levels.reduce((s,l)=>s+E.pow(l),0)),p.oa);});
test('A weighting is approximately zero at 1 kHz',()=>close(E.aWeight(1000),0,.002));
test('Exact base-10 third-octave edges are contiguous',()=>{r.bands.slice(1).forEach((b,i)=>close(b.lo,r.bands[i].hi,1e-8));});
test('Widening band range does not redistribute truncated power',()=>{const q=run({fmin:100,fmax:1000});q.bands.forEach((b,j)=>{const i=r.bands.findIndex(a=>a.f===b.f);close(q.bandPower[j],r.bandPower[i],1e-6);});assert.ok(q.capture<r.capture);});
test('Full spectra conserve source power after normalization',()=>{for(const model of ['dsm1','dsm2','modern']){const q=run({model,fmin:.1,fmax:1e5});assert.ok(q.capture>.97&&q.capture<1.005,`${model} capture ${q.capture}`);}});
test('Varnier changes DSM-II core, DSM-I unchanged',()=>{const a=run({model:'dsm2'}),b=run({model:'dsm2',core:'varnier'});close(b.core/a.core,1.75/3.45);close(run({core:'varnier'}).receivers[0].oa,r.receivers[0].oa);});
test('Core termination never lengthens core and bend is continuous',()=>{const a=run({model:'dsm2',terminate:true,deflection:8});close(a.core,8);const c={...base,deflection:8,bend:90};const p=E.path(10,c);close(p.x,8);close(p.y,2);close(E.path(8,c).x,8);});
test('DSM-II grid converges for free and bent geometries',()=>{for(const patch of [{},{core:'varnier',deflection:8,terminate:true,bend:90}]){const a=run({model:'dsm2',slices:240,...patch}),b=run({model:'dsm2',slices:960,...patch});a.receivers.forEach((p,i)=>close(p.oa,b.receivers[i].oa,.06));}});
test('Far-field spherical spreading approaches -6.0206 dB per doubling',()=>{const c={...base,directivity:'omni',receivers:[{name:'a',x:0,y:1e5},{name:'b',x:0,y:2e5}]},q=E.predict(c);close(q.receivers[1].oa-q.receivers[0].oa,-20*Math.log10(2),.001);});
test('SATURN directivity matches data nodes and rejects unsupported angles',()=>{for(const i of [0,50,100,199])for(const j of [0,20,50,90])close(E.di(E.modern.Sr[i],E.modern.Theta[j],'modern'),E.modern.DI[i][j],1e-9);assert.throws(()=>E.di(.1,91,'modern'));});
test('Published SATURN components give expected fixed numerical values',()=>{close(E.spectrum(.01,'modern'),14.317830740267112,.00001);close(E.loss(1000,1000,'saturn'),-5.302602553275612,.00001);});
test('Invalid, missing, nonfinite and fractional inputs rejected',()=>{for(const patch of [{eta:0},{engines:1.5},{thrust:Infinity},{diameter:NaN},{fmin:100,fmax:50},{model:'bad'},{normalize:'yes'},{receivers:[]},{deflection:8},{terminate:true},{receivers:[{name:'x',x:1,y:-1}]}])assert.throws(()=>run(patch));});
test('Receiver coincident with a source is rejected',()=>{const s=r.sources[0];assert.throws(()=>run({receivers:[{name:'collision',x:s.pos.x,y:s.pos.y}]}));});
test('Modern complete case returns finite values in supported domain',()=>{const q=run({model:'modern',directivity:'modern',propagation:'saturn',receivers:[{name:'far',x:1000,y:2000}]});assert.ok(q.receivers[0].levels.every(Number.isFinite));});
test('Extreme attenuation retains finite dB values with stable energy summation',()=>{const q=run({propagation:'saturn',fmin:10000,fmax:100000,receivers:[{name:'extrapolation',x:1e6,y:1e6}]});assert.ok(q.receivers[0].levels.every(Number.isFinite));assert.ok(Number.isFinite(q.receivers[0].oa));});
fs.mkdirSync(path.join(__dirname,'reference'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reference/engine-test-results.json'),JSON.stringify({count,passed:results},null,2));
console.log(`${count} test groups passed.`);
