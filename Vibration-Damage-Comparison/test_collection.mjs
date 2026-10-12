import {createRequire} from 'node:module';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),JSZip=require('jszip');
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'_paper_build','collection');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
await page.goto(new URL('vibration_damage_comparison.html',import.meta.url).href);
const tab=async id=>page.click(`[data-tab="${id}"]`);
const settle=async()=>page.waitForFunction(()=>!busy&&!exportBusy);
const run=async()=>{await tab('analysis');await page.click('#run');await settle();assert.ok(await page.evaluate(()=>!!last),await page.locator('#status').innerText());};
const save=async(selector,name)=>{const pending=page.waitForEvent('download',{timeout:90000});await page.click(selector);const d=await pending;await d.saveAs(path.join(out,name));return d.suggestedFilename();};
await page.click('#referenceCase');await settle();
await page.fill('#caseName','Bracket X — baseline');await page.fill('#sineName','Common sine • Rev A');await page.fill('#randomName','Launch random • Rev B');await page.fill('#analystNotes','Fatigue coverage meets the target at the listed mode. Review the separate peak screen before disposition.');await run();
const original=await page.evaluate(()=>({inputs:raw(),ratio:last.r.worst.margin}));
assert.equal(await page.locator('#ratioPlot circle').count()>0,true);
assert.match(await page.locator('#ratioPlot').innerText(),/Dots = assessed/);
assert.equal(await page.evaluate(()=>chartRegistry.ratioPlot.series.length),1);
await page.check('#showCrosscheck');assert.equal(await page.evaluate(()=>chartRegistry.ratioPlot.series.length),2);
await page.uncheck('#showCrosscheck');
await page.click('#duplicateCase');assert.equal(await page.locator('#activeCase option').count(),2);assert.equal(await page.evaluate(()=>last),null);
await page.fill('#caseName','Bracket X — longer random');await page.fill('#duration','4');assert.equal(await page.locator('#exportPptx').isDisabled(),true);await run();
assert.equal(await page.evaluate(()=>study.cases[0].result.r.worst.margin),original.ratio);
await page.selectOption('#activeCase','C01');assert.equal(await page.locator('#duration').inputValue(),original.inputs.duration);assert.equal(await page.evaluate(()=>last.r.worst.margin),original.ratio);
await page.fill('#Q','11');assert.equal(await page.locator('[data-svg="ratioPlot"]').isDisabled(),true);assert.equal(await page.locator('[data-png="ratioPlot"]').isDisabled(),true);await run();
await page.check('#resultsOnly');assert.equal(await page.locator('.inputs').isVisible(),false);await page.uncheck('#resultsOnly');
// A mixed collection: shared sine, independent pairs, bank and listed-mode scopes, assumed and documented dwells.
for(let i=2;i<7;i++){await page.click('#duplicateCase');await page.fill('#caseName',`Assembly ${i+1} — ${i%2?'X':'Z'} axis`);await page.fill('#randomName',`Random requirement ${i+1} Rev A`);if(i%2===0)await page.fill('#sineName',`Sine qualification ${i+1} Rev C`);await page.fill('#duration',String(i+2));if(i===3){await page.selectOption('#dwellMode','assumed');await page.fill('#passes','0');}if(i===4){await page.selectOption('#scope','bank');} }
await tab('study');await page.fill('#studyTitle','Seven-case vibration comparison');await page.click('#runAllCases');await settle();assert.match(await page.locator('#collectionMessage').innerText(),/All included cases calculated/);assert.equal(await page.locator('#exportPptx').isEnabled(),true);
assert.equal(await page.evaluate(()=>readyCases().length),7);
const limits=await page.evaluate(()=>readyCases().map(e=>VDCReport.figures(e.result.c,e.result.r,reportSettings())[0].limits));assert.ok(limits.every(x=>JSON.stringify(x)===JSON.stringify(limits[0])));
await page.screenshot({path:path.join(out,'collection.png'),fullPage:true});
const filename=await save('#saveStudy','study.json');assert.match(filename,/seven-case.*collection.json/i);
const saved=JSON.parse(fs.readFileSync(path.join(out,'study.json'),'utf8'));assert.equal(saved.cases.length,7);assert.ok(saved.cases.every(e=>!('result'in e)));
await save('#exportStudyReport','study.html');const html=fs.readFileSync(path.join(out,'study.html'),'utf8');assert.equal((html.match(/<svg /g)||[]).length,28);assert.ok(!html.includes('Complete input record'));assert.ok(!html.includes('NaN'));
await save('#exportStudyCSV','summary.csv');
await save('#exportPptx','seven-cases.pptx');await settle();
const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,'seven-cases.pptx')));const slides=Object.keys(zip.files).filter(x=>/^ppt\/slides\/slide\d+\.xml$/.test(x));assert.equal(slides.length,15);const notes=Object.keys(zip.files).filter(x=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(x));assert.equal(notes.length,15);
const xml=(await Promise.all(slides.map(x=>zip.file(x).async('string')))).join('\n');assert.match(xml,/Bracket X/);assert.match(xml,/&lt;|Fatigue/);assert.ok(xml.includes('<a:tbl>'));assert.equal((xml.match(/<p:pic>/g)||[]).length,21);
const noteXML=(await Promise.all(notes.map(x=>zip.file(x).async('string')))).join('\n');assert.match(noteXML,/Exact input record/);assert.match(noteXML,/analystNotes/);assert.match(noteXML,/sineText/);
// Appendix, plot downloads, and exported SVG text bounds.
for(const box of await page.locator('[data-include]').all())await box.uncheck();await page.locator('[data-include="C01"]').check();await page.check('#includeAppendix');await save('#exportPptx','appendix.pptx');await settle();
await tab('analysis');await page.selectOption('#activeCase','C01');
const svgName=await save('[data-svg="ratioPlot"]','coverage.svg');assert.match(svgName,/^C01-bracket-x-baseline-r\d+-ratioPlot.svg$/i);await save('[data-png="ratioPlot"]','coverage.png');
const svg=fs.readFileSync(path.join(out,'coverage.svg'),'utf8');assert.match(svg,/Target = 1/);assert.match(svg,/Dirlik coverage/);assert.match(svg,/Bracket X/);
const bounds=await page.locator('#ratioPlot svg').evaluate(el=>[...el.querySelectorAll('text')].filter(t=>{const b=t.getBoundingClientRect(),r=el.getBoundingClientRect();return b.left<r.left-1||b.top<r.top-1||b.right>r.right+1||b.bottom>r.bottom+1;}).map(t=>t.textContent));assert.deepEqual(bounds,[]);
// Table edit and spreadsheet paste update portable inputs and invalidate results.
await page.locator('#psdText + details').evaluate(el=>el.open=true);await page.locator('#psdTextEditor input').first().fill('91');assert.match(await page.locator('#psdText').inputValue(),/^91,/);assert.equal(await page.evaluate(()=>last),null);
await page.fill('#psdText','90,0.01\n110,0.01');await page.locator('#psdText').evaluate(el=>{el.select();const d=new DataTransfer();d.setData('text/plain','90\t0.01\n110\t0.01');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});assert.equal(await page.locator('#psdText').inputValue(),'90,0.01\n110,0.01');
await page.click('#removeCase');assert.equal(await page.locator('#activeCase option').count(),6);await page.click('#undoRemove');assert.equal(await page.locator('#activeCase option').count(),7);
await tab('study');await page.setInputFiles('#loadStudy',path.join(out,'study.json'));await page.waitForFunction(()=>study.cases.length===7&&study.cases.every(e=>!e.result));assert.equal(await page.locator('#exportPptx').isDisabled(),true);assert.equal(await page.evaluate(()=>study.cases[0].inputs.Q),'11');
// Invalid import is atomic and cannot replace the collection.
await page.setInputFiles('#loadStudy',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,cases:[saved.cases[0],saved.cases[0]]}))});await page.waitForFunction(()=>document.querySelector('#collectionMessage').textContent.includes('unique'));assert.equal(await page.evaluate(()=>study.cases.length),7);
await page.click('#runAllCases');await settle();assert.equal(await page.locator('#exportPptx').isEnabled(),true);
// Stress long labels, punctuation and multi-page review notes without changing calculations.
const stress=structuredClone(saved);stress.title="Long-label reporting check";for(const e of stress.cases){e.inputs.caseName=("Long component & axis <review> — ".repeat(4)).slice(0,120);e.inputs.sineName="Sine specification revision with long configuration and mounting identifiers ".repeat(2).slice(0,120);e.inputs.randomName="Random specification with lengthy program phase and axis identification ".repeat(2).slice(0,120);e.inputs.analystNotes="Engineering interpretation and limitations. ".repeat(90).slice(0,4000);}await page.setInputFiles('#loadStudy',{name:'long.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(stress))});await page.waitForFunction(()=>study.title==='Long-label reporting check');await page.click('#runAllCases');await settle();await page.uncheck('#includeAppendix');await save('#exportPptx','long-labels.pptx');await settle();
await page.setInputFiles('#loadStudy',path.join(out,'study.json'));await page.waitForFunction(()=>study.title==='Seven-case vibration comparison');await page.click('#runAllCases');await settle();
// One invalid selected case blocks collective exports; excluding it permits export of the others.
await tab('analysis');await page.fill('#Q','0');await tab('study');await page.click('#runAllCases');await settle();assert.match(await page.locator('#collectionMessage').innerText(),/C01:/);assert.equal(await page.locator('#exportPptx').isDisabled(),true);await page.locator('[data-include="C01"]').uncheck();assert.equal(await page.locator('#exportPptx').isEnabled(),true);
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'collection-mobile.png')});
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await browser.close();console.log('PASS collection: seven mixed cases, independent snapshots, reruns, stale protection, include/exclude, common axes, JSON roundtrip/atomic validation, table/paste editor, SVG/PNG/HTML/CSV/PPTX export, 15-slide editable deck with source notes, appendix, mobile, zero network.');
