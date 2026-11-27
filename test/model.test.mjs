import assert from 'node:assert/strict';
import test from 'node:test';
import { TOTAL, FLIGHT, CHARGE, center, halfGap, height, newRun, land, nextBest } from '../game/model.mjs';

test('charge clamps; high charge lifts the courier; initial shot can miss',()=>{
  assert.equal(height(-100),79);
  assert.equal(height(CHARGE*2),21);
  assert.ok(height(650)<height(300));
  const result=land(newRun(),0,FLIGHT);
  assert.equal(result.state,'lost');
  assert.equal(result.gate,0);
  assert.equal(land(result,450,850),result);
});

test('each gate has a reachable nondegenerate moving window and a full run is winnable',()=>{
  let r=newRun(),time=0;
  for(let n=0;n<TOTAL;n++){
    for(const t of [0,890,2300,8200]){
      assert.ok(center(n,t)-halfGap(n)>0&&center(n,t)+halfGap(n)<100);
      assert.notEqual(center(n,t),center(n,t+190));
    }
    const hold=Array.from({length:31},(_,i)=>i*31).find(ms=>Math.abs(height(ms)-center(n,time+ms+FLIGHT))<halfGap(n)/2);
    assert.ok(hold!==undefined,'No passing charge at gate '+n);
    time+=hold+FLIGHT;
    r=land(r,hold,time);
    assert.equal(r.gate,n+1);
    time+=147;
  }
  assert.equal(r.state,'won');
  assert.equal(r.fired,TOTAL);
  assert.equal(nextBest(2,r),TOTAL);
  assert.equal(nextBest(12,newRun()),12);
  assert.equal(nextBest(Infinity,newRun()),0);
});
