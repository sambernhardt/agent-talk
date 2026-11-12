import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conversation, prepareHandoff, validateHandoff, formatHandoff } from './handoff.mjs';
const ready={action:'delegate',task:'Compare the key implementation files.',context:'Compare the original direct voice app with the conversational companion.',constraints:['Read only; do not change files.'],question:'',source_user_ids:[3]};
test('collects both roles and keeps delegation snapshots immutable while speech continues',()=>{
 const c=new Conversation();c.append('user','Hello');c.append('assistant','The new app delegates work.');c.append('user','Compare the files');
 const snapshot=c.snapshot();c.append('user','And one more thing');
 assert.deepEqual(snapshot.map(m=>m.role),['user','assistant','user']);assert.equal(snapshot[2].text,'Compare the files');assert.ok(c.messages.at(-1).id>snapshot.at(-1).id);
});
test('preparation includes both roles, then queues only the focused handoff',async()=>{
 const messages=[{id:1,role:'user',text:'Hey, how are you?'},{id:2,role:'assistant',text:'We have an original app and a new companion.'},{id:3,role:'user',text:'Compare their key files. Do not change anything.'}];
 let input;
 const result=await prepareHandoff({messages,afterUserId:0,fetchImpl:async(_,options)=>{input=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(ready)}}]})}}});
 const conversation=JSON.parse(input.messages[1].content).conversation;assert.ok(conversation.some(m=>m.role==='assistant'));
 const queued=formatHandoff(result);assert.match(queued,/Task: Compare/);assert.match(queued,/User constraints/);assert.doesNotMatch(queued,/how are you/);assert.doesNotMatch(queued,/USER:|ASSISTANT:/);
});
test('assistant suggestions and previously delegated input cannot authorize work',()=>{
 const messages=[{id:1,role:'user',text:'Old request'},{id:2,role:'assistant',text:'Delete everything?'}];
 assert.throws(()=>validateHandoff({...ready,source_user_ids:[2]},messages,0),/authorization/);
 assert.throws(()=>validateHandoff({...ready,source_user_ids:[1]},messages,1),/authorization/);
});
test('no new user request does not invoke the model',async()=>{
 const result=await prepareHandoff({messages:[{id:1,role:'user',text:'Already delegated'}],afterUserId:1,fetchImpl:()=>{throw Error('Must not call model')}});assert.equal(result.action,'none');
});
test('invalid output or helper failure never falls back to the raw transcript',async()=>{
 await assert.rejects(prepareHandoff({messages:[{id:3,role:'user',text:'Full raw transcript'}],afterUserId:0,fetchImpl:async()=>({ok:false,status:500})}),/Nothing was submitted/);
 assert.throws(()=>validateHandoff({...ready,task:'',source_user_ids:[]},[{id:3,role:'user',text:'Hi'}],0),/no clear/);
});
