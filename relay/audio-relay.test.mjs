import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const server=await readFile(new URL('./server.mjs',import.meta.url),'utf8');
// Exercise the real browser-message handler, with network/queue boundaries stubbed.
const begin=server.indexOf("  ws.on('message', async raw => {")+"  ws.on('message', async raw => {".length;
const end=server.indexOf("\n  });\n  ws.on('close'",begin);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const handler=new AsyncFunction('raw','c','send','WebSocket','ws',server.slice(begin,end));
test('speech followed by quiet microphone frames all reaches Gateway so it can detect a turn ending',async()=>{
 const forwarded=[];
 const c={closing:false,live:{readyState:1},fail(message){throw Error(message)}};
 const ws={close(){}};
 for(const speechAt of [123,null,null,null])await handler(JSON.stringify({type:'audio',speechAt,audio:'AAAA'}),c,(_,e)=>forwarded.push(e),{OPEN:1},ws);
 assert.equal(forwarded.length,4,'Quiet frames must reach Gateway, not be discarded before end-of-turn detection');
 assert.ok(forwarded.every(e=>e.type==='session.input_audio.append'));
});
