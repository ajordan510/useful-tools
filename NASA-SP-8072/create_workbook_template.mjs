// Development-only authoring. Runtime exports fill this styled template offline.
import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const wb=Workbook.create();
const specs=[
 ['Summary',['Receiver','Axial x (m)','Transverse y (m)','Overall (dB)','A-weighted (dBA)','Design (dB)','RMS pressure (Pa)','Peak band (Hz)','Nearest source (m)','Min. angle (deg)','Max. angle (deg)']],
 ['Bands',['Receiver','Axial x (m)','Transverse y (m)','Center (Hz)','Lower edge (Hz)','Upper edge (Hz)','SPL (dB)','Source PWL (dB)','A-weight (dB)','Design (dB)','Overall (dB)','A-weighted (dBA)','RMS pressure (Pa)']],
 ['Inputs',['Setting / reference','Value','Unit / interpretation']]
];
for(const [name,headers] of specs){
 const sh=wb.worksheets.add(name),last=String.fromCharCode(64+headers.length);
 sh.showGridLines=false;sh.freezePanes.freezeRows(7);sh.tabColor='#007d83';
 sh.getRange(`A1:${last}8`).format.font={name:'Arial',size:10,color:'#1B303D'};
 sh.getRange(`A1:${last}8`).format.rowHeight=22;
 sh.getRange(`A1:${last}8`).format.columnWidth=18;
 sh.getRange('A1:A8').format.columnWidth=30;
 sh.getRange('A1').values=[['Rocket Acoustics Workbench']];
 sh.getRange('A1').format.font={name:'Arial',size:14,bold:true,color:'#005E63'};
 sh.getRange('A2').values=[['Illustrative prediction']];
 sh.getRange('A3').values=[['Static result snapshot. Recalculate in the HTML tool to update.']];
 sh.getRange('A4').values=[['All coordinates are in meters; nozzle exit is (0, 0); exhaust initially follows +x.']];
 sh.getRange('A5').values=[['Overall levels cover only the selected frequency bands.']];
 sh.getRange(`A7:${last}7`).values=[headers];
 sh.getRange(`A7:${last}7`).format={fill:'#172A37',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:34};
 sh.getRange(`A8:${last}8`).values=[headers.map((_,i)=>i?'Example value':'R1')];
 if(name!=='Inputs'){
  sh.getRange(`B8:${last}8`).values=[headers.slice(1).map((_,i)=>i<2?100:120.12345)];
  sh.getRange(`B8:${last}8`).setNumberFormat('0.00');
  sh.getRange(name==='Summary'?'G8':'M8').setNumberFormat('0.0000E+00');
 }else{
  sh.getRange('A1:A8').format.columnWidth=34;
  sh.getRange('B1:B8').format.columnWidth=70;
  sh.getRange('C1:C8').format.columnWidth=55;
  sh.getRange('B8:C8').format.wrapText=true;
 }
}
wb.recalculate();
console.log((await wb.inspect({kind:'region',sheetId:'Summary',range:'A7:K8',maxChars:1800,tableMaxCols:11})).ndjson);
await fs.mkdir(new URL('./_qa/',import.meta.url),{recursive:true});
for(const [name] of specs){
 const p=await wb.render({sheetName:name,range:name==='Inputs'?'A1:C8':'A1:G8',scale:1.3,format:'png'});
 await fs.writeFile(new URL(`./_qa/template-${name}.png`,import.meta.url),new Uint8Array(await p.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(new URL('./_qa/workbook-template.xlsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
