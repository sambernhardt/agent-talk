import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {handoffWriter} from './handoff-file.mjs';
import {VoiceSession} from './session.mjs';
import {render} from './ui.mjs';

test('handoff summary links to the complete body saved privately',async()=>{
 const save=handoffWriter();let file;
 const session=new VoiceSession({thread:'thread-id',saveHandoff:async data=>(file=await save(data))});
 const text='Voice companion handoff\n\nTask: Full request with relevant context.\n'.repeat(30);
 try{
  session.receive({type:'delegating',id:'a1b2c3d4',text});
  for(let i=0;i<100&&!session.handoff.path;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(file);assert.equal(await readFile(file,'utf8'),text);
  assert.equal((await stat(file)).mode&0o777,0o600);
  assert.equal((await stat(path.dirname(file))).mode&0o777,0o700);
  const frame=render(session,{rows:12,columns:100});
  assert.match(frame.split('\n')[4],/1 job queued for Codex/);
  assert.ok(!frame.includes('Voice companion handoff ·'));
  assert.ok(!frame.includes('Voice $3/hr'));
  assert.match(frame,/handoff-a1b2c3d4.txt/);assert.ok(frame.includes('file://'));
  assert.ok(!frame.includes('Full request with relevant context'));
  session.receive({type:'work-status',id:'other',state:'completed'});
  assert.equal(session.handoff.state,'queued');
  session.receive({type:'work-status',id:'a1b2c3d4',state:'working'});
  assert.match(render(session,{color:true}).split('\n')[4],/\x1b\[90m  1 job being worked on by Codex\x1b\[39m/);
  session.receive({type:'work-status',id:'a1b2c3d4',state:'completed'});
  assert.match(render(session).split('\n')[4],/1 job completed by Codex/);
  session.fail(new Error('Microphone disconnected'));
  session.receive({type:'work-status',id:'a1b2c3d4',state:'completed'});
  assert.match(render(session,{rows:12}),/Microphone disconnected/);
 }finally{if(file)await rm(path.dirname(file),{recursive:true,force:true});}
});
test('invalid handoff filenames cannot escape the private directory',async()=>{
 await assert.rejects(handoffWriter()({id:'../../outside',text:'body'}),/identifier/);
});
test('file persistence failure does not end the voice session',async()=>{
 const session=new VoiceSession({thread:'t',saveHandoff:async()=>{throw Error('disk unavailable');}});
 session.state='listening';session.receive({type:'delegating',id:'id',text:'request'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(session.state,'listening');assert.equal(session.handoff.fileError,true);
 assert.match(render(session).split('\n')[4],/1 job queued for Codex/);
});
