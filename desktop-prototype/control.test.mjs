import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseArgs} from './launch.mjs';
const {VoiceControl,serve,request,socketPath}=createRequire(import.meta.url)('./control.cjs');
test('parsing requires explicit start thread and rejects ambiguous options',()=>{
 assert.deepEqual(parseArgs([]),{action:'show'});assert.deepEqual(parseArgs(['start','--thread-id','thread-1']),{action:'start',threadId:'thread-1'});
 assert.deepEqual(parseArgs(['--status']),{action:'status'});
 for(const args of [['start'],['--thread-id'],['stop','start'],['--oops'],['show','--thread-id','a b']])assert.throws(()=>parseArgs(args));
 assert.equal(socketPath('/a'),socketPath('/a/'));assert.notEqual(socketPath('/a'),socketPath('/b'));
});
test('show binds without audio; start waits for matching phase and thread; stop merges partial state',async()=>{
 const sent=[],shown=[];const control=new VoiceControl(command=>sent.push(command),thread=>shown.push(thread));
 await control.handle({action:'show',threadId:'one'});assert.equal(sent[0].action,'show');assert.deepEqual(shown,['one']);
 const started=control.handle({action:'start',threadId:'one'});assert.equal(sent[1].action,'start');
 control.update({active:true});assert.equal(control.pending.action,'start');
 control.update({phase:'active',threadId:'other'});assert.equal(control.pending.action,'start');
 control.update({phase:'active',threadId:'one'});await started;
 await control.handle({action:'start',threadId:'one'});assert.equal(sent.length,2);
 await assert.rejects(control.handle({action:'show',threadId:'two'}),/Stop voice/);
 const stopped=control.handle({action:'stop'});control.update({active:false});assert.equal(control.state.threadId,'one');control.update({phase:'idle'});await stopped;
});
test('errors, overlapping commands, and missing renderer confirmation fail visibly',async()=>{
 const control=new VoiceControl(()=>{},()=>{},{timeout:20});const pending=control.handle({action:'start',threadId:'one'});
 await assert.rejects(control.handle({action:'start',threadId:'two'}),/pending/);control.update({error:'Microphone denied'});await assert.rejects(pending,/Microphone denied/);
 await assert.rejects(control.handle({action:'start',threadId:'one'}),/did not confirm/);
});
test('local socket round trips status and validation with private permissions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'voice-control-test-'));const socket=path.join(root,'private','control.sock');let server;
 try{server=await serve(socket,command=>({action:command.action,phase:'idle'}));assert.equal((await stat(socket)).mode&0o777,0o600);assert.equal((await request(socket,{action:'status'})).phase,'idle');await assert.rejects(request(socket,{action:'wat'}),/Expected/);}
 finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test('stop cancels pending start and ignores late active reports',async()=>{
 const sent=[];const control=new VoiceControl(command=>sent.push(command),()=>{});
 const start=control.handle({action:'start',threadId:'one'});const rejected=assert.rejects(start,/cancelled/);
 const stop=control.handle({action:'stop'});await rejected;assert.equal(sent.at(-1).action,'stop');
 control.update({phase:'active',active:true,threadId:'one'});assert.equal(control.pending.action,'stop');
 control.update({phase:'idle',active:false});await stop;
});
