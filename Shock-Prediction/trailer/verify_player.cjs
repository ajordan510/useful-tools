const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'watch.html')).href);
  await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
  const meta=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
  assert.equal(meta.width,1920);assert.equal(meta.height,1080);assert.ok(Math.abs(meta.duration-61.5)<.1);
  await page.locator('video').evaluate(async v=>{v.muted=true;await v.play();});
  await page.waitForFunction(()=>document.querySelector('video').currentTime>.5);
  await page.locator('video').evaluate(v=>{v.pause();v.currentTime=6.5;});
  await page.waitForFunction(()=>!document.querySelector('video').seeking);
  await page.screenshot({path:path.join(__dirname,'render/player.png')});
  assert.equal(errors.length,0);console.log('Browser playback, seek, video metadata and player page passed.');
  const file=path.join(__dirname,'verification.json'),data=JSON.parse(fs.readFileSync(file));
  data.browserPlayback={status:'passed',browser:await browser.version(),metadata:meta,errors};
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
