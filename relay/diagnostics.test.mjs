import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import {Diagnostics,failureDetails} from './diagnostics.mjs';
import {queueMessage} from './queue-message.mjs';
test('queue termination metadata survives persistence/restart without message or stderr leakage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-diagnostics-'));
 try {
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  const queued=queueMessage('chat','private transcript',()=>child);
  child.stderr.emit('data','Bearer private-key');child.emit('close',null,'SIGKILL');
  let error;try{await queued;}catch(e){error=e;}
  assert.equal(error.signal,'SIGKILL');
  const log=new Diagnostics(pathToFileURL(join(dir,'events.jsonl')));
  log.record({at:'2026-11-11T00:00:00Z',stage:'handoff-error',threadId:'chat',delegationId:'delegation',...failureDetails(error,'queue'),message:error.message,transcript:'private transcript'});
  await log.chain;
  const reopened=new Diagnostics(join(dir,'events.jsonl'));
  const events=await reopened.read('chat');
  assert.equal(events.length,1);assert.equal(events[0].signal,'SIGKILL');assert.equal(events[0].phase,'queue');
  assert.match(events[0].hint,/before retrying/);assert.doesNotMatch(JSON.stringify(events),/private-key|private transcript/);
  assert.deepEqual(await reopened.read('other-chat'),[]);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('bounded log rotates and keeps recent failure records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-diagnostics-'));
 try {const log=new Diagnostics(join(dir,'events.jsonl'),1);
 log.record({stage:'queue-started'});log.record({stage:'handoff-error',exitCode:1});await log.chain;
 assert.deepEqual((await log.read()).map(e=>e.stage),['queue-started','handoff-error']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Gateway and history failures include actionable phase without raw errors',()=>{
 assert.equal(failureDetails({httpStatus:429},'preparation').httpStatus,429);
 assert.equal(failureDetails({message:'thread/turns/list timed out'},'baseline-read').reason,'timeout');
 assert.equal(failureDetails({code:'ENOENT'},'queue').errorCode,'ENOENT');
});
