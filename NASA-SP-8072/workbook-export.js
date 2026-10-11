/* Native XLSX snapshot exporter. Layout/styles authored with artifact-tool;
 * calculations are the unchanged prediction results, stored as numeric cells.
 * Uses a standards-compliant uncompressed ZIP to keep the HTML self-contained.
 */
(function(root){
'use strict';
const xml=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const col=i=>String.fromCharCode(65+i);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function zip(files){
 const enc=new TextEncoder(),local=[],central=[];let offset=0,size=0;
 for(const [name,text] of Object.entries(files)){
  const filename=enc.encode(name),data=enc.encode(text),checksum=crc(data);
  const entry=new Uint8Array(30+filename.length+data.length),a=new DataView(entry.buffer);
  a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0x800,true);a.setUint16(12,33,true);
  a.setUint32(14,checksum,true);a.setUint32(18,data.length,true);a.setUint32(22,data.length,true);a.setUint16(26,filename.length,true);
  entry.set(filename,30);entry.set(data,30+filename.length);local.push(entry);
  const dir=new Uint8Array(46+filename.length),b=new DataView(dir.buffer);
  b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);b.setUint16(8,0x800,true);b.setUint16(14,33,true);
  b.setUint32(16,checksum,true);b.setUint32(20,data.length,true);b.setUint32(24,data.length,true);b.setUint16(28,filename.length,true);b.setUint32(42,offset,true);
  dir.set(filename,46);central.push(dir);offset+=entry.length;size+=dir.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,local.length,true);e.setUint16(10,local.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let pos=0;for(const a of [...local,...central,end]){out.set(a,pos);pos+=a.length;}return out;
}
function worksheet(template,spec,rows,filterEnd){
 const data=rows.map((row,i)=>{
  const r=i+1,height=r===7?34:r>7&&spec.headers.length===3?Math.min(150,Math.max(22,Math.ceil(Math.max(String(row[1]??'').length/65,String(row[2]??'').length/50))*15)):22;
  const cells=row.map((v,j)=>{
   if(v==null)return '';
   const addr=col(j)+r,style=spec.styles[col(j)+Math.min(r,8)]||spec.styles['A8']||'0';
   if(typeof v==='number'&&Number.isFinite(v))return `<x:c r="${addr}" s="${style}"><x:v>${v}</x:v></x:c>`;
   if(typeof v==='boolean')return `<x:c r="${addr}" s="${style}" t="b"><x:v>${Number(v)}</x:v></x:c>`;
   // Inline strings remain literal even when a receiver name begins with '='.
   return `<x:c r="${addr}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${xml(v)}</x:t></x:is></x:c>`;
  }).join('');
  return `<x:row r="${r}" ht="${height}" customHeight="1">${cells}</x:row>`;
 }).join('');
 return template.replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/,`<x:sheetData>${data}</x:sheetData><x:autoFilter ref="A7:${col(spec.headers.length-1)}${filterEnd}"/>`);
}
function create(result,engine,template,references=[],timestamp=new Date().toISOString()){
 const r=result,c=r.c,headers=template.sheets.map(s=>s.headers);
 const preamble=[['Rocket Acoustics Workbench · '+r.version],[c.name],['Snapshot exported '+timestamp+'; recalculate in the HTML tool to update.'],['Nozzle exit (0, 0); exhaust initially +x; receivers in the y ≥ 0 plane.'],[`Selected band edges: ${r.bands[0].lo.toPrecision(7)}–${r.bands.at(-1).hi.toPrecision(7)} Hz. Levels re 20 µPa; source power levels re 1 pW.`],[]];
 const summary=[...preamble,headers[0],...r.receivers.map(p=>[p.name,p.x,p.y,p.oa,p.la,p.design,p.rms,p.peak,p.minR,p.minTheta,p.maxTheta])];
 const bands=[...preamble,headers[1]];
 for(const p of r.receivers)r.bands.forEach((b,i)=>bands.push([p.name,p.x,p.y,b.f,b.lo,b.hi,p.levels[i],engine.db(r.bandPower[i]/1e-12),engine.aWeight(b.f),p.levels[i]+c.margin,p.oa,p.la,p.rms]));
 const units={thrust:'N per engine',velocity:'m/s',diameter:'m per nozzle',mach:'dimensionless',engines:'count',eta:'percent',reflection:'dB',margin:'dB; user allowance, not statistical uncertainty',fmin:'Hz; nominal lowest center',fmax:'Hz; nominal highest center',slices:'count; DSM-II',deflection:'m; 0 disables bend',bend:'degrees toward +y',c0:'m/s',normalize:'normalize spectral energy',terminate:'terminate core at deflector',cluster:'engine clustering convention',model:'prediction model',core:'DSM-II core formulation',directivity:'angular radiation model',propagation:'propagation correction'};
 const inputs=[...preamble,headers[2],...Object.entries(c).filter(([k])=>k!=='receivers').map(([k,v])=>[k,v,units[k]||'']),
  ['Derived acoustic power',r.W,'W'],['Derived acoustic power level',r.Lw,'dB re 1 pW'],['Effective diameter',r.D,'m'],['Core length',r.core??'Not applicable','m; DSM-II'],['Band power fraction',r.capture,'fraction of total source power'],['Band count',r.bands.length,'count'],['Receiver count',r.receivers.length,'count'],
  ['Verification','Numerical/software verification only. No end-to-end experimental validation for this engine/facility.',''],
  ...r.warnings.map((w,i)=>['Model warning '+(i+1),w,'']),
  ['Case JSON',JSON.stringify(c),'Complete SI case; import with Open case after saving as JSON.'],
  ...references.map((v,i)=>['Reference '+(i+1),v.title,v.url]),
  ['Attribution','Modern components adapted from Logan T. Mathews’ SATURN, Apache-2.0.','Commit 7c6d1c3b38ebb32512f704fb281d7516b73fd9d6'],
  ['Curve data','SP-8072 curves are approximate manual readings.','See Approach & research in the HTML tool.']];
 const files={...template.files};
 [summary,bands,inputs].forEach((rows,i)=>{const spec=template.sheets[i];files[spec.file]=worksheet(files[spec.file],spec,rows,rows.length);});
 return zip(files);
}
root.RocketWorkbook={create};
})(typeof window==='undefined'?globalThis:window);
