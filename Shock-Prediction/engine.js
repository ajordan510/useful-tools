/* Shock Workbench numerical engine. No browser or third-party dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Shock=api;})(typeof self!=='undefined'?self:globalThis,function(){
'use strict';
const VERSION='1.0.0',G=9.80665,SCHEMA='shock-workbench/1';
const FAMILIES=['Separation bolt / nut','Pin puller / pusher','Cutter / pyrotechnic actuator','Linear shaped charge','Frangible joint / expanding tube','Clampband release','Non-explosive release','Deployment / latch impact','Docking / landing impact','Valve / mechanism','Incoming interface'];
const METHODS={direct:'Direct interface environment',ratio:'Whole-path SRS ratio',power:'Calibrated distance power law',factors:'Frequency-banded path factors',isolator:'Linear isolation · time domain'};
const fail=m=>{throw new Error(m);};
function num(v,label,min=-Infinity,max=Infinity){if(v===''||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)fail(`${label}: enter a number from ${min} to ${max}.`);return Number(v);}
function required(v,label){if(typeof v!=='string'||!v.trim())fail(`${label} is required.`);return v.trim();}
function enumValue(v,list,label){if(!list.includes(v))fail(`${label}: unsupported value.`);return v;}
function parse(text,columns=2,label='Data'){
 if(typeof text!=='string'||text.length>8e6)fail(`${label}: invalid or oversized text.`);
 const rows=[];let header=false;
 for(const [i,raw] of text.split(/\r?\n/).entries()){
  const line=raw.split('#')[0].trim();if(!line)continue;
  const cells=/[,;\t]/.test(line)?line.split(/[,;\t]/).map(s=>s.trim()):line.split(/ +/);const vals=cells.map(s=>s===''?NaN:Number(s));
  if(cells.length!==columns||vals.some(x=>!Number.isFinite(x))){
   if(!rows.length&&!header&&/[a-zA-Z]/.test(line)&&!/^[-+.\d]/.test(line)){header=true;continue;}
   fail(`${label}: line ${i+1} must contain ${columns} finite numbers.`);
  }
  if(rows.length&&vals[0]<=rows[rows.length-1][0])fail(`${label}: first column must increase strictly (line ${i+1}).`);
  rows.push(vals);if(rows.length>100000)fail(`${label}: limit is 100,000 rows.`);
 }
 if(rows.length<2)fail(`${label}: at least two rows are required.`);return rows;
}
function curve(text,label='Spectrum',allowZero=false){const r=parse(text,2,label);if(r.some(p=>p[0]<=0||p[1]<(allowZero?0:Number.MIN_VALUE)))fail(`${label}: frequencies and levels must be positive.`);return r;}
function interp(rows,f){if(f<rows[0][0]*(1-1e-12)||f>rows.at(-1)[0]*(1+1e-12))return null;let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0]<=f)lo=m;else hi=m;}const a=rows[lo],b=rows[hi],t=Math.max(0,Math.min(1,Math.log(f/a[0])/Math.log(b[0]/a[0])));if(a[1]===0||b[1]===0)return a[1]+t*(b[1]-a[1]);return Math.exp(Math.log(a[1])*(1-t)+Math.log(b[1])*t);}
function grid(min,max,ppo){num(min,'Minimum frequency',0.5,100000);num(max,'Maximum frequency',min*1.0001,100000);num(ppo,'Points per octave',3,48);const n=Math.ceil(Math.log2(max/min)*ppo);if(n>600)fail('Frequency grid exceeds 600 ordinates.');return Array.from({length:n+1},(_,i)=>i===n?max:min*2**(i/ppo));}
function band(v,label){const lo=num(v.min,label+' lower bound',0.5,100000),hi=num(v.max,label+' upper bound',lo,100000);return {lo,hi};}
const inBand=(f,b)=>f>=b.lo*(1-1e-12)&&f<=b.hi*(1+1e-12);
function history(source){
 const rows=parse(source.data,2,'Acceleration history');const dt=rows[1][0]-rows[0][0];if(dt<=0)fail('Sample interval must be positive.');
 for(let i=1;i<rows.length;i++)if(Math.abs(rows[i][0]-rows[i-1][0]-dt)>Math.max(1e-10,dt*1e-4))fail('History must be uniformly sampled; resample explicitly before import.');
 const scale=source.unit==='g'?G:1;const a=rows.map(r=>r[1]*scale);const mean=a.reduce((s,v)=>s+v,0)/a.length;
 if(source.removeMean)for(let i=0;i<a.length;i++)a[i]-=mean;
 let peak=0,imax=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i])>peak){peak=Math.abs(a[i]);imax=i;}
 let integral=0;for(let i=1;i<a.length;i++)integral+=(a[i]+a[i-1])*dt/2;
 let energy=0;for(let i=1;i<a.length;i++)energy+=(a[i]**2+a[i-1]**2)*dt/2;
 const cumulative=[0];for(let i=1;i<a.length;i++)cumulative.push(cumulative.at(-1)+(a[i]**2+a[i-1]**2)*dt/2);
 const tAt=p=>Math.max(0,cumulative.findIndex(x=>x>=p*energy))*dt;
 const warnings=[];if(peak&&Math.abs(mean)>0.01*peak)warnings.push('Mean exceeds 1% of peak; inspect bias and physical baseline before integrating.');
 if(peak&&(Math.abs(a[0])>0.01*peak||Math.abs(a.at(-1))>0.01*peak))warnings.push('Record endpoints exceed 1% of peak. Zero input is assumed before and after the record.');
 let same=0;for(let i=1;i<a.length;i++)if(peak&&a[i]===a[i-1]&&Math.abs(a[i])>0.99*peak)same++;
 if(same>2)warnings.push('Repeated peak samples: inspect clipping or intentionally flat pulse segments.');
 return {a,dt,t0:rows[0][0],stats:{samples:a.length,sampleRate:1/dt,duration:(a.length-1)*dt,peakG:peak/G,peakTime:rows[0][0]+imax*dt,rawMeanG:mean/G,velocityChange:integral,squaredAccelerationIntegral:energy,duration90:tAt(.95)-tAt(.05)},warnings};
}
// Exact first-order-hold state update in dimensionless state [omega*z, zdot].
// Series input weights avoid subtraction of nearly equal low-frequency terms.
function coefficients(f,q,dt){const w=2*Math.PI*f,z=1/(2*q),d=z*w,wd=w*Math.sqrt(1-z*z),e=Math.exp(-d*dt),s=Math.sin(wd*dt),c=Math.cos(wd*dt);
 const phi=[e*(c+d*s/wd),e*w*s/wd,-e*w*s/wd,e*(c-d*s/wd)];
 let bx=0,bv=-dt,g0x=0,g0v=0,g1x=0,g1v=0,fact=2;
 for(let k=0;k<32;k++){
  g0x+=bx*(k+1)/fact;g0v+=bv*(k+1)/fact;g1x+=bx/fact;g1v+=bv/fact;
  const nx=w*dt*bv,nv=-w*dt*bx-2*d*dt*bv;bx=nx;bv=nv;fact*=k+3;
 }
 return {phi,g0x,g0v,g1x,g1v,w,z,d,wd};
}
function step(x,v,a,b,k){return [k.phi[0]*x+k.phi[1]*v+k.g0x*a+k.g1x*b,k.phi[2]*x+k.phi[3]*v+k.g0v*a+k.g1v*b];}
function extrema(C,D,d,w){const values=[C];const theta=Math.atan2(w*D-d*C,w*C+d*D);for(let j=-1;j<=3;j++){const t=(theta+j*Math.PI)/w;if(t>=0&&t<=2*Math.PI/w)values.push(Math.exp(-d*t)*(C*Math.cos(w*t)+D*Math.sin(w*t)));}return {positive:Math.max(0,...values),negative:Math.max(0,...values.map(x=>-x))};}
function oscillator(a,dt,f,q){
 const n=Math.max(4,Math.ceil(64*f*dt)),k=coefficients(f,q,dt/n);let x=0,v=0,positive=0,negative=0,displacement=0;
 for(let i=1;i<a.length;i++)for(let j=0;j<n;j++){
  const aa=a[i-1]+(a[i]-a[i-1])*j/n,bb=a[i-1]+(a[i]-a[i-1])*(j+1)/n;
  [x,v]=step(x,v,aa,bb,k);const ac=-2*k.z*k.w*v-k.w*x;
  positive=Math.max(positive,ac);negative=Math.max(negative,-ac);displacement=Math.max(displacement,Math.abs(x/k.w));
 }
 const C=-2*k.z*k.w*v-k.w*x,derivative=2*k.z*k.w*k.w*x+(4*k.z*k.z-1)*k.w*k.w*v;
 const residual=extrema(C,(derivative+k.d*C)/k.wd,k.d,k.wd),rd=extrema(x/k.w,(v+k.d*x/k.w)/k.wd,k.d,k.wd);
 const sd=Math.max(displacement,rd.positive,rd.negative);
 return {primaryPositive:positive/G,primaryNegative:negative/G,residualPositive:residual.positive/G,residualNegative:residual.negative/G,positive:Math.max(positive,residual.positive)/G,negative:Math.max(negative,residual.negative)/G,sa:Math.max(positive,negative,residual.positive,residual.negative)/G,sd,pv:k.w*sd,pa:k.w*k.w*sd/G};
}
function srs(a,dt,frequencies,q){num(q,'SRS Q',0.51,100);const cost=frequencies.reduce((n,f)=>n+a.length*Math.max(4,Math.ceil(64*f*dt)),0);if(cost>3e7)fail('History processing exceeds the 30 million step budget. Reduce samples or frequency resolution.');return frequencies.map(f=>oscillator(a,dt,f,q));}
function isolate(h,p){const fn=num(p.fn,'Mount natural frequency',5,10000),q=num(p.q,'Mount Q',0.51,30),mass=num(p.mass,'Mounted mass',0.001,10000),clearance=num(p.clearance,'Available travel (mm)',0.001,10000);if(fn>1/(10*h.dt))fail('Mount frequency must be below sample rate / 10.');
 const tail=Math.ceil(12/(Math.PI*fn/q*h.dt)); // 12 decay time constants
 const n=h.a.length+tail;if(n>100000)fail('Mount ringdown exceeds the history limit. Reduce sample rate explicitly or increase mount damping.');
 const input=h.a.concat(Array(tail).fill(0)),out=Array(n).fill(0),k=coefficients(fn,q,h.dt/Math.max(4,Math.ceil(64*fn*h.dt))),sub=Math.max(4,Math.ceil(64*fn*h.dt));let x=0,v=0,travel=0,force=0;
 for(let i=1;i<n;i++){
  const left=i===h.a.length?0:input[i-1];
  for(let j=0;j<sub;j++){[x,v]=step(x,v,left+(input[i]-left)*j/sub,left+(input[i]-left)*(j+1)/sub,k);travel=Math.max(travel,Math.abs(x/k.w));force=Math.max(force,mass*Math.abs(-2*k.z*k.w*v-k.w*x));}
  out[i]=-2*k.z*k.w*v-k.w*x;
 }
 return {a:out,dt:h.dt,travelMm:travel*1000,forceN:force,bottomed:travel*1000>clearance,tailSeconds:tail*h.dt};
}
function normalizeProject(p){
 if(!p||p.schema!==SCHEMA)fail(`Unsupported project. Expected ${SCHEMA}.`);
 if(!Array.isArray(p.sources)||!p.sources.length||p.sources.length>30||!Array.isArray(p.cases)||!p.cases.length||p.cases.length>40)fail('Project requires 1–30 sources and 1–40 cases.');
 if(!p.settings||typeof p.settings!=='object')fail('Project settings are missing.');
 function shape(value,template,path){
  if(!value||typeof value!=='object'||Array.isArray(value))fail(`${path}: expected an object.`);
  for(const [key,example] of Object.entries(template)){const v=value[key],label=path+'.'+key;
   if(Array.isArray(example)){if(!Array.isArray(v))fail(`${label}: expected a list.`);}
   else if(typeof example==='object')shape(v,example,label);
   else if(typeof example==='number'){if(typeof v!=='number'&&typeof v!=='string')fail(`${label}: expected a number.`);}
   else if(typeof v!==typeof example)fail(`${label}: expected ${typeof example}.`);
  }
 }
 for(const key of ['title','configuration','notes'])if(typeof p[key]!=='string')fail(`Project ${key}: expected text.`);
 shape(p.settings,{min:0,max:0,ppo:0,q:0},'Settings');
 for(const s of p.sources)shape(s,emptySource(),'Source');
 for(const c of p.cases){shape(c,emptyCase(),'Assessment');for(const f of c.factors)shape(f,{label:'',db:0,min:0,max:0,evidence:'',included:false},'Factor');}
 for(const list of [p.sources,p.cases]){const ids=new Set();for(const item of list){required(item.id,'Record ID');if(ids.has(item.id))fail('Duplicate record ID.');ids.add(item.id);}}
 for(const c of p.cases){if(!p.sources.some(s=>s.id===c.sourceId))fail('A case references a missing source.');for(const key of ['distance','mount','capability'])if(!c[key]||typeof c[key]!=='object')fail(`Case ${c.id}: missing ${key}.`);if(!Array.isArray(c.factors))fail('Case factors must be a list.');}
 return JSON.parse(JSON.stringify(p));
}
function analyze(project){const p=normalizeProject(project),freq=grid(Number(p.settings.min),Number(p.settings.max),Number(p.settings.ppo)),q=num(p.settings.q,'Analysis Q',.51,100);required(p.title,'Study title');required(p.configuration,'Study configuration');
 // Preserve imported breakpoints so a narrow empirical notch cannot fall between grid samples.
 const knots=new Set(freq),lo=freq[0],hi=freq.at(-1),add=f=>{f=Number(f);if(Number.isFinite(f)&&f>=lo&&f<=hi)knots.add(f);},addBand=x=>{add(x.min);add(x.max);},addCurve=(data,label)=>curve(data,label).forEach(row=>add(row[0]));
 for(const src of p.sources)if(p.cases.some(c=>c.sourceId===src.id&&c.enabled!==false)){addBand(src);if(src.kind==='srs')addCurve(src.data,'Source spectrum');}
 for(const c of p.cases)if(c.enabled!==false){if(c.method==='ratio')addCurve(c.ratioData,'Whole-path ratio');if(['power','factors'].includes(c.method))c.factors.forEach(addBand);if(c.capability.enabled){addBand(c.capability);addCurve(c.capability.data,'Capability spectrum');}}
 freq.splice(0,freq.length,...[...knots].sort((a,b)=>a-b).filter((f,i,arr)=>i===0||f>arr[i-1]*(1+1e-12)));
 if(freq.length>2000)fail('More than 2,000 frequencies including imported breakpoints. Reduce the band or simplify spectra explicitly.');
 const sources=Object.create(null);for(const src of p.sources){
  const referenced=p.cases.some(c=>c.sourceId===src.id&&c.enabled!==false);if(!referenced)continue;
  required(src.name,'Source name');required(src.event,'Event');required(src.location,'Reference location');required(src.configuration,'Source configuration');required(src.frame,'Coordinate frame');enumValue(src.kind,['srs','history'],'Source representation');enumValue(src.unit,['g','m/s2'],'Acceleration unit');enumValue(src.axis,['X','Y','Z'],'Axis');enumValue(src.basis,['single','central','envelope','mpe'],'Source statistical basis');enumValue(src.support,['point','line','ring','multiple','interface'],'Source support');enumValue(src.family,FAMILIES,'Source family');
  const b=band(src,'Source valid band');const warnings=[];let values,metrics=null,h=null;
  if(src.kind==='srs'){num(src.q,'Source Q',.51,100);if(Math.abs(Number(src.q)-q)>1e-9)fail(`${src.name}: source Q differs from analysis Q. Recompute from history or use matching Q.`);const rows=curve(src.data,src.name);values=freq.map(f=>{const v=inBand(f,b)?interp(rows,f):null;return v===null?null:v*(src.unit==='g'?1:1/G);});}
  else{h=history(src);warnings.push(...h.warnings);if(b.hi>h.stats.sampleRate/10)warnings.push('Assessed history band is limited to sample rate / 10 in this release.');const valid=freq.filter(f=>inBand(f,b)&&f<=h.stats.sampleRate/10*(1+1e-12));metrics=srs(h.a,h.dt,valid,q);let j=0;values=freq.map(f=>valid.includes(f)?metrics[j++].sa:null);metrics=freq.map(f=>valid.includes(f)?metrics[valid.indexOf(f)]:null);}
  if(values.every(v=>v===null))fail(`${src.name}: no overlap with requested frequency band.`);
  if(src.illustrative)warnings.push('Illustrative teaching source; not hardware evidence.');if(!src.evidence.trim())warnings.push('Source evidence citation is missing.');
  sources[src.id]={src,values,metrics,h,warnings};
 }
 const cases=[];for(const c of p.cases){if(c.enabled===false)continue;required(c.name,'Case name');required(c.component,'Component');required(c.interface,'Component interface');required(c.mounting,'Mounting/configuration description');enumValue(c.method,Object.keys(METHODS),'Prediction method');
  const source=sources[c.sourceId],src=source.src,warnings=[...source.warnings],gains=[];let nominal,outputHistory=null,mount=null;
  const allowance=num(c.allowanceDb,'Engineering allowance (dB)',0,40),qualification=num(c.qualificationDb,'Test margin (dB)',0,20);
  if(src.basis==='mpe'&&allowance>0&&!String(c.allowanceReason||'').trim())fail(`${c.name}: source already marked MPE. Document why an additional allowance is required.`);
  if(allowance>0&&!c.allowanceReason.trim())warnings.push('Engineering allowance rationale is missing.');if(qualification>0&&!c.qualificationReason.trim())warnings.push('Test-margin requirement/rationale is missing.');
  if(src.configuration!==p.configuration)warnings.push('Source configuration differs from study configuration; similarity needs review.');
  if(!c.evidence.trim()&&c.method!=='direct')warnings.push('Path/model evidence is missing.');
  if(c.method==='direct'&&src.location!==c.interface)warnings.push('Direct method uses a different reference location; interface equivalence is unverified.');
  if(c.method==='isolator'){
   if(!source.h)fail(`${c.name}: time-domain isolation requires an acceleration history. SRS cannot be filtered as a waveform.`);
   if(!c.baseConfirmed)fail(`${c.name}: confirm the source history is the prescribed motion at the mount base.`);
   mount=isolate(source.h,c.mount);const valid=freq.filter((f,i)=>source.values[i]!==null),res=srs(mount.a,mount.dt,valid,q);let j=0;nominal=freq.map((f,i)=>source.values[i]===null?null:res[j++].sa);outputHistory=sampleHistory(mount.a,mount.dt,source.h.t0);
   warnings.push('Linear mount model assumes prescribed base motion, rigid payload, and no bypass paths.');if(mount.bottomed)warnings.push('Predicted mount travel exceeds clearance: the linear result is invalid after contact.');
  }else{
   let ratios=null,alpha=null,r0=null,r=null,db=0;
   if(c.method==='ratio')ratios=curve(c.ratioData,'Whole-path ratio');
   if(c.method==='power'){r0=num(c.distance.reference,'Reference path distance (m)',.001,10000);r=num(c.distance.target,'Target path distance (m)',.001,10000);alpha=num(c.distance.exponent,'Calibrated distance exponent',-5,5);const lo=num(c.distance.validMin,'Calibration minimum distance',.001,10000),hi=num(c.distance.validMax,'Calibration maximum distance',lo,10000);if(r0<lo||r0>hi||r<lo||r>hi)fail(`${c.name}: source/target distance falls outside the declared calibration interval.`);db=-20*alpha*Math.log10(r/r0);gains.push({label:'Distance ratio',db,evidence:c.evidence});warnings.push('Distance power law is an analyst-calibrated surrogate; no default device/material calibration is implied.');}
   if(c.factors.length>12)fail('At most 12 path factors per case.');
   if(c.method==='factors'||c.method==='power')for(const factor of c.factors){required(factor.label,'Factor name');num(factor.db,'Factor signed gain (dB)',-60,40);band(factor,'Factor valid band');if(factor.included)fail(`${factor.label}: effect marked already included. Remove it to avoid double counting.`);if(!factor.evidence.trim())warnings.push(`Evidence missing for factor: ${factor.label}.`);gains.push({label:factor.label,db:Number(factor.db),min:Number(factor.min),max:Number(factor.max),evidence:factor.evidence});}
   nominal=source.values.map((v,i)=>{if(v===null)return null;let gain=10**(db/20);if(ratios){const rv=interp(ratios,freq[i]);if(rv===null)return null;gain*=rv;}
    if(c.method==='power'||c.method==='factors')for(const factor of c.factors){if(!inBand(freq[i],band(factor,'Factor')))return null;gain*=10**(Number(factor.db)/20);}return v*gain;});
  }
  const environment=nominal.map(v=>v===null?null:v*10**(allowance/20)),requirement=environment.map(v=>v===null?null:v*10**(qualification/20));
  const transfer=nominal.map((v,i)=>v===null||source.values[i]===0?null:v/source.values[i]);const cap=c.capability;let capability=freq.map(()=>null),reasons=[];
  if(cap.enabled){const cr=curve(cap.data,'Capability spectrum');const cb=band(cap,'Capability band');num(cap.q,'Capability Q',.51,100);enumValue(cap.unit,['g','m/s2'],'Capability unit');enumValue(cap.axis,['X','Y','Z'],'Capability axis');enumValue(cap.type,['achieved','specified'],'Capability evidence type');
   capability=freq.map(f=>{const value=inBand(f,cb)?interp(cr,f):null;return value===null?null:value*(cap.unit==='g'?1:1/G);});
   if(Number(cap.q)!==q)reasons.push('Capability Q differs');if(cap.axis!==src.axis)reasons.push('Capability axis differs');if(cap.frame!==src.frame)reasons.push('Capability coordinate frame differs');if(cap.interface!==c.interface)reasons.push('Capability interface differs');if(cap.configuration!==p.configuration)reasons.push('Capability configuration differs');if(!cap.compatible)reasons.push('Mounting, waveform, operating state and repeat count not confirmed');if(!cap.evidence.trim())reasons.push('Capability evidence missing');if(cap.type!=='achieved')reasons.push('Nominal specification is not an achieved test');
  }
  const coverage=requirement.map((v,i)=>v===null||v===0||capability[i]===null?null:capability[i]/v);
  let worst=null;coverage.forEach((value,i)=>{if(value!==null&&(!worst||value<worst.ratio))worst={ratio:value,db:20*Math.log10(value),frequency:freq[i]};});
  const missing=nominal.filter(x=>x===null).length,coverageMissing=coverage.filter(x=>x===null).length;
  let status=!cap.enabled?'Environment only':!worst?'Not assessed':worst.ratio<1?'Coverage gap':reasons.length||warnings.length||coverageMissing?'Conditional coverage':'Coverage within stated scope';
  if(mount?.bottomed)status='Invalid · mount contact';
  if(missing)warnings.push(`${missing} requested ordinates have no supported prediction.`);
  if(cap.enabled&&coverageMissing)reasons.push(`${coverageMissing} ordinates not assessed`);
  cases.push({id:c.id,name:c.name,component:c.component,source:src.name,event:src.event,axis:src.axis,frame:src.frame,configuration:src.configuration,interface:c.interface,method:c.method,nominal,environment,requirement,capability,coverage,transfer,worst,missing,status,warnings:[...new Set(warnings)],reasons,gains,mount:mount?{travelMm:mount.travelMm,forceN:mount.forceN,bottomed:mount.bottomed,tailSeconds:mount.tailSeconds}:null,outputHistory,sourceValues:source.values,metrics:source.metrics,historyStats:source.h?.stats||null,inputHistory:source.h?sampleHistory(source.h.a,source.h.dt,source.h.t0):null});
 }
 if(!cases.length)fail('Enable at least one case.');
 // Envelope of enabled cases, including alternatives; never a simultaneous waveform.
 const groups=[];for(const c of cases){let group=groups.find(g=>['component','interface','axis','frame','configuration'].every(k=>g[k]===c[k]));if(!group){group={component:c.component,interface:c.interface,axis:c.axis,frame:c.frame,configuration:c.configuration,cases:[],values:freq.map(()=>null),governing:freq.map(()=>null),complete:freq.map(()=>true)};groups.push(group);}group.cases.push(c.id);c.requirement.forEach((v,i)=>{if(v===null)group.complete[i]=false;else if(group.values[i]===null||v>group.values[i]){group.values[i]=v;group.governing[i]=c.name;}});}
 return {version:VERSION,frequency:freq,q,cases,groups,created:new Date().toISOString(),project:p};
}
function sampleHistory(a,dt,t0){const stride=Math.max(1,Math.ceil(a.length/1500));const points=[];for(let i=0;i<a.length;i+=stride){let min=i,max=i;for(let j=i;j<Math.min(i+stride,a.length);j++){if(a[j]<a[min])min=j;if(a[j]>a[max])max=j;}for(const j of [...new Set([i,min,max,Math.min(i+stride-1,a.length-1)])].sort((a,b)=>a-b))points.push([t0+j*dt,a[j]/G]);}return points;}
function emptySource(id='source-1'){return {id,name:'New source',family:FAMILIES[0],support:'point',event:'Separation event',axis:'Z',frame:'Vehicle',location:'Source reference',configuration:'Flight-like A',kind:'srs',unit:'g',q:10,min:100,max:10000,basis:'single',evidence:'',illustrative:false,removeMean:false,data:'100, 20\n1000, 200\n10000, 200'};}
function emptyCase(id='case-1',sourceId='source-1'){return {id,sourceId,name:'New assessment',component:'Electronics unit',interface:'Unit feet',mounting:'Rigid feet on panel; record bracket and fastener state',enabled:true,method:'direct',evidence:'',allowanceDb:0,allowanceReason:'',qualificationDb:0,qualificationReason:'',ratioData:'100, 1\n10000, 0.5',distance:{reference:.3,target:1,exponent:.7,validMin:.3,validMax:2},factors:[],baseConfirmed:false,mount:{fn:200,q:2,mass:2,clearance:3},capability:{enabled:false,type:'achieved',q:10,unit:'g',min:100,max:10000,axis:'Z',frame:'Vehicle',interface:'Unit feet',configuration:'Flight-like A',compatible:false,evidence:'',data:'100, 40\n1000, 400\n10000, 400'}};}
function demo(){const src=emptySource();Object.assign(src,{name:'Separation nut · teaching spectrum',evidence:'Illustrative spectrum for exploring the workflow. No measured hardware data.',illustrative:true,data:'100, 30\n500, 150\n1500, 450\n10000, 450'});const line=emptySource('source-2');Object.assign(line,{name:'Frangible joint · teaching spectrum',family:'Frangible joint / expanding tube',support:'line',event:'Structural separation',illustrative:true,evidence:src.evidence,data:'100, 20\n1000, 200\n3000, 600\n10000, 600'});
 const a=emptyCase();Object.assign(a,{name:'Avionics · baseline',component:'Avionics controller',method:'ratio',evidence:'Teaching whole-path ratio, not measured.',ratioData:'100, 1\n500, 0.9\n1500, 0.65\n10000, 0.4',allowanceDb:3,allowanceReason:'Illustrative model allowance; no statistical interpretation.',qualificationDb:3,qualificationReason:'Illustrative project test margin, not a standards profile.'});Object.assign(a.capability,{enabled:true,compatible:true,evidence:'Illustrative achieved test; no hardware qualification implied.',data:'100, 70\n1000, 400\n3000, 500\n10000, 500'});
 const b=JSON.parse(JSON.stringify(a));b.id='case-2';b.name='Avionics · relocation trade';b.ratioData='100, 1.1\n500, 0.7\n1500, 0.35\n10000, 0.22';b.evidence='Teaching alternative path; amplification at low frequency retained.';
 const c=JSON.parse(JSON.stringify(a));c.id='case-3';c.name='Avionics · line-source event';c.sourceId=line.id;c.ratioData='100, 1\n1000, 0.8\n3000, 0.5\n10000, 0.3';
 return {schema:SCHEMA,title:'Separation shock study',configuration:'Flight-like A',notes:'Teaching study. Replace source, transmission and capability data with applicable evidence before making engineering decisions.',settings:{min:100,max:10000,ppo:12,q:10},sources:[src,line],cases:[a,b,c]};}
return {VERSION,SCHEMA,G,FAMILIES,METHODS,num,parse,curve,interp,grid,history,coefficients,step,oscillator,srs,isolate,normalizeProject,analyze,emptySource,emptyCase,demo};
});
