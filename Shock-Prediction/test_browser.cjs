/* npm install --no-save playwright; npx playwright install chromium
   Optional CHROMIUM_PATH points to an existing Chrome/Edge executable. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const S=require('./engine.js'),qa=path.join(__dirname,'_qa');fs.mkdirSync(qa,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 page.on('dialog',d=>d.accept());
 const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);console.log('PASS '+name);};
 const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Study complete'),{},{timeout:60000});
 async function set(p){await page.evaluate(p=>ShockWorkbench.setProject(p),p);}
 async function run(){await page.click('#run');await ready();}
 let downloadCount=0;
 async function download(selector){const wait=page.waitForEvent('download');await page.click(selector);const d=await wait,file=path.join(qa,(++downloadCount)+'-'+d.suggestedFilename());await d.saveAs(file);return file;}
 try{
  await page.goto(pathToFileURL(path.join(__dirname,'shock_workbench.html')).href);await ready();
  check('Offline worker starts and computes three teaching cases',(await page.evaluate(()=>ShockWorkbench.getResult().cases.length))===3);
  check('Run includes SHA-256 provenance',/^[a-f0-9]{64}$/.test(await page.evaluate(()=>ShockWorkbench.getResult().inputHash)));
  await page.screenshot({path:path.join(qa,'desktop.png'),fullPage:true});
  const svg=page.locator('svg[data-chart-id="srs"]');await svg.hover({position:{x:160,y:100}});
  check('Plot hover reports values',(await page.locator('[data-tooltip="srs"]').innerText()).includes('Nominal prediction:'));
  await page.fill('#viewMin','200');await page.fill('#viewMax','5000');await page.click('#applyView');
  check('View limits change charts only',(await page.locator('svg[data-chart-id="srs"]').getAttribute('data-xmin'))==='200'&&(await page.evaluate(()=>ShockWorkbench.getResult().frequency[0]))===100);
  await page.click('#resetView');
  const saved=await download('#saveProject'),savedProject=JSON.parse(fs.readFileSync(saved));check('Project download retains source and path evidence',savedProject.sources[0].evidence&&savedProject.cases[0].ratioData);
  const ordinateCount=await page.evaluate(()=>ShockWorkbench.getResult().frequency.length);
  const csv=fs.readFileSync(await download('#exportCsv'),'utf8');check('CSV export includes every ordinate and blanks by contract',csv.split('\r\n').length===3*ordinateCount+1&&csv.includes('input_sha256'));
  const manifest=JSON.parse(fs.readFileSync(await download('#exportManifest')));check('Run manifest contains reproducible inputs and numerical output',manifest.project.schema===S.SCHEMA&&manifest.cases[0].nominal.length===ordinateCount);
  const svgFile=fs.readFileSync(await download('[data-svg="srs"]'),'utf8');check('SVG export is standalone',svgFile.includes('xmlns="http://www.w3.org/2000/svg"')&&!svgFile.includes('NaN'));
  const report=await download('#exportReport'),reportPage=await context.newPage();await reportPage.goto(pathToFileURL(report).href);check('HTML report opens with all cases and full input project',(await reportPage.locator('svg').count())===3&&(await reportPage.locator('pre').innerText()).includes('ratioData'));await reportPage.close();
  await page.click('[data-tab="setup"]');await page.locator('[data-bind="case.name"]').fill('Edited case');
  check('Editing invalidates results and exports',await page.evaluate(()=>ShockWorkbench.getResult()===null)&&await page.locator('#results').isHidden());
  await run();check('Worker rerun uses edited inputs',(await page.evaluate(()=>ShockWorkbench.getResult().cases[0].name))==='Edited case');
  await download('#saveProject');await page.locator('#projectFile').setInputFiles(saved);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Project loaded'));
  check('Project file round trip restores study',(await page.evaluate(()=>ShockWorkbench.getProject().cases[0].name))===savedProject.cases[0].name);
  await page.locator('[data-bind="source.q"]').fill('20');await page.click('#run');await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));
  check('Invalid source damping produces actionable error',(await page.locator('#status').innerText()).includes('source Q differs'));
  const before=await page.evaluate(()=>ShockWorkbench.getProject());await page.locator('#projectFile').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:S.SCHEMA}))});
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Project import failed'));check('Invalid project does not replace active work',JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>ShockWorkbench.getProject())));
  await set(S.demo());await page.locator('[data-bind="case.method"]').selectOption('power');await page.click('#addFactor');await page.locator('[data-bind="factor.0.db"]').fill('-3');await page.locator('[data-bind="factor.0.evidence"]').fill('Test factor');await run();
  check('Distance and banded-factor editor runs',(await page.evaluate(()=>ShockWorkbench.getResult().cases[0].gains.length))===2);
  await set(S.demo());await page.locator('[data-bind="case.method"]').selectOption('isolator');await page.click('#loadPulse');await page.locator('#confirmDialog button[value="ok"]').click();await page.locator('[data-bind="case.baseConfirmed"]').check();await run();
  const mount=await page.evaluate(()=>ShockWorkbench.getResult().cases[0]);check('Teaching history exercises time-domain mount and diagnostics',mount.mount.travelMm>0&&mount.inputHistory.length>0&&mount.outputHistory.length>mount.inputHistory.length);
  await page.screenshot({path:path.join(qa,'isolation.png'),fullPage:true});
  await page.click('[data-tab="setup"]');await page.locator('[data-bind="case.mount.clearance"]').fill('0.001');await run();check('Bottoming is flagged invalid in UI',(await page.locator('#results').innerText()).includes('Invalid · mount contact'));
  const evil=S.demo();evil.title='<img src=x onerror="window.injected=1">';evil.cases[0].name='=1+1';await set(evil);await run();check('Imported labels render as text without script execution',await page.evaluate(()=>window.injected===undefined)&&!(await page.locator('#studyTitle img').count()));
  const safeCsv=fs.readFileSync(await download('#exportCsv'),'utf8');check('CSV labels neutralize formula prefixes',safeCsv.includes('"\'=1+1"'));
  await set(S.demo());await run();await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>Number(document.querySelector('svg[data-chart-id="srs"]').dataset.width)<400);
  check('Mobile page has no document horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.screenshot({path:path.join(qa,'mobile.png'),fullPage:true});
  await page.click('[data-tab="setup"]');check('Mobile setup fields remain accessible',await page.locator('[data-bind="source.name"]').isVisible());
  await page.screenshot({path:path.join(qa,'mobile-setup.png'),fullPage:true});
  await page.click('#helpButton');check('Embedded method guide is accessible',await page.locator('#tab-method').isVisible());
  check('No application JavaScript errors',errors.length===0);check('No network requests needed',requests.length===0);
  fs.writeFileSync(path.join(qa,'browser.json'),JSON.stringify({browser:await browser.version(),checks,errors,requests},null,2));console.log(`${checks.length} browser checks passed.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
