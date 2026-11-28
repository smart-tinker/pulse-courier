import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { FLIGHT, center, halfGap } from '../packed/model.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const files={'/':'index.html','/app.mjs':'app.mjs','/model.mjs':'model.mjs','/style.css':'style.css'};
const http=createServer(async(req,res)=>{
  const name=files[req.url];
  if(!name){res.writeHead(404).end();return}
  try{
    res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    res.end(await readFile('packed/'+name));
  }catch{res.writeHead(500).end()}
});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+http.address().port+'/';
const day=new Date('2026-11-27T12:00:00Z');
let browser;
const errors=[], external=[];
async function pageFor(mobile){
  const page=await browser.newPage({viewport:mobile?{width:360,height:740}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.route('**/*',route=>{
    if(route.request().url().startsWith(url))return route.continue();
    external.push(route.request().url());return route.abort();
  });
  await page.clock.install({time:day});
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  assert.equal(await page.title(),'Импульс');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#status').waitFor();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  return page;
}
async function screenshot(page,file){
  if(process.env.QA_SCREENSHOTS){
    await mkdir(process.env.QA_SCREENSHOTS,{recursive:true});
    await page.screenshot({path:process.env.QA_SCREENSHOTS+'/'+file+'.png',animations:'disabled'});
  }
}
async function passTraining(page) {
  const gate=page.locator('.gate.one');
  const phase=()=>gate.evaluate(g=>parseFloat(g.style.getPropertyValue('--mid')));
  assert.equal(await page.locator('#stage').textContent(),'ТРЕНИРОВКА');
  assert.equal(await page.locator('.gate.two').isVisible(),false);
  const before=await phase();
  assert.equal(before,50);
  assert.equal(await gate.evaluate(g=>parseFloat(g.style.getPropertyValue('--gap'))),halfGap(0));
  await page.keyboard.down('Space');
  await page.clock.runFor(480);
  assert.equal(await phase(),before);
  await page.keyboard.up('Space');
  await page.clock.runFor(390);
  assert.match(await page.locator('#status').textContent(),/Тренировка пройдена/);
  assert.match(await page.locator('#stage').textContent(),/КПП 01 \/ 12/);
  assert.equal(await page.locator('.gate.two').isVisible(),true);
}
async function checkMiss(page,hold,side) {
  await passTraining(page);
  const marker=page.locator('#miss');
  assert.equal(await marker.isVisible(),false);
  await page.keyboard.down('Space');
  await page.clock.runFor(hold);
  const before=await page.locator('.gate.one').evaluate(g=>parseFloat(g.style.getPropertyValue('--mid')));
  assert.ok(before>50,'First campaign gate must move');
  const aimed=await page.locator('#aim').evaluate(g=>parseFloat(g.style.top));
  // Both releases precede the first gate's peak, so its rendered phase is invertible here.
  const arrival=615*Math.asin((before-50)/12)+FLIGHT;
  await page.keyboard.up('Space');
  await page.clock.runFor(400);
  assert.match(await page.locator('#status').textContent(),new RegExp('Мимо просвета: '+side));
  assert.equal(await marker.isVisible(),true);
  const points=await page.locator('.gate.one').evaluate(g=>{
    const gate=g.getBoundingClientRect();
    return ['gap-top','gap-bottom','impact'].map(id=>{
      const r=document.getElementById(id).getBoundingClientRect();
      return (r.top+r.height/2-gate.top)/gate.height*100;
    });
  });
  const mid=center(0,arrival), gap=halfGap(0);
  for(const [actual,expected] of points.map((value,i)=>[value,[mid-gap,mid+gap,aimed][i]]))
    assert.ok(Math.abs(actual-expected)<0.03,`Marker ${actual} does not match ${expected}`);
  assert.ok(side==='выше'?points[2]<points[0]:points[2]>points[1]);
  await page.clock.runFor(150);
  assert.ok(Math.abs(await page.locator('.gate.one').evaluate(g=>parseFloat(g.style.getPropertyValue('--mid')))-mid)<1e-9);
  await page.locator('#launch').click();
  assert.equal(await marker.isVisible(),false);
  assert.equal(await page.locator('#stage').textContent(),'ТРЕНИРОВКА');
  await page.clock.runFor(32);
}
async function checkPulse(desktop,mobile) {
  const status=desktop.locator('#status');
  await checkMiss(desktop,48,'ниже');
  await checkMiss(desktop,864,'выше');
  await passTraining(desktop);
  await desktop.locator('#retry').click();
  await desktop.locator('#launch').focus();
  await desktop.clock.runFor(32);
  await passTraining(desktop);
  await desktop.locator('#pause').click();
  assert.equal(await desktop.locator('#launch').isDisabled(),true);
  await desktop.locator('#pause').click();
  assert.equal(await desktop.locator('#launch').isDisabled(),false);
  await desktop.locator('h1').click();
  await desktop.keyboard.down('Space');
  await desktop.clock.runFor(430);
  assert.ok(Number(await desktop.locator('#charge').getAttribute('value'))>30);
  await screenshot(desktop,'pulse-desktop');
  await desktop.keyboard.up('Space');
  await desktop.clock.runFor(390);
  assert.match(await status.textContent(),/КПП 1 пройден/);
  assert.match(await desktop.locator('#best').textContent(),/01/);
  for(let gate=2;gate<=12;gate++){
    await desktop.keyboard.down('Space');
    let aligned=false;
    for(let tick=0;tick<80;tick++){
      await desktop.clock.runFor(16);
      if(await desktop.locator('#aim').getAttribute('data-aligned')==='true'){aligned=true;break}
    }
    assert.ok(aligned,'No playable alignment at gate '+gate);
    await desktop.keyboard.up('Space');
    await desktop.clock.runFor(390);
    assert.match(await status.textContent(),gate===12?/Доставлено!/:new RegExp('КПП '+gate+' пройден'));
  }
  await desktop.reload();
  assert.match(await desktop.locator('#best').textContent(),/12 · [0-9.]+ с/);
  const start=await mobile.locator('#launch').boundingBox();
  const x=Math.round(start.x+start.width/2),y=Math.round(start.y+start.height/2);
  const cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await mobile.clock.runFor(430);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.clock.runFor(390);
  assert.match(await mobile.locator('#status').textContent(),/Тренировка пройдена/);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await mobile.clock.runFor(430);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.clock.runFor(390);
  assert.match(await mobile.locator('#status').textContent(),/КПП 1 пройден/);
  await screenshot(mobile,'pulse-mobile');
}

try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
  const desktop=await pageFor(false), mobile=await pageFor(true);
  await checkPulse(desktop,mobile);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log('DESKTOP_MOBILE_STORAGE_AND_NO_EXTERNAL_REQUESTS_PASS');
}finally{await browser?.close();http.close()}
