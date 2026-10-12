// Offline PowerPoint exporter. Native text/tables are editable; charts use PNGs.
async function exportPowerPoint(){
  if(busy||exportBusy||!selectedCases().length||readyCases().length!==selectedCases().length)return;
  const entries=clone(readyCases()),title=study.title,settings=reportSettings(),appendix=$("includeAppendix").checked;
  exportBusy=true;refreshCollection();
  try{
    const deck=new PptxGenJS();deck.layout="LAYOUT_WIDE";deck.author="Vibration Damage Comparison";deck.subject="Recorded sine/random exposure comparisons";deck.title=title;deck.company="";deck.lang="en-US";
    deck.theme={headFontFace:"Arial",bodyFontFace:"Arial",lang:"en-US"};
    const navy="172D40",teal="087F83",red="A93636",muted="496174";
    let page=0;
    const txt=(slide,text,x,y,w,h,size=16,opts={})=>slide.addText(String(text),{x,y,w,h,fontFace:"Arial",fontSize:size,color:navy,margin:0,breakLine:false,valign:"top",...opts});
    const slide=(heading,sub)=>{const s=deck.addSlide();s.background={color:"FFFFFF"};s.addShape(deck.ShapeType.rect,{x:0,y:0,w:13.333,h:.12,line:{color:teal},fill:{color:teal}});txt(s,heading,.4,.3,12.5,.75,heading.length>90?22:24,{bold:true,fit:"shrink"});txt(s,sub,.4,1.05,12.5,.36,12,{color:muted,fit:"shrink"});txt(s,`Vibration comparison · engine ${VDC.VERSION} · analytical comparison, not qualification approval`,.4,7.1,11.8,.2,9,{color:muted});txt(s,++page,12.4,7.07,.5,.25,10,{align:"right"});return s;};
    const table=(s,rows,x,y,w,colW,fontSize=13)=>s.addTable(rows.map((row,i)=>row.map(text=>({text:String(text??""),options:{bold:i===0,color:i===0?"FFFFFF":navy,fill:i===0?navy:(i%2?"F0F5F7":"FFFFFF")}}))),{x,y,w,colW,fontFace:"Arial",fontSize,border:{type:"solid",pt:.5,color:"D7E2E8"},margin:.08,autoPage:false,rowH:.43,verbose:false});
    const note=(s,e)=>s.addNotes(`Case ${e.id}, revision ${e.revision}\nEngine ${e.result.r.version}; calculated ${e.result.r.generated}\n\nExact input record\n${JSON.stringify(e.result.inputs,null,2)}\n\nPeak-factor guidance\n${VDCReport.peakBasis(e.result.c,e.result.r)}\nVRS: https://www.vibrationdata.com/VRS.htm\nPeak response: https://www.vibrationdata.com/tutorials2/peak_response_random_revisionH.pdf\n\nCalculated interpretation\n${JSON.stringify(VDCReport.summary(e.result.c,e.result.r),null,2)}\n\nReview notes\n${e.result.r.warnings.join("\n")}\n\nNumerical refinement: ${e.result.r.convergence*100}% relative change. Refine frequency grid separately.\n\nAnalyst interpretation\n${e.result.c.analystNotes||"Not supplied."}`);
    const short=(v,n)=>String(v).length>n?String(v).slice(0,n-1)+"…":String(v);
    const chunks=(lines,size)=>Array.from({length:Math.ceil(lines.length/size)},(_,i)=>lines.slice(i*size,(i+1)*size));
    for(const group of chunks(entries,7)){
      const s=slide(title,"Collection summary · fatigue and peak screens are independent · coverage target = 1");
      table(s,[["Case / specification pair","Dwell / scope","Fatigue minimum","Peak minimum"],...group.map(e=>{const {c,r}=e.result;return [`${e.id} · ${short(c.caseName,45)}\n${short((c.sineName||"Sine unnamed")+" / "+(c.randomName||"Random unnamed"),70)}`,`${c.dwellMode==="assumed"?"Assumed resonances":"Documented"}\n${c.scope==="bank"?"Full bank":"Listed modes only"}`,`${VDCReport.num(r.worst.margin)}× at ${VDCReport.num(r.worst.fn)} Hz\n${r.worst.margin>=1?"Target met":"Coverage gap"}`,`${VDCReport.num(r.peakWorst.peakRatio)}× at ${VDCReport.num(r.peakWorst.fn)} Hz\n${VDCReport.peakLabel(c)}`];})],.4,1.55,12.5,[5,2.3,2.6,2.6],11);
      txt(s,"Full labels, scope, assumptions and evidence are in the individual cases and slide notes. Cases are independent; coverage ratios are never summed across frequencies or cases.",.4,6.55,12.3,.4,13);
      s.addNotes(entries.map(e=>`${e.id}: ${e.inputs.caseName}; revision ${e.revision}; calculated ${e.result.r.generated}`).join("\n"));
    }
    for(const e of entries){
      $("collectionMessage").textContent=`Preparing PowerPoint: ${e.id}…`;
      const {c,r}=e.result,summary=VDCReport.summary(c,r),figs=VDCReport.figures(c,r,settings);
      const images={};for(const f of figs.filter(f=>!["damagePlot","responsePlot"].includes(f.id)))images[f.id]=await svgPNG(VDCReport.svg(f),2);
      const input=slide(`${e.id} · ${c.caseName}`,`Inputs · ${c.example?"EXAMPLE · ":""}${summary.dwell}`);
      table(input,[["Sine specification / exposure","Random specification / exposure","Shared model / assessment"],[`${VDCReport.wrap(c.sineName||"Not identified",40).join("\n")}\n${c.passes} traversals; ${c.sweepRate} ${c.sweepType==="oct"?"oct/min":"Hz/min"}; scale ${c.sineScale}×`,`${VDCReport.wrap(c.randomName||"Not identified",40).join("\n")}\n${VDCReport.num(c.T/60)} min total; ${c.psdDb} dB; ${VDCReport.num(r.grms)} gRMS`,`Q ${c.Q}; b ${c.b}; ${c.method}; target ${c.damageFactor}\n${c.scope==="bank"?`${c.fmin}–${c.fmax} Hz bank`:"Listed modes (see slide notes)"}; ${VDCReport.peakLabel(c)}`]],.4,1.6,12.5,[4.2,4.2,4.1],13);
      const chartTop=Math.max(3.05,2.6+Math.max(VDCReport.wrap(c.sineName||"",40).length,VDCReport.wrap(c.randomName||"",40).length)*.22),chartH=7-chartTop,chartW=chartH/0.62;
      input.addImage({data:images.sinePlot,x:.25+(6.4-chartW)/2,y:chartTop,w:chartW,h:chartH,altText:"Sine input profile with units and specification label"});input.addImage({data:images.psdPlot,x:6.68+(6.4-chartW)/2,y:chartTop,w:chartW,h:chartH,altText:"Random input PSD with exposure and gRMS"});note(input,e);
      const pairSlide=(heading,left,right,takeaway,definition)=>{
        const s=slide(`${e.id} · ${c.caseName}`,heading);
        s.addImage({data:images[left],x:.25,y:1.6,w:6.4,h:3.968,altText:figs.find(f=>f.id===left).title});
        s.addImage({data:images[right],x:6.68,y:1.6,w:6.4,h:3.968,altText:figs.find(f=>f.id===right).title});
        txt(s,takeaway,.4,5.75,12.4,.48,19,{bold:true,fit:"shrink"});
        txt(s,definition,.4,6.27,12.4,.62,13,{fit:"shrink"});note(s,e);return s;
      };
      pairSlide("Sine source check · the same base input in two unit conventions", "sinePlot", "sineDisplacementPlot",
        `Double amplitude = peak-to-peak displacement; sine scale = ${c.sineScale}×`,"DA inches = 2 × g peak × 9.80665 / [(2πf)² × 0.0254]. These are base-input profiles; dwell overrides remain separate.");
      pairSlide(`Fatigue · ${c.scope==="modes"?"listed modes only":"oscillator bank"} · ${settings.coverageLimits?"common coverage axes":"per-case coverage axes"}`, "fatigueComparePlot", "ratioPlot", summary.fatigue,
        `R = sine damage / random damage. Fatigue coverage = R / F, with F = ${c.damageFactor}. The left random curve includes F. Target = 1. Analyst interpretation: ${short(c.analystNotes||"Not supplied.",180)}`);
      pairSlide("Peak comparison · same relative-displacement response and Q on both sides", "peakResponsePlot", "peakPlot", summary.peak,
        `Peak coverage = sine peak / random peak estimate. The RMS VRS is context, not a peak. ${VDCReport.peakCaption(c)} ${r.warnings.length} review note(s) in slide notes.`);
      if(appendix){
        const detail=slide(`${e.id} · sensitivity and peak screen`,"Sensitivity scenarios are not confidence bounds. Peak screening does not establish fatigue coverage.");
        detail.addImage({data:images.peakPlot,x:.2,y:1.6,w:7.9,h:4.898,altText:summary.peak});
        const bs=[...new Set(r.sensitivity.map(v=>v.b))],qs=[...new Set(r.sensitivity.map(v=>v.Q))];
        table(detail,[["Q",...bs.map(b=>`b = ${b}`)],...qs.map(q=>[q,...bs.map(b=>{const v=r.sensitivity.find(v=>v.Q===q&&v.b===b);return `${VDCReport.num(v.margin)}×\n${VDCReport.num(v.fn)} Hz`;})])],8.25,1.65,4.65,[.55,...bs.map(()=>4.1/bs.length)],11);
        txt(detail,"Each cell: minimum R / target and governing frequency.",8.25,6.25,4.65,.5,12);note(detail,e);
        const lines=[...VDCReport.specs(c,r).flatMap(([a,b])=>VDCReport.wrap(`${a}: ${b}`,105)),"",...VDCReport.wrap("Evidence and assumptions: "+(c.basis||"Not supplied."),105),"",...r.warnings.flatMap(v=>VDCReport.wrap("Review: "+v,105)),"",...VDCReport.wrap("Analyst interpretation: "+(c.analystNotes||"Not supplied."),105)];
        for(const [index,part] of chunks(lines,19).entries()){const s=slide(`${e.id} · review record ${index+1}`,"Exact source inputs remain in slide notes and collection JSON.");txt(s,part.join("\n"),.5,1.6,12.2,5.25,16,{breakLine:false,paraSpaceAfterPt:3});note(s,e);}
      }
    }
    const blob=await deck.write({outputType:"blob",compression:true});download(`${VDCReport.slug(title)}-comparison.pptx`,blob,"application/vnd.openxmlformats-officedocument.presentationml.presentation");
    $("collectionMessage").textContent=`PowerPoint exported: ${page} slides for ${entries.length} cases. Exact inputs and review notes are in slide notes.`;
  }catch(e){$("collectionMessage").textContent="PowerPoint export failed: "+e.message;console.error(e);}finally{exportBusy=false;refreshCollection();}
}
$("exportPptx").onclick=exportPowerPoint;
