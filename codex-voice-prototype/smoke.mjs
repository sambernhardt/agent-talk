// Optional live integration smoke check. Uses Gateway credits and an ephemeral Codex chat.
// Usage: node smoke.mjs /absolute/path/to/24khz-mono-pcm16.pcm
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import WebSocket from 'ws';
const audio = await readFile(process.argv[2]);
if (!audio.length) throw Error('Empty audio sample');
const child = spawn('codex', ['app-server'], { stdio: ['pipe','pipe','pipe'] });
const waiting = new Map(); let id = 0, live, streamTimer, transcript = '', outputBytes = 0, delegated = false, threadId, completed = false, answers = [], spoken = '', closing = false, resultAt = 0;
function rpc(method,params){return new Promise((resolve,reject)=>{const key=++id;waiting.set(key,{resolve,reject});child.stdin.write(JSON.stringify({id:key,method,params})+'\n');});}
const done = new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Smoke test timed out')),60000);
 readline.createInterface({input:child.stdout}).on('line',line=>{
  let m;try{m=JSON.parse(line)}catch{return}
  if(m.id!=null&&!m.method){const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}return}
  if(m.id!=null){child.stdin.write(JSON.stringify({id:m.id,error:{code:-32601,message:'Smoke test cannot approve requests'}})+'\n');return}
  if(m.params?.threadId===threadId&&m.method==='item/completed'&&m.params.item?.type==='agentMessage') answers.push(m.params.item.text);
  if(m.params?.threadId===threadId&&m.method==='turn/completed'){
   completed=m.params.turn.status==='completed';
   const result=answers.join('\n') || 'Codex returned no answer.';
   console.log('Codex turn:',m.params.turn.status, 'answer:', result); resultAt = Date.now();
   live.send(JSON.stringify({type:'session.commentary.append',delegation_id:delegated,content:'Codex result: '+result}));
  }
 });
 child.on('error',reject);
 (async()=>{
  await rpc('initialize',{clientInfo:{name:'codex_voice_smoke',version:'0.1.0'}});child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  const t=await rpc('thread/start',{ephemeral:true,approvalPolicy:'never',sandbox:'read-only'});threadId=t.thread.id;
  live=new WebSocket('wss://ai-gateway.vercel.sh/v1/live/sessions',{headers:{Authorization:`Bearer ${process.env.AI_GATEWAY_API_KEY}`}});
  live.on('open',()=>live.send(JSON.stringify({type:'session.start',session:{model:'openai/gpt-live-1',store:false,delegation:{type:'client'},audio:{format:{type:'audio/pcm',rate:24000}},instructions:'You are a voice companion to Codex. When the user asks anything, delegate it to Codex. Speak the result provided by the application. Keep replies short.'}})));
  live.on('message',async raw=>{try{
   const e=JSON.parse(raw);
   if(e.type==='session.started'){let offset=0;streamTimer=setInterval(()=>{const chunk=offset<audio.length?audio.subarray(offset,offset+960):Buffer.alloc(960);offset+=960;live.send(JSON.stringify({type:'session.input_audio.append',audio:chunk.toString('base64')}));},20);}
   if(e.type==='session.input_transcript.delta')transcript+=e.delta;
   if(e.type==='session.delegation.created'&&!delegated){delegated=e.delegation.id;console.log('Transcription:',transcript);await rpc('turn/start',{threadId,input:[{type:'text',text:'Answer briefly, no tools: '+transcript,text_elements:[]}]});}
   if(e.type==='session.output_transcript.delta'){spoken+=e.delta;process.stdout.write(e.delta);}
   if(e.type==='session.output_audio.delta'){if(completed)outputBytes+=Buffer.from(e.delta,'base64').length;if(completed&&outputBytes>24000&&Date.now()-resultAt>6000&&/four|4/i.test(spoken)&&!closing){closing=true;clearInterval(streamTimer);live.send(JSON.stringify({type:'session.close'}));}}
   if(e.type==='error')throw Error(e.error?.message||JSON.stringify(e));
   if(e.type==='session.closed'){clearTimeout(timeout);console.log(JSON.stringify({delegated:Boolean(delegated),codexCompleted:completed,outputBytes,seconds:e.usage?.seconds}));completed&&outputBytes?resolve():reject(Error('Incomplete smoke test'));live.close();}
  }catch(error){reject(error)}});
  live.on('error',reject);
  live.on('unexpected-response',(_,r)=>reject(Error(`Gateway HTTP ${r.statusCode}`)));
 })().catch(reject);
});
try{await done;}finally{clearInterval(streamTimer);live?.terminate();child.kill();}
