import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionCost, saveSession, duration, costForSeconds} from './session-cost.mjs';
test('published rate and duration formatting',()=>{
 assert.equal(costForSeconds(3600),3);assert.equal(costForSeconds(60),.05);
 assert.equal(duration(61.8),'1:01');assert.equal(duration(3600),'60:00');
});
test('cumulative provider updates replace estimates instead of adding',()=>{
 const s=new SessionCost('one',0);assert.equal(s.snapshot(10000).seconds,10);
 s.usage(8,10000);s.usage(12,14000);assert.equal(s.snapshot(15000).seconds,13);
 s.usage(9,15000);assert.equal(s.snapshot(15000).seconds,13);
 s.finish(16000);s.usage(14.5,17000,true);
 assert.equal(s.snapshot().seconds,14.5);assert.equal(s.snapshot().estimated,false);
 s.finish(20000);s.usage(18,20000);assert.equal(s.snapshot().seconds,14.5);
});
test('disconnect fallback is estimated and duplicate end events produce one history row',()=>{
 const s=new SessionCost('one',0);s.finish(5000);
 assert.equal(s.snapshot().seconds,5);assert.equal(s.snapshot().estimated,true);
 let history=saveSession([],s.snapshot());s.usage(6,7000,true);
 history=saveSession(history,s.snapshot());assert.equal(history.length,1);assert.equal(history[0].seconds,6);
 assert.equal(saveSession(Array.from({length:100},(_,id)=>({id})),s.snapshot()).length,100);
});
