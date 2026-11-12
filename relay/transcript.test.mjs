import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceTranscript} from './frontend/transcript-store.mjs';
test('streamed chunks keep the same message identity; final Codex text replaces partial text',()=>{
 let messages=reduceTranscript([],'Codex','Hello',{id:'1'});
 messages=reduceTranscript(messages,'Codex',' world',{id:'2'});
 assert.equal(messages.length,1);assert.equal(messages[0].text,'Hello world');assert.equal(messages[0].id,'1');
 messages=reduceTranscript(messages,'Codex','Hello world!',{final:true,id:'3'});
 assert.equal(messages.length,1);assert.equal(messages[0].text,'Hello world!');assert.equal(messages[0].streaming,false);
});
test('speaker changes finalize preceding streams and preserve separate user/assistant messages',()=>{
 let messages=reduceTranscript([],'You','Question',{id:'1'});
 messages=reduceTranscript(messages,'Voice','Answer',{id:'2'});
 assert.equal(messages.length,2);assert.equal(messages[0].streaming,false);assert.equal(messages[0].from,'user');assert.equal(messages[1].from,'assistant');
 const earlier=messages[0];messages=reduceTranscript(messages,'Voice',' continues',{id:'3'});
 assert.equal(messages[0],earlier);assert.equal(messages[1].text,'Answer continues');
});
test('new turns do not merge and empty deltas do not create messages',()=>{
 let messages=reduceTranscript([],'Voice','One',{id:'1'});
 messages=reduceTranscript(messages,'Voice','Two',{id:'2',newTurn:true});
 assert.equal(messages.length,2);assert.equal(reduceTranscript(messages,'Voice',''),messages);
});
