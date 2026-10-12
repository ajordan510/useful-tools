// A collection stores independent input snapshots. Cached results are session-only;
// opening a saved collection always requires recalculation with the current engine.
let study = { title: "Vibration comparison study", cases: [], next: 1 };
let activeCaseId = null, collectionReady = false, removedCase = null, exportBusy = false;
const clone = (x) => JSON.parse(JSON.stringify(x));
function activeCase() { return study.cases.find((c) => c.id === activeCaseId); }
function makeCase(inputs) {
  const entry = {id: `C${String(study.next++).padStart(2,"0")}`, inputs: clone(inputs), included: true, revision: 1, result: null};
  study.cases.push(entry); return entry;
}
function invalidateCase() {
  if (!collectionReady) return;
  const entry = activeCase(); entry.inputs = raw(); entry.result = null; entry.revision++;
  refreshCollection(); scheduleInputPreview();
}
function recordCase(result) {
  const entry = activeCase(); entry.inputs = clone(result.inputs); entry.result = result;
  refreshCollection();
}
function caseFilename(kind, extension, entry = activeCase()) {
  return `${entry.id}-${VDCReport.slug(entry.inputs.caseName)}-r${entry.revision}-${kind}.${extension}`;
}
function setActiveCase(entry) {
  if (busy || exportBusy) return;
  activeCaseId = entry.id;
  for (const k of ids) $(k).value = entry.inputs[k] ?? defaults[k];
  $("methodSelect").value = entry.inputs.method ?? defaults.method;
  example = !!entry.inputs.example; syncDwellMode(); refreshInputEditors();
  last = entry.result;
  if (last) {
    render(last.c, last.r); $("results").style.opacity = "1";
    $("status").className = "notice"; $("status").textContent = `${entry.id}: saved session results restored.`;
  } else {
    chartRegistry = {};
    $("results").innerHTML = '<div class="card"><h2>Ready to compare</h2><p>Check the inputs, then run this case. Results stay with their case when you switch.</p></div>';
    $("results").style.opacity = "1";
    $("status").textContent = `${entry.id}: run comparison to calculate these inputs.`;
  }
  $("csv").disabled = $("report").disabled = !last;
  refreshCollection(); scheduleInputPreview();
}
function selectedCases() { return study.cases.filter((x) => x.included); }
function readyCases() { return selectedCases().filter((x) => x.result); }
function reportSettings(extra) {
  const runs=readyCases().map(x=>x.result);if(extra&&!runs.some(x=>x.r===extra.r))runs.push(extra);
  return {crosscheck: $("showCrosscheck").checked,
    ...($("commonAxes").checked && runs.length ? VDCReport.commonLimits(runs, $("showCrosscheck").checked) : {})};
}
function refreshCollection() {
  if (!collectionReady) return;
  const current = activeCase();
  $("activeCase").innerHTML = study.cases.map((x)=>`<option value="${x.id}">${x.id} · ${esc(x.inputs.caseName || "Untitled case")}${x.result?"":" · not calculated"}</option>`).join("");
  $("activeCase").value = current.id;
  $("studyTable").innerHTML = study.cases.map((x)=>{
    const s=x.result ? VDCReport.summary(x.result.c,x.result.r) : null;
    return `<tr><td><input type="checkbox" aria-label="Include ${x.id} in report" data-include="${x.id}" ${x.included?"checked":""}/></td><td><button data-open-case="${x.id}">${x.id}: ${esc(x.inputs.caseName || "Untitled case")}</button></td><td>${esc(x.inputs.sineName || "Unnamed sine")}<br>${esc(x.inputs.randomName || "Unnamed random")}</td><td>${x.inputs.dwellMode === "assumed"?"Assumed resonances":"Documented"}</td><td>${s ? esc(s.fatigue):"Run required"}</td><td>${s ? esc(s.peak):"—"}</td></tr>`;
  }).join("");
  document.querySelectorAll("[data-open-case]").forEach((b)=>b.onclick=()=>{setActiveCase(study.cases.find((x)=>x.id===b.dataset.openCase));document.querySelector('[data-tab="analysis"]').click();});
  document.querySelectorAll("[data-include]").forEach((b)=>b.onchange=()=>{study.cases.find((x)=>x.id===b.dataset.include).included=b.checked;refreshCollection();if(last)render(last.c,last.r);});
  const selected=selectedCases(), ready=readyCases();
  $("collectionStatus").textContent = `${study.cases.length} case(s) · ${selected.length} included · ${ready.length} calculated. Save collection JSON before closing; results are recalculated when reopened.`;
  const disabled=busy || exportBusy || !selected.length || ready.length!==selected.length;
  for (const id of ["exportPptx","exportStudyReport","exportStudyCSV"]) $(id).disabled=disabled;
  for (const id of ["activeCase","newCase","duplicateCase","removeCase","runAllCases","saveStudy","loadStudy","loadCase","demo","referenceCase"]) $(id).disabled=busy||exportBusy;
  document.querySelectorAll('.inputs input,.inputs select,.inputs textarea,.inputs button,[data-include],[data-open-case],[data-svg],[data-png]').forEach(el=>el.disabled=busy||exportBusy);
  $("run").disabled=busy||exportBusy;
  $("csv").disabled=$("report").disabled=busy||exportBusy||!last;
  for(const id of ["saveCase","studyTitle","includeAppendix","commonAxes","showCrosscheck"])$(id).disabled=busy||exportBusy;
  if(!busy&&!exportBusy){syncDwellMode();if(!last)document.querySelectorAll('[data-svg],[data-png]').forEach(el=>el.disabled=true);}
  $("undoRemove").disabled=!removedCase||study.cases.length>=30||busy||exportBusy;
}
function addStudyCase(duplicate) {
  if (busy || exportBusy) return;
  if(study.cases.length>=30){$("status").textContent="Collection limit reached (30 cases). Save this collection before starting another.";return;}
  const inputs=duplicate ? clone(raw()) : {...defaults,caseName:"New comparison",sineName:"",randomName:"",analystNotes:"",basis:"",sineText:"",psdText:"",dwellText:"",example:false};
  if (duplicate) inputs.caseName=(inputs.caseName+" copy").slice(0,120);
  setActiveCase(makeCase(inputs)); document.querySelector('[data-tab="analysis"]').click();
}
async function runAllCases() {
  if (busy || exportBusy) return;
  busy=true;refreshCollection();const failures=[];
  try {
    for (const entry of selectedCases()) {
      $("collectionStatus").textContent=`Calculating ${entry.id}…`;
      await new Promise((resolve)=>setTimeout(resolve,30));
      try { const inputs=clone(entry.inputs),c=VDC.parse(inputs),r=VDC.analyze(c); entry.result={inputs,c,r}; }
      catch(e){entry.result=null;failures.push(`${entry.id}: ${e.message}`);}
    }
  } finally {busy=false;setActiveCase(activeCase());refreshCollection();}
  $("collectionMessage").textContent=failures.length ? failures.join("\n") : "All included cases calculated. Ready to export.";
}
function cleanStudy(x) {
  if (x.schema!=="vdc-study-1" || !Array.isArray(x.cases) || !x.cases.length || x.cases.length>30) throw Error("Expected a vdc-study-1 collection with 1–30 cases.");
  if(typeof x.title!=="string" || x.title.length>120) throw Error("Collection title must be 120 characters or fewer.");
  const seen=new Set();
  const cases=x.cases.map((entry)=>{
    if(!/^C\d{2,6}$/.test(entry.id)||+entry.id.slice(1)>999900||seen.has(entry.id))throw Error("Case IDs must be unique C-prefixed numbers.");seen.add(entry.id);
    if(!entry.inputs || typeof entry.inputs!=="object")throw Error(`Missing inputs for ${entry.id}.`);
    const inputs={};
    for(const key of [...ids,"method"]) {
      const v=entry.inputs[key]??defaults[key];
      if(!["string","number"].includes(typeof v)||String(v).length>100000)throw Error(`Invalid ${key} in ${entry.id}.`);
      inputs[key]=v;
    }
    for(const key of ["caseName","sineName","randomName"])if(String(inputs[key]).length>120)throw Error(`${key} must be 120 characters or fewer.`);
    if(String(inputs.analystNotes).length>4000)throw Error("Analyst interpretation must be 4000 characters or fewer.");
    inputs.example=!!entry.inputs.example;
    return {id:entry.id,inputs,included:entry.included!==false,revision:Number.isSafeInteger(entry.revision)&&entry.revision>0?entry.revision:1,result:null};
  });
  return {title:x.title,cases,next:Math.max(...cases.map((c)=>+c.id.slice(1)))+1};
}
function studyJSON() {
  return JSON.stringify({schema:"vdc-study-1",version:VDC.VERSION,title:study.title,
    cases:study.cases.map(({id,inputs,included,revision})=>({id,inputs,included,revision}))},null,2);
}
function snapshotRows(run) {
  const {c,r}=run,s=VDCReport.summary(c,r);
  return `<div class="takeaway"><h2>${esc(s.fatigue)}</h2><p>${esc(s.peak)}</p><p>${esc(s.scope)}. ${esc(s.dwell)}.</p><p><b>Sampled fatigue gaps:</b> ${esc(s.gaps)}</p>${s.noDwell?`<p>${s.noDwell} assessed frequencies have no assumed dwell credit outside the sine profile.</p>`:""}<p><b>Analyst interpretation:</b> ${esc(c.analystNotes||"Not supplied.")}</p></div>`;
}
function compactReport(entries, title, appendices=false) {
  const settings=reportSettings();
  const table=(rows)=>`<table>${rows.map((r)=>`<tr>${r.map((v)=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table>`;
  const body=entries.map((entry)=>{
    const {c,r}=entry.result,figs=VDCReport.figures(c,r,settings);
    return `<section class="case"><h1>${entry.id} · ${esc(c.caseName)}</h1>${snapshotRows(entry.result)}${table(VDCReport.specs(c,r))}<div class="pair">${figs.filter((f)=>["sinePlot","psdPlot"].includes(f.id)).map((f)=>VDCReport.svg(f)).join("")}</div>${[["fatigueComparePlot","ratioPlot"],["peakResponsePlot","peakPlot"]].map(pair=>`<div class="pair">${pair.map(id=>VDCReport.svg(figs.find(f=>f.id===id))).join("")}</div>`).join("")}${VDCReport.svg(figs.find(f=>f.id==="sineDisplacementPlot"))}<h2>Peak-factor basis</h2><p>${esc(VDCReport.peakBasis(c,r))}</p><h2>Evidence and assumptions</h2><p>${esc(c.basis||"Not supplied.")}</p><h2>Review notes</h2><ul>${r.warnings.map((s)=>`<li>${esc(s)}</li>`).join("")}</ul><p>Engine ${r.version} · calculated ${esc(r.generated)} · case revision ${entry.revision}</p>${appendices?`<h2>Complete input record</h2>${table(Object.entries(entry.result.inputs))}<h2>Sensitivity</h2>${table([["Q","b","Minimum coverage","Hz"],...r.sensitivity.map((s)=>[s.Q,s.b,VDCReport.num(s.margin),VDCReport.num(s.fn)])])}<h2>Assessment data</h2>${table([["Hz","Coverage","Peak ratio"],...r.assessed.map((s)=>[s.fn,s.margin,s.peakRatio])])}`:""}</section>`;
  }).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.5 Arial;color:#172d40;max-width:1100px;margin:30px auto;padding:0 22px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border-bottom:1px solid #d7e2e8;text-align:left;padding:8px;overflow-wrap:anywhere}td:first-child{font-weight:bold;width:28%}.takeaway{border-left:4px solid #087f83;padding:8px 20px;background:#f6fbfb}h1{font-size:28px}h2{font-size:20px}p,li{white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;height:auto}.pair{display:grid;grid-template-columns:1fr 1fr}.case{margin:45px 0;border-top:2px solid #172d40;padding-top:20px}@media print{.case{break-before:page}.takeaway,svg,tr{break-inside:avoid}body{margin:0}h1,h2{break-after:avoid}.pair{display:block}}@media(max-width:650px){.pair{display:block}}</style><h1>${esc(title)}</h1><p>Calculated exposure comparisons. Fatigue coverage and peak screening are separate. These comparisons do not establish qualification approval.</p>${table([["Case","Fatigue coverage","Peak screen"],...entries.map((e)=>[e.id+": "+e.inputs.caseName,VDCReport.summary(e.result.c,e.result.r).fatigue,VDCReport.summary(e.result.c,e.result.r).peak])])}${body}<section class="case"><h2>Method and interpretation</h2><p>Each specification is filtered through the same relative-displacement SDOF. Sine cycle damage is compared with the selected stationary Gaussian random-fatigue model. Coverage is sine/random damage divided by the required damage factor. Known-mode dots identify assessed frequencies; connecting curves are context. Assumed dwell scenarios are independent and never summed across oscillators. See the tool's Method &amp; interpretation tab for equations and references. Exact inputs are preserved in the collection JSON. Detailed data remain available as case CSV files.</p></section></html>`;
}
function initCollection() {
  const entry=makeCase(raw());activeCaseId=entry.id;collectionReady=true;
  $("activeCase").onchange=()=>setActiveCase(study.cases.find((x)=>x.id===$("activeCase").value));
  $("newCase").onclick=()=>addStudyCase(false);$("duplicateCase").onclick=()=>addStudyCase(true);
  $("removeCase").onclick=()=>{if(busy||exportBusy)return;const i=study.cases.indexOf(activeCase());removedCase={entry:activeCase(),i};study.cases.splice(i,1);if(!study.cases.length)makeCase({...defaults,caseName:"New comparison"});setActiveCase(study.cases[Math.min(i,study.cases.length-1)]);};
  $("undoRemove").onclick=()=>{if(!removedCase||study.cases.length>=30||busy||exportBusy)return;const {entry,i}=removedCase;study.cases.splice(i,0,entry);removedCase=null;setActiveCase(entry);};
  $("studyTitle").oninput=()=>study.title=$("studyTitle").value;
  $("runAllCases").onclick=runAllCases;
  $("saveStudy").onclick=()=>download(`${VDCReport.slug(study.title)}-collection.json`,studyJSON(),"application/json");
  $("loadStudy").onchange=async(e)=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10e6)throw Error("Collection is too large (10 MB limit).");const imported=cleanStudy(JSON.parse(await file.text()));study=imported;removedCase=null;$("studyTitle").value=study.title;setActiveCase(study.cases[0]);$("collectionMessage").textContent="Collection opened. Run all included cases to calculate current results.";}catch(err){$("collectionMessage").textContent=err.message;}e.target.value="";};
  $("exportStudyReport").onclick=()=>{if($("exportStudyReport").disabled)return;download(`${VDCReport.slug(study.title)}-report.html`,compactReport(readyCases(),study.title,$("includeAppendix").checked),"text/html");};
  $("report").onclick=()=>{if(last)download(caseFilename("report","html"),compactReport([activeCase()],last.c.caseName,$("includeAppendix").checked),"text/html");};
  $("exportStudyCSV").onclick=()=>{if($("exportStudyCSV").disabled)return;const q=(s)=>'"'+String(s).replace(/"/g,'""')+'"';const rows=[["Case ID","Case name","Sine specification","Random specification","Dwell mode","Scope","Fatigue coverage","Fatigue Hz","Peak coverage","Peak Hz","Peak model","Non-exceedance % per oscillator","Total random seconds","Governing peak factor k","Analyst interpretation"],...readyCases().map((e)=>{const {c,r}=e.result;return [e.id,c.caseName,c.sineName,c.randomName,c.dwellMode,c.scope,r.worst.margin,r.worst.fn,r.peakWorst.peakRatio,r.peakWorst.fn,c.peakMode,c.peakMode==="extreme"?c.peakProbability:"not assigned",c.T,r.peakWorst.effectivePeakFactor,c.analystNotes];})];download(`${VDCReport.slug(study.title)}-summary.csv`,rows.map((r)=>r.map(q).join(",")).join("\n"),"text/csv");};
  $("resultsOnly").onchange=()=>document.querySelector(".layout").classList.toggle("results-only",$("resultsOnly").checked);
  for(const id of ["showCrosscheck","commonAxes"])$(id).onchange=()=>{if(last)render(last.c,last.r);};
  refreshCollection();
}
