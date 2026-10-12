// Table editors are alternate views of the original portable text inputs.
const editorDefinitions = {
  sineText: ["Low Hz", "High Hz", "Unit", "Low level", "High level"],
  dwellText: ["Hz", "Peak g (0 = profile)", "Hour cap", "Cycle cap", "Repeats"],
  psdText: ["Hz", "g²/Hz"],
};
let previewTimer;
function editorRows(id) {
  return $(id).value.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#")).map(s=>s.includes(",")?s.split(",").map(v=>v.trim()):s.includes("\t")?s.split("\t"):s.split(/ +/));
}
function refreshInputEditors() {
  for(const [id,headers] of Object.entries(editorDefinitions)) {
    const host=$(id+"Editor"); if(!host)continue;
    const rows=editorRows(id);
    host.innerHTML=`<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}<th>Row</th></tr></thead><tbody>${rows.map((row,i)=>`<tr>${headers.map((_,j)=>`<td>${id==="sineText"&&j===2 ? `<select aria-label="${id} row ${i+1} unit" data-col="${j}">${!VDC.UNITS[row[j]]?`<option selected>${esc(row[j]??"")}</option>`:""}${Object.keys(VDC.UNITS).map(u=>`<option ${u===row[j]?"selected":""}>${u}</option>`).join("")}</select>` : `<input aria-label="${id} row ${i+1} ${headers[j]}" data-col="${j}" value="${esc(row[j]??"")}">`}</td>`).join("")}<td><button type="button" data-remove-row="${i}" aria-label="Remove ${id} row ${i+1}">×</button></td></tr>`).join("")}</tbody></table></div><button type="button" data-add-row>Add row</button>`;
    const update=()=>{ $(id).value=[...host.querySelectorAll("tbody tr")].map(tr=>[...tr.querySelectorAll("[data-col]")].map(el=>el.value).join(",")).join("\n"); stale(); };
    host.querySelectorAll("[data-col]").forEach(el=>el.addEventListener("input",update));
    host.querySelectorAll("[data-remove-row]").forEach(b=>b.onclick=()=>{b.closest("tr").remove();update();refreshInputEditors();});
    host.querySelector("[data-add-row]").onclick=()=>{const row=id==="sineText"?["","","accel_g_pk","",""]:id==="dwellText"?["","0","8","1000000","1"]:["",""];$(id).value+=( $(id).value.trim()?"\n":"")+row.join(",");stale();refreshInputEditors();};
  }
}
function scheduleInputPreview(){clearTimeout(previewTimer);previewTimer=setTimeout(renderInputPreview,200);}
function renderInputPreview(){
  const host=$("inputPreview");if(!host)return;
  try{
    const c=VDC.parse(raw());
    // Preview uses parsed inputs only; no fatigue calculation or result caching.
    const sine=[];for(const s of c.sine)for(let j=0;j<=20;j++){const f=s.f1*(s.f2/s.f1)**(j/20);sine.push([f,VDC.accel(f,s.unit,s.a1*(s.a2/s.a1)**(j/20))*c.sineScale]);}
    const make=(title,label,data)=>VDCReport.svg({title,label,meta:c.caseName,scope:"Input preview · not a calculated fatigue result",series:[{name:title,data}],xLabel:"Excitation frequency, Hz (log)",version:VDC.VERSION,generated:"input preview"});
    host.innerHTML='<p>Input format valid. Check shape and units before running.</p>'+make("Sine input preview","g peak (log)",sine)+make("Random input preview","g²/Hz (log)",c.psd.map(([f,p])=>[f,p*c.psdScale]));
  }catch(e){host.textContent="Input check: "+e.message;}
}
function initInputEditors(){
  for(const id of Object.keys(editorDefinitions)){
    const details=document.createElement("details");details.className="input-editor";details.innerHTML=`<summary>Edit rows in a table</summary><div id="${id}Editor"></div>`;$(id).after(details);
    $(id).addEventListener("input",()=>{refreshInputEditors();scheduleInputPreview();});
    $(id).addEventListener("paste",e=>{const text=e.clipboardData.getData("text");if(text.includes("\t")){e.preventDefault();$(id).setRangeText(text.replace(/\t/g,","),$(id).selectionStart,$(id).selectionEnd,"end");stale();refreshInputEditors();}});
  }
  const card=document.createElement("details");card.className="card";card.innerHTML='<summary>Preview input spectra &amp; check input format</summary><div class="input-preview" id="inputPreview"></div>';document.querySelector(".inputs").append(card);
  refreshInputEditors();scheduleInputPreview();
}
async function svgPNG(svg, scale=2){
  const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Could not render plot image."));img.src=url;});const canvas=document.createElement("canvas");canvas.width=1000*scale;canvas.height=620*scale;canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/png");}finally{URL.revokeObjectURL(url);}
}
function mountReportFigures(c,r){
  for(const f of VDCReport.figures(c,r,reportSettings({c,r}))){const svg=VDCReport.svg(f);chartRegistry[f.id]={...f,svg};$(f.id).innerHTML=svg;}
  document.querySelectorAll("[data-svg]").forEach(b=>b.onclick=()=>{if(last&&!busy&&!exportBusy)download(caseFilename(b.dataset.svg,"svg"),chartRegistry[b.dataset.svg].svg,"image/svg+xml");});
  document.querySelectorAll("[data-png]").forEach(b=>b.onclick=async()=>{if(!last||busy||exportBusy)return;const name=caseFilename(b.dataset.png,"png"),svg=chartRegistry[b.dataset.png].svg;b.disabled=true;try{const data=await svgPNG(svg);const a=document.createElement("a");a.href=data;a.download=name;a.click();}catch(e){$("status").textContent=e.message;}finally{b.disabled=!last;}});
}
