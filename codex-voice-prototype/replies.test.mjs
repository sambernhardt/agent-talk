import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findReply } from './replies.mjs';
const turn = (id, userId, text, status='completed') => ({id,status,items:[{type:'userMessage',id:userId,content:[{type:'text',text}]},{type:'agentMessage',phase:'commentary',text:'working'},{type:'agentMessage',phase:'final_answer',text:'answer'}]});
test('ignores old and unrelated messages, waits for completion, returns only final answer',()=>{
 const job={text:'hello',baseline:new Set(['old'])},claimed=new Set();
 assert.equal(findReply(job,[turn('a','old','hello'),turn('b','new','other')],claimed),null);
 assert.equal(findReply(job,[turn('c','fresh','hello','inProgress')],claimed),null);
 assert.equal(job.turnId,'c');
 assert.deepEqual(findReply(job,[turn('c','fresh','hello')],claimed),{text:'answer',status:'completed'});
 assert.equal(findReply({text:'hello',baseline:new Set()},[turn('c','fresh','hello')],claimed),null);
});
test('identical requests use distinct turns in chronological order',()=>{
 const claimed=new Set(), turns=[turn('new','n','same'),turn('first','f','same')];
 const a={text:'same',baseline:new Set()},b={text:'same',baseline:new Set()};
 findReply(a,turns,claimed);findReply(b,turns,claimed);
 assert.equal(a.turnId,'first');assert.equal(b.turnId,'new');
});
test('read-only history can label a still-running desktop turn interrupted',()=>{
 const job={text:'hello',baseline:new Set()},claimed=new Set();
 const unfinished={...turn('live','user','hello','interrupted'),completedAt:null,items:[{type:'userMessage',id:'user',content:[{type:'text',text:'hello'}]},{type:'agentMessage',phase:'commentary',text:'Still working'}]};
 assert.equal(findReply(job,[unfinished],claimed),null);
 assert.equal(job.turnId,'live');
 assert.deepEqual(findReply(job,[{...turn('live','user','hello'),completedAt:123}],claimed),{text:'answer',status:'completed'});
});
