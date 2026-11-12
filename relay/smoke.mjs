// Real Gateway audio; simulated Codex queue/history. Never submits a chat message.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
const pcm = await readFile(process.argv[2]);
const dir = await mkdtemp('/tmp/codex-concierge-smoke-');
const capture = dir + '/queue.json';
const stub = dir + '/codex';
const port = 4321;
await writeFile(stub, `#!/usr/bin/env node
const fs=require('node:fs');
if(process.argv[2]==='queue'){fs.writeFileSync('${capture}',JSON.stringify({args:process.argv.slice(2),at:Date.now()}));process.exit(0)}
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);if(m.id==null)return;let result={};
 if(m.method==='thread/read')result={thread:{id:m.params.threadId}};
 if(m.method==='thread/turns/list'){
  const q=fs.existsSync('${capture}')?JSON.parse(fs.readFileSync('${capture}')):null;
  const done=q&&Date.now()-q.at>5000;
  result={data:q?[{id:'work',status:done?'completed':'interrupted',completedAt:done?Math.floor(Date.now()/1000):null,items:[
   {id:'user',type:'userMessage',content:[{type:'text',text:q.args.at(-1)}]},
   {id:'progress',type:'agentMessage',phase:'commentary',text:'I am checking the calculation.'},
   ...(done?[{id:'answer',type:'agentMessage',phase:'final_answer',text:'Two plus two is four.'}]:[])
  ]}]:[]};
 }
 process.stdout.write(JSON.stringify({id:m.id,result})+'\\n');
});
`, {mode:0o700});
const server = spawn(process.execPath, ['server.mjs'], { cwd:fileURLToPath(new URL('.',import.meta.url)), env:{...process.env,PORT:String(port),CODEX_BIN:stub}, stdio:['ignore','pipe','pipe'] });
server.stderr.on('data',d=>process.stderr.write(d));
let ws, feed, timeout;
try {
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 const base=`http://127.0.0.1:${port}`;
 const html=await(await fetch(base)).text();const token=html.match(/<meta\s+name="voice-token"\s+content="([^"]+)"/)[1];
 ws=new WebSocket(`ws://127.0.0.1:${port}/voice?token=${token}`,{origin:base});
 let queued=0,completed=false,progress=false,ack=false,spoken='',audioAfterResult=0,resultAt=0;
 await new Promise((resolve,reject)=>{
  timeout=setTimeout(()=>reject(Error('Conversational smoke timed out')),60000);
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'start',threadId:'voice-smoke-work-chat'})));
  ws.on('message',raw=>{
   const e=JSON.parse(raw);
   if(e.type==='error'||e.type==='handoff-error')reject(Error(e.message));
   if(e.type==='listening'){
    let offset=0;feed=setInterval(()=>{const chunk=offset<pcm.length?pcm.subarray(offset,offset+960):Buffer.alloc(960);offset+=960;ws.send(JSON.stringify({type:'audio',audio:chunk.toString('base64')}))},20);
   }
   if(e.type==='user-transcript')process.stdout.write(e.delta);
   if(e.type==='delegating'){queued++;console.log('\nDelegated to selected work chat.');}
   if(e.type==='codex-progress'){progress=true;console.log('Observed actual progress.');}
   if(e.type==='codex-final'){completed=true;resultAt=Date.now();console.log('Received Codex result:',e.text);}
   if(e.type==='voice-transcript'){
    if(queued&&!completed)ack=true;
    if(completed)spoken+=e.delta;
    process.stdout.write(e.delta);
   }
   if(e.type==='audio'&&completed){
    audioAfterResult+=Buffer.from(e.audio,'base64').length;
    if(/four|4/i.test(spoken)&&Date.now()-resultAt>5000&&audioAfterResult>24000)resolve();
   }
  });
 });
 if(queued!==1||!progress||!ack||!completed)throw Error(JSON.stringify({queued,progress,ack,completed}));
 const request=JSON.parse(await readFile(capture,'utf8')).args.at(-1);
 if(!request.startsWith('Voice companion handoff\n\nTask: ')||!/two|2/i.test(request))throw Error('Expected a focused calculation handoff');
 console.log('\nPASS:',JSON.stringify({queued,progress,acknowledgedWhilePending:ack,audioAfterResult}));
 ws.send(JSON.stringify({type:'stop'}));
} finally {
 clearTimeout(timeout);clearInterval(feed);ws?.terminate();server.kill();
 await new Promise(resolve=>server.once('exit',resolve));
 await rm(dir,{recursive:true,force:true});
}
