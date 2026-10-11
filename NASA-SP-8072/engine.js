/* Rocket Acoustics Workbench 1.0.0. SI units internally.
 * NASA SP-8072 equations 1-10; documented adaptations in RESEARCH.md.
 * SATURN components adapted from Logan Mathews, Apache-2.0. See NOTICE.txt.
 */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const data=node?require('./model-data.json'):root.MODEL_DATA;
const modern=node?require('./vendor/saturn-directivity.json'):root.SATURN_DI;
const log=Math.log10, pow=x=>10**(x/10), db=x=>10*log(x);
const sum=a=>a.reduce((s,v)=>s+v,0), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const addDb=(a,b)=>a===-Infinity?b:b===-Infinity?a:Math.max(a,b)+10*log(1+10**(-Math.abs(a-b)/10));
function bracket(a,x){let lo=0,hi=a.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]>x)hi=m;else lo=m;}return [lo,hi];}
function interp(xs,ys,x){const [i,j]=bracket(xs,x);const t=(x-xs[i])/(xs[j]-xs[i]);return ys[i]+t*(ys[j]-ys[i]);}
function curve(table,x,left,right){const xs=table.map(p=>log(p[0])),ys=table.map(p=>p[1]),lx=log(x);if(lx<xs[0])return ys[0]+left*(lx-xs[0]);if(lx>xs.at(-1))return ys.at(-1)+right*(lx-xs.at(-1));return interp(xs,ys,lx);}
function spectrum(sr,model){if(model!=='modern')return curve(data.fig5,sr,20,-20);const x=Math.log(sr);return sr<.0036?8.686*x+58.6:sr<=.048?.26*x**3-15.98*x-33.88:-8.686*x-19;}
function integrateLog(fn,a,b,n=160){const h=Math.log(b/a)/n;let total=0;for(let i=0;i<n;i++){const x=a*Math.exp((i+.5)*h);total+=fn(x)*x*h;}return total;}
const norms={legacy:integrateLog(s=>pow(spectrum(s,'legacy')),1e-9,1e7,20000),modern:integrateLog(s=>pow(spectrum(s,'modern')),1e-9,1e7,20000),slice:integrateLog(s=>pow(curve(data.fig13,s,10,-30)),1e-9,1e7,20000)};
function di(sr,theta,model){
 if(model==='omni')return 0;
 if(model==='modern'){
  if(theta>90+1e-8||theta<0)throw Error('SATURN directivity is available only for 0–90° from the downstream plume axis. Use a downstream receiver or choose SP-8072 directivity.');
  const s=clamp(sr,modern.Sr[0],modern.Sr.at(-1)),t=clamp(theta,0,90),[i,j]=bracket(modern.Sr,s),[a,b]=bracket(modern.Theta,t),u=(s-modern.Sr[i])/(modern.Sr[j]-modern.Sr[i]),v=(t-modern.Theta[a])/(modern.Theta[b]-modern.Theta[a]);
  return (1-u)*((1-v)*modern.DI[i][a]+v*modern.DI[i][b])+u*((1-v)*modern.DI[j][a]+v*modern.DI[j][b]);
 }
 const t=clamp(theta,20,180),s=clamp(sr,.004,.4),ys=data.fig10DI.map(r=>interp(data.fig10Theta,r,t));return interp(data.fig10Sr.map(log),ys,log(s));
}
function loss(f,r,mode){return mode==='saturn'?-10*(Math.sqrt(r/12000)*log(1+f/16)+(r/3000)**1.5*log(1+f/8000)):0;}
function aWeight(f){const f2=f*f;return 20*log(12194**2*f2*f2/((f2+20.6**2)*Math.sqrt((f2+107.7**2)*(f2+737.9**2))*(f2+12194**2)))+2;}
function defaults(){return {schema:'rocket-acoustics-1',name:'Reference engine • free plume',notes:'Illustrative engineering case; replace with verified engine and facility inputs.',thrust:1000000,velocity:2800,diameter:1,mach:3.4,engines:1,eta:.5,model:'dsm2',core:'eldred',normalize:true,cluster:'merged',directivity:'legacy',propagation:'none',reflection:0,margin:3,fmin:10,fmax:10000,slices:240,deflection:0,bend:90,terminate:false,c0:343,receivers:[{name:'R1 · Primary',x:100,y:150},{name:'R2 · Aft structure',x:-30,y:10},{name:'R3 · Far field',x:1000,y:1500}]};}
function validate(c){
 const ranges={thrust:[1,1e9],velocity:[100,10000],diameter:[.001,100],mach:[.1,20],engines:[1,200],eta:[.001,5],reflection:[0,6.020599914],margin:[0,30],fmin:[.1,1e5],fmax:[.1,1e5],slices:[40,2000],deflection:[0,1e5],bend:[0,170],c0:[250,450]};
 for(const [k,[a,b]] of Object.entries(ranges))if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<a||c[k]>b)throw Error(`${k}: enter a finite value between ${a} and ${b}.`);
 for(const k of ['engines','slices'])if(!Number.isInteger(c[k]))throw Error(`${k} must be a whole number.`);
 if(c.fmax<=c.fmin)throw Error('Maximum frequency must exceed minimum frequency.');
 for(const [k,vals] of Object.entries({model:['dsm1','dsm2','modern'],core:['eldred','varnier'],cluster:['merged','independent'],directivity:['legacy','modern','omni'],propagation:['none','saturn']}))if(!vals.includes(c[k]))throw Error(`Unknown ${k}.`);
 if(typeof c.normalize!=='boolean'||typeof c.terminate!=='boolean')throw Error('Normalization and core termination must be true/false.');
 if(c.model!=='dsm2'&&(c.deflection>0||c.terminate))throw Error('Bent plume and core termination require DSM-II.');
 if(c.terminate&&c.deflection<=0)throw Error('Core termination requires a positive deflection distance.');
 if(!Array.isArray(c.receivers)||c.receivers.length<1||c.receivers.length>30)throw Error('Provide 1–30 receivers.');
 for(const p of c.receivers){if(typeof p.name!=='string'||p.name.length>100||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e6||p.y<0||p.y>1e6)throw Error('Each receiver needs a name, finite axial x (±1,000,000 m), and radial y (0–1,000,000 m).');}
 if(typeof c.name!=='string'||c.name.length>200||typeof c.notes!=='string'||c.notes.length>10000)throw Error('Case name or notes are invalid or too long.');
 return c;
}
function bandGrid(c){const out=[];for(let k=-60;k<=60;k++){const f=1000*10**(k/10);if(f>=c.fmin*(1-1e-9)&&f<=c.fmax*(1+1e-9))out.push({f,lo:f/10**.05,hi:f*10**.05});}if(!out.length)throw Error('Frequency range contains no one-third-octave center.');return out;}
function path(s,c){if(c.deflection<=0||s<=c.deflection)return {x:s,y:0,tx:1,ty:0};const a=c.bend*Math.PI/180;return {x:c.deflection+(s-c.deflection)*Math.cos(a),y:(s-c.deflection)*Math.sin(a),tx:Math.cos(a),ty:Math.sin(a)};}
function prepare(c){
 validate(c);const D=c.diameter*(c.cluster==='merged'?Math.sqrt(c.engines):1),W=.5*(c.eta/100)*c.engines*c.thrust*c.velocity;
 let core=(c.core==='varnier'?1.75:3.45)*D*(1+.38*c.mach)**2;if(c.terminate)core=Math.min(core,c.deflection);
 const bands=bandGrid(c),sources=[];const model=c.model==='modern'?'modern':'legacy';
 if(c.model==='dsm2'){
  const step=4.9/c.slices,cuts=Array.from({length:c.slices+1},(_,i)=>.1+i*step);
  // Split at the bend: a midpoint cell must not straddle a discontinuous tangent.
  const bendQ=c.deflection/core;if(c.deflection>0&&bendQ>.1&&bendQ<5&&!cuts.some(q=>Math.abs(q-bendQ)<1e-12))cuts.push(bendQ);cuts.sort((a,b)=>a-b);
  let total=0;for(let i=0;i<cuts.length-1;i++){const dq=cuts[i+1]-cuts[i],q=(cuts[i]+cuts[i+1])/2,w=pow(curve(data.fig12,q,0,0))*dq;total+=w;sources.push({s:q*core,w,width:dq*core});}
  for(const src of sources){if(c.normalize)src.w/=total;src.pos=path(src.s,c);src.bands=bands.map(b=>{const scale=src.s/(c.mach*c.c0);return W*src.w*integrateLog(f=>pow(curve(data.fig13,f*scale,10,-30))*scale/(c.normalize?norms.slice:1),b.lo,b.hi,16);});}
 }else{
  for(let i=0;i<bands.length;i++){const b=bands[i],sr=b.f*D/c.velocity;const s=c.model==='modern'?9.85*sr**(-.21)*D:10**interp(data.fig14.map(p=>log(p[0])),data.fig14.map(p=>log(p[1])),clamp(log(sr),log(data.fig14[0][0]),log(data.fig14.at(-1)[0])))*D;
   const power=W*integrateLog(f=>pow(spectrum(f*D/c.velocity,model))*D/c.velocity/(c.normalize?norms[model]:1),b.lo,b.hi,24);
   sources.push({s,w:power/W,pos:path(s,c),bands:bands.map((_,j)=>i===j?power:0)});
  }
 }
 const bandPower=bands.map((_,j)=>sum(sources.map(s=>s.bands[j])));return {c,D,W,Lw:db(W/1e-12),core,bands,sources,bandPower,capture:sum(bandPower)/W};
}
function receive(pre,p){const {c,D,bands,sources}=pre;let minR=Infinity,minTheta=180,maxTheta=0;const levels=bands.map(()=>-Infinity),contributions=[];
 for(const src of sources){const dx=p.x-src.pos.x,dy=p.y-src.pos.y,r=Math.hypot(dx,dy);if(r<.5*D)throw Error(`${p.name}: receiver lies within 0.5 effective diameters of an acoustic source. Move it outside the plume/source region.`);minR=Math.min(minR,r);const theta=Math.acos(clamp((dx*src.pos.tx+dy*src.pos.ty)/r,-1,1))*180/Math.PI;minTheta=Math.min(minTheta,theta);maxTheta=Math.max(maxTheta,theta);let e=-Infinity;
  for(let j=0;j<bands.length;j++){if(src.bands[j]===0)continue;const f=bands[j].f,v=db(src.bands[j]/1e-12)-db(4*Math.PI*r*r)+di(f*D/c.velocity,theta,c.directivity)+loss(f,r,c.propagation)+c.reflection;levels[j]=addDb(levels[j],v);e=addDb(e,v);}
  contributions.push({s:src.s,level:e});
 }
 const oa=levels.reduce(addDb,-Infinity),la=levels.map((v,i)=>v+aWeight(bands[i].f)).reduce(addDb,-Infinity);const peak=levels.indexOf(Math.max(...levels));
 return {...p,levels,oa,la,design:oa+c.margin,rms:20e-6*10**(oa/20),peak:bands[peak].f,minR,minTheta,maxTheta,contributions:contributions.map(x=>({...x,fraction:pow(x.level-oa)}))};
}
function predict(c){const pre=prepare(c),receivers=c.receivers.map(p=>receive(pre,p)),warnings=[];
 if(c.model==='dsm2')warnings.push('DSM-II uses the historical Figure 12 distribution, identified as erroneous by Gee (2021). Core shortening is a sensitivity option, not a universal correction.');
 if(c.model==='modern')warnings.push('Stationary SATURN adaptation: not the full trajectory model or a reproduction of its launch-validation accuracy.');
 if(receivers.some(r=>r.minR<100*pre.D))warnings.push('One or more receivers are within 100 effective diameters of a source; compact-source/free-field and empirical directivity assumptions are less reliable.');
 const sr=pre.bands.map(b=>b.f*pre.D/c.velocity);
 if(c.directivity==='legacy'&&(sr[0]<.004||sr.at(-1)>.4||receivers.some(r=>r.minTheta<20)))warnings.push('SP-8072 directivity is held at boundary values outside Sr 0.004–0.4 or angles 20–180°.');
 if(c.directivity==='modern'&&(sr[0]<modern.Sr[0]||sr.at(-1)>modern.Sr.at(-1)))warnings.push('SATURN directivity is held at its Strouhal table boundaries.');
 if(c.model==='dsm1'&&(sr[0]<.0012||sr.at(-1)>1.5))warnings.push('Figure 14 source positions are held at the ends of the digitized range.');
 if(pre.capture<.9)warnings.push(`The selected bands contain ${(pre.capture*100).toFixed(1)}% of modeled source power. Reported overall levels cover only these bands.`);
 if(c.propagation==='saturn')warnings.push('Empirical propagation uses the pinned SATURN code parameters (16 Hz first corner); it is not a site/weather-specific or nonlinear propagation solver.');
 if(c.propagation==='saturn'&&receivers.some(r=>r.minR>20000))warnings.push('Empirical propagation beyond 20 km is a strong extrapolation; the modern research reports increasing weather-dependent discrepancies.');
 if(c.cluster==='independent'&&c.engines>1)warnings.push('Independent engines are acoustically uncorrelated and co-located; actual nozzle spacing and shielding are not resolved.');
 if(c.velocity<1000||c.velocity>4000)warnings.push('Exit velocity is outside the standard chemical-rocket Figure 5 range (approximately 1000–4000 m/s).');
 if(c.deflection>0)warnings.push('Bent centerline is an idealized DSM-II geometry. Impingement noise, shields, pad reflections and water suppression are not resolved.');
 return {...pre,receivers,warnings,version:'1.0.0'};
}
function selfCheck(){const W=10.58e6,Lw=db(W/1e-12);return {name:'NASA Stennis 2011, Table 3: acoustic power → sound power level',expected:190.25,actual:Lw,tolerance:.01,pass:Math.abs(Lw-190.25)<.01,scope:'Published numerical power-level check only; not receiver SPL validation.'};}
function benchmarkCase(){return {...defaults(),name:'Independent stationary verification case',notes:'Mathews Table 6.1 engine inputs. Fixed illustrative receivers; independent SciPy reference, not measured validation.',thrust:1915000,engines:2,velocity:3160,diameter:1.43,eta:.34,model:'modern',directivity:'modern',propagation:'saturn',receivers:[{name:'Near reference',x:200,y:300},{name:'Far reference',x:3000,y:5000}]};}
function numericalCheck(){const r=predict(benchmarkCase()),expected=[135.9223975574827,108.30280666637697];return r.receivers.map((p,i)=>({name:p.name,actual:p.oa,expected:expected[i],tolerance:.001,pass:Math.abs(p.oa-expected[i])<.001}));}
const api={defaults,validate,bandGrid,prepare,receive,predict,di,spectrum,loss,aWeight,path,integrateLog,norms,selfCheck,benchmarkCase,numericalCheck,db,pow,data,modern};if(node)module.exports=api;else root.RocketAcoustics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
