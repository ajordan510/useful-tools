const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[],qa=path.join(__dirname,'_qa');
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(pathToFileURL(path.join(__dirname,'rocket_acoustics.html')).href);
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Prediction complete'));
 await page.click('[data-tab="verification"]');assert.ok(await page.locator('#measuredCSV').isDisabled());
 await page.click('#runMeasured');
 assert.equal(await page.locator('#measuredRows tr').count(),38);
 assert.equal(await page.locator('#measuredSensitivity tr').count(),6);
 assert.match(await page.locator('#measuredMetrics').textContent(),/4.73/);
 assert.match(await page.locator('#measuredMetrics').textContent(),/2.23/);
 assert.equal(await page.locator('#measuredM1 circle:not([fill=transparent])').count(),13);
 assert.equal(await page.locator('#measuredM8 svg').count(),1);
 await page.locator('#measuredPanel').screenshot({path:path.join(qa,'measured-comparison.png')});
 async function save(id,name){const d=page.waitForEvent('download');await page.click(id);await (await d).saveAs(path.join(qa,name));return fs.readFileSync(path.join(qa,name),'utf8');}
 const csv=await save('#measuredCSV','measured-comparison.csv');assert.equal(csv.split('\r\n').length,43);assert.match(csv,/corrected_200000_dB/);assert.match(csv,/,false/);
 const report=await save('#measuredReport','measured-comparison.html');assert.match(report,/vectorProvenance/);assert.match(report,/sourceSha256/);assert.match(report,/343/);assert.ok(!report.includes('<button'));
 await page.click('#loadMeasured');await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Prediction complete'));
 assert.equal(await page.inputValue('#thrust'),'260000');assert.equal(await page.inputValue('#eta'),'0.84');assert.match(await page.locator('#pinLabel').textContent(),/ground corrected/);
 await page.fill('#thrust','270000');assert.ok(await page.locator('#report').isDisabled());await page.click('[data-tab="verification"]');assert.match(await page.locator('#measuredMetrics').textContent(),/4.73/);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#measuredPanel').screenshot({path:path.join(qa,'measured-comparison-mobile.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 fs.writeFileSync(path.join(__dirname,'reference/measured-browser-results.json'),JSON.stringify({passed:['Offline two-receiver measured/corrected overlays','Primary 13-band assessment; 38 total rows','Input sensitivities','CSV and standalone report provenance','Calculator input mapping and corrected-data pin','Fixed-case isolation and stale exports','390px layout'],errors,networkRequests:requests},null,2)+'\n');
 await browser.close();console.log('PASS measured comparison browser checks');
})().catch(e=>{console.error(e);process.exit(1);});
