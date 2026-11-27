import { TOTAL, FLIGHT, CHARGE, center, halfGap, height, newRun, land, nextBest } from './model.mjs';
const q=id=>document.getElementById(id);
const stage=q('stage'), bestLabel=q('best'), drone=q('drone'), aim=q('aim'), launch=q('launch');
const meter=q('charge'), status=q('status'), pause=q('pause'), retry=q('retry');
const gates=[...document.querySelectorAll('.gate')], bestKey='pulse-courier.best.v1', timeKey='pulse-courier.time.v1';
let best=0, bestTime=null;
try {
  best=nextBest(Number(localStorage.getItem(bestKey)),newRun());
  const saved=Number(localStorage.getItem(timeKey));
  if(Number.isInteger(saved)&&saved>0)bestTime=saved;
} catch {}
let run, t, initial, charge, shot, paused, now;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const format=n=>String(n).padStart(2,'0'), seconds=ms=>(ms/1000).toFixed(1)+' с';
function hud(){
  stage.textContent='КПП '+format(Math.min(TOTAL,run.gate+1))+' / '+TOTAL;
  bestLabel.textContent='ЛУЧШИЙ '+format(best)+(bestTime===null?'':' · '+seconds(bestTime));
  pause.setAttribute('aria-pressed',String(paused));
  pause.textContent=paused?'▶':'Ⅱ';
  pause.setAttribute('aria-label',paused?'Продолжить':'Пауза');
  launch.disabled=paused||!!shot;
  launch.dataset.charging=String(charge!==null);
  launch.textContent=run.state==='ready'?'Зажми, чтобы зарядить':'Ещё попытка';
}
function reset(){
  run=newRun();t=0;initial=true;charge=null;shot=null;paused=false;now=null;hud();
  status.textContent='Держи пробел или кнопку, затем отпусти.';
}
function begin(){
  if(paused||shot||charge!==null)return;
  if(run.state!=='ready'){reset();return}
  initial=false;
  charge=t;hud();
}
function cancel(){if(charge!==null){charge=null;hud()}}
function fire(){
  if(charge===null||paused||shot)return;
  const held=t-charge;
  shot={t,held,to:height(held),from:run.y};
  charge=null;hud();
}
function finish(){
  const previous=run.gate;
  const arrival=shot.t+FLIGHT;
  run=land(run,shot.held,arrival);
  shot=null;
  if(run.gate>best){best=nextBest(best,run);try{localStorage.setItem(bestKey,String(best))}catch{}}
  if(run.state==='lost')status.textContent='Мимо просвета. Пройдено '+run.gate+' из '+TOTAL+' КПП.';
  else if(run.state==='won'){
    const elapsed=Math.round(arrival);
    if(bestTime===null||elapsed<bestTime){bestTime=elapsed;try{localStorage.setItem(timeKey,String(bestTime))}catch{}}
    status.textContent='Доставлено! Все '+TOTAL+' КПП за '+seconds(elapsed)+'.';
  }
  else status.textContent='КПП '+(previous+1)+' пройден. Лови следующий просвет.';
  hud();
}
function togglePause(){
  if(run.state!=='ready')return;
  paused=!paused;if(paused)cancel();hud();
  status.textContent=paused?'Пауза. Нажми ▶, чтобы продолжить.':'Держи пробел или кнопку, затем отпусти.';
}
function loop(stamp){
  if(!paused&&!document.hidden&&!initial&&now!==null&&run.state==='ready') t+=Math.min(50, Math.max(0,stamp-now));
  now=stamp;
  if(shot&&t-shot.t>=FLIGHT)finish();
  const h=charge===null?0:t-charge, p=shot?Math.min(1,(t-shot.t)/FLIGHT):0;
  meter.value=100*Math.min(1,(shot?.held??h)/CHARGE);
  const y=shot?(reduce?shot.to:shot.from+(shot.to-shot.from)*p):run.y;
  drone.style.top=y+'%';
  drone.style.left=((shot?(reduce?49:24+25*p):24))+'%';
  aim.style.top=height(h)+'%';
  aim.style.visibility=run.state==='ready'&&!shot?'visible':'hidden';
  aim.dataset.aligned=String(Math.abs(height(h)-center(Math.min(run.gate,TOTAL-1),t+FLIGHT))<=halfGap(Math.min(run.gate,TOTAL-1)));
  gates.forEach((g,i)=>{
    const n=run.gate+i;
    g.hidden=n>=TOTAL;
    if(!g.hidden){g.style.setProperty('--mid',center(n,t)+'%');g.style.setProperty('--gap',halfGap(n)+'%')}
  });
  requestAnimationFrame(loop);
}
launch.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary)return;
  if(run.state==='ready'){event.preventDefault();launch.setPointerCapture(event.pointerId);begin()}
});
launch.addEventListener('pointerup',event=>{if(event.isPrimary)fire()});
launch.addEventListener('lostpointercapture',cancel);
launch.addEventListener('pointercancel',cancel);
launch.addEventListener('click',()=>{if(run.state!=='ready')reset()});
const isChargeKey=e=>(e.code==='Space'&&(!e.target.closest?.('button')||e.target===launch))||(e.key==='Enter'&&e.target===launch);
let keyDown=false;
window.addEventListener('keydown',e=>{if(isChargeKey(e)){e.preventDefault();if(!e.repeat){keyDown=true;begin()}}});
window.addEventListener('keyup',e=>{if(keyDown&&(e.code==='Space'||e.key==='Enter')){e.preventDefault();keyDown=false;fire()}});
window.addEventListener('blur',()=>{keyDown=false;cancel()});
document.addEventListener('visibilitychange',()=>{now=null;keyDown=false;cancel()});
pause.addEventListener('click',togglePause);retry.addEventListener('click',reset);
reset();requestAnimationFrame(loop);
