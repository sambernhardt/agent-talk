import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import {startPreviewServer,validatePatch} from './preview.mjs';
import {render} from './ui.mjs';
test('preview rejects malformed and terminal escape inputs',()=>{
 for(const patch of [null,[],{unknown:true},{speed:Infinity},{outputLevel:2},{state:'bogus'},{threadLabel:'\x1b[2J'},{showTranscript:'true'},JSON.parse('{"__proto__":{}}')])assert.throws(()=>validatePatch(patch));
 assert.deepEqual(validatePatch({showTranscript:true,speed:2}),{showTranscript:true,speed:2});
});
test('web config streams into the real renderer and invalid updates preserve state',async()=>{
 let frame='';const service=await startPreviewServer({onChange:config=>{frame=render({...config,messages:[{label:'You',text:config.transcript}]},{...config,columns:100,rows:30});}});
 try{
  assert.equal((await fetch(service.url)).status,200);
  assert.equal((await fetch(new URL('/',service.url))).status,404);
  const url=new URL(service.url),ws=new WebSocket(`ws://${url.host}/config${url.search}`,{origin:url.origin});
  const initial=JSON.parse((await once(ws,'message'))[0]);assert.equal(initial.config.showTranscript,false);
  const reply=once(ws,'message');ws.send(JSON.stringify({showTranscript:true,showWaveforms:true,threadLabel:'Browser driven',transcript:'Updated live'}));
  assert.equal(JSON.parse((await reply)[0]).config.showTranscript,true);assert.match(frame,/Browser driven/);assert.match(frame,/Updated live/);assert.match(frame,/IN/);
  const bad=once(ws,'message');ws.send('{"outputLevel":9}');assert.ok(JSON.parse((await bad)[0]).error);assert.equal(service.getConfig().outputLevel,0.6);
  ws.close();await once(ws,'close');
 }finally{await service.close();}
});
