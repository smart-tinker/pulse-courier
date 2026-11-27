export const TOTAL=12, FLIGHT=340, CHARGE=970;
export const center=(n,t)=>50+Math.sin(t/(615-n*22)+n*1.39)*(n===0?12:14+n*1.25);
export const halfGap=n=>n===0?16:15-n*.51;
export const height=ms=>79-58*Math.min(1,Math.max(0,ms/CHARGE));
export const newRun=()=>({gate:0,y:79,state:'ready',fired:0});
export function land(run,hold,arrival) {
  if(run.state!=='ready')return run;
  const y=height(hold),fired=run.fired+1;
  if(Math.abs(y-center(run.gate,arrival))>halfGap(run.gate))
    return {...run,y,fired,state:'lost'};
  const gate=run.gate+1;
  return {gate,y,fired,state:gate===TOTAL?'won':'ready'};
}
export function nextBest(old,run) {
  return Math.min(TOTAL,Math.max(0,Number.isInteger(old)?old:0,run.gate));
}
