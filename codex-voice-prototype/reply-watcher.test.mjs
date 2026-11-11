import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReplyWatcher } from './reply-watcher.mjs';
const reply=(id,text,phase='final_answer')=>({id,type:'agentMessage',text,phase});
const turn=(id,items,status='completed',completedAt=123)=>({id,items,status,completedAt});
test('reads typed-chat replies with no voice jobs, skips history and repeated polls',()=>{
 const old=turn('old',[reply('old-a','Old answer')]);const watcher=new ReplyWatcher([old]);
 const typed=turn('typed',[{id:'u',type:'userMessage',content:[{type:'text',text:'Typed in Codex'}]},reply('progress','Working','commentary'),reply('typed-a','New answer')]);
 assert.deepEqual(watcher.scan([typed,old]).map(r=>r.text),['New answer']);
 assert.deepEqual(watcher.scan([typed,old]),[]);
});
test('voice reply is emitted once and unfinished desktop turns are not treated as interruptions',()=>{
 const active=turn('active',[reply('progress','Working','commentary')],'interrupted',null);
 const watcher=new ReplyWatcher([active]);assert.deepEqual(watcher.scan([active]),[]);
 const completed=turn('active',[reply('progress','Working','commentary'),reply('answer','Done')]);
 assert.deepEqual(watcher.scan([completed]).map(r=>r.text),['Done']);assert.deepEqual(watcher.scan([completed]),[]);
});
test('multiple new replies retain order and existing turns can receive new reply items',()=>{
 const old=turn('old',[reply('a','Before voice')]);const watcher=new ReplyWatcher([old]);
 const updated=turn('old',[reply('a','Before voice'),reply('b','After voice')]);
 const newer=turn('new',[reply('c','Next reply')]);
 assert.deepEqual(watcher.scan([newer,updated]).map(r=>r.text),['After voice','Next reply']);
});
test('reconnecting establishes a fresh baseline without reading past replies again',()=>{
 const done=turn('done',[reply('a','Already spoken')]);
 assert.deepEqual(new ReplyWatcher([done]).scan([done]),[]);
});

test('a partial final present at connection can still finish and be read',()=>{
 const partial=turn('live',[{...reply('a','Partial'),completedAtMs:null}],'interrupted',null);
 const watcher=new ReplyWatcher([partial]);
 const done=turn('live',[{...reply('a','Complete answer'),completedAtMs:456}]);
 assert.deepEqual(watcher.scan([done]).map(r=>r.text),['Complete answer']);
});
