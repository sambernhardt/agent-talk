import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {characterPresets} from './orb.mjs';
import {render,Controls} from './ui.mjs';
import {createScreen} from './screen.mjs';
export const initialConfig={characterPreset:'solid',customCharacters:'.:;-=+*#%@',showTranscript:false,showWaveforms:false,configOpen:false,muted:false,color:true,animate:true,threadLabel:'Live terminal preview',state:'listening',job:'none',inputLevel:0.5,outputLevel:0.6,speed:1,transcript:'You: Show me the latest changes.\nVoice: Here is your live terminal preview.',notice:'Browser controls → terminal output'};
export function validatePatch(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Expected config object');
 for(const [key,value] of Object.entries(patch)){
  if(!Object.hasOwn(initialConfig,key)||typeof value!==typeof initialConfig[key])throw Error(`Invalid setting: ${key}`);
  if(typeof value==='string'&&(value.length>8000||/[\x00-\x08\x0b-\x1f\x7f]/.test(value)))throw Error(`Invalid ${key}`);
  if(typeof value==='number'&&(!Number.isFinite(value)||value<0||value>(key==='speed'?3:1)))throw Error(`Invalid ${key}`);
 }
 if(patch.state&&!['idle','starting','listening','ended','error'].includes(patch.state))throw Error('Invalid state');
 if(patch.job&&!['none','queued','working','completed','failed'].includes(patch.job))throw Error('Invalid job');
 if(patch.characterPreset&&!Object.hasOwn(characterPresets,patch.characterPreset)&&patch.characterPreset!=='custom')throw Error('Invalid character preset');
 if('customCharacters' in patch && (!patch.customCharacters.length || Array.from(patch.customCharacters).length>64 || !/^[\x21-\x7e\u00b7\u2022\u25cf\u2591-\u2593\u2588]+$/.test(patch.customCharacters)))throw Error('Use 1–64 characters: ASCII, · • ● ░ ▒ ▓ █');
 return patch;
}
export async function startPreviewServer({port=0,token=randomUUID(),config:startingConfig={},onChange=()=>{}}={}){
 let config={...initialConfig,...validatePatch(startingConfig)};const page=await readFile(new URL('./preview.html',import.meta.url),'utf8');
 const server=http.createServer((req,res)=>{
  if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
  if(req.method!=='GET'||req.url!==`/?token=${token}`){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end(page.replaceAll('__TOKEN__',token));
 });
 const revision=randomUUID();
 const sockets=new WebSocketServer({noServer:true,maxPayload:16384});
 server.on('upgrade',(req,socket,head)=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  if(req.headers.host!==new URL(origin).host||req.headers.origin!==origin||req.url!==`/config?token=${token}`){socket.destroy();return;}
  sockets.handleUpgrade(req,socket,head,ws=>sockets.emit('connection',ws));
 });
 sockets.on('connection',ws=>{
  ws.send(JSON.stringify({config,revision}));ws.on('error',()=>{});
  ws.on('message',data=>{try{config={...config,...validatePatch(JSON.parse(data.toString()))};onChange(config);for(const client of sockets.clients)if(client.readyState===1)client.send(JSON.stringify({config}));}catch(error){ws.send(JSON.stringify({error:error.message}));}});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/?token=${token}`,getConfig:()=>({...config}),close:async()=>{for(const ws of sockets.clients)ws.terminate();await new Promise(resolve=>sockets.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}
export async function preview(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Run the preview in an interactive terminal.');
 let config={...initialConfig,...JSON.parse(process.env.AGENT_TALK_PREVIEW_CONFIG||'{}')},tick=0,phase=0,timer;
 const service=await startPreviewServer({port:Number(process.env.AGENT_TALK_PREVIEW_PORT||0),token:process.env.AGENT_TALK_PREVIEW_TOKEN||randomUUID(),config,onChange:value=>{config=value;process.send?.({config});draw();}}),screen=createScreen(process.stdout),input=[],output=[];
 const draw=()=>{
  if(config.animate){tick+=0.1*config.speed;phase+=0.1*config.speed;}
  input.push(config.muted?0:config.inputLevel*Math.abs(Math.sin(tick*4.2)));output.push(config.outputLevel*Math.abs(Math.cos(tick*2.7)));
  if(input.length>80){input.shift();output.shift();}
  const session={...config,handoff:config.job==='none'?null:{state:config.job},messages:config.transcript.split('\n').filter(Boolean).map(line=>{const i=line.indexOf(':');return {label:i<0?'Voice':line.slice(0,i),text:i<0?line:line.slice(i+1).trim()};})};
  screen.draw(render(session,{...config,columns:process.stdout.columns||80,rows:process.stdout.rows||24,demo:true,input,output,time:tick,phase,bold:true,color:config.color&&!('NO_COLOR' in process.env)}),process.stdout.columns||80);
 };
 console.log(`Web controls: ${service.url}\nOpen this URL in your browser. Q quits the preview.`);
 process.send?.({url:service.url});
 config.notice=service.url;const wasRaw=process.stdin.isRaw;
 await new Promise(resolve=>{
  let closing=false;
  const quit=()=>{if(closing)return;closing=true;clearInterval(timer);process.stdin.off('data',onData);process.stdin.setRawMode(Boolean(wasRaw));process.stdin.pause();process.stdout.write('\x1b[?2026l\x1b[?25h\x1b[?1049l');process.off('SIGINT',quit);process.off('SIGTERM',quit);process.off('message',onMessage);void service.close().then(resolve);};
  const onMessage=message=>{if(message==='reload')quit();};
  process.on('message',onMessage);
  const controls=new Controls(key=>{if(key==='q')quit();}),onData=data=>controls.feed(data.toString());
  process.on('SIGINT',quit);process.on('SIGTERM',quit);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);
  process.stdout.write('\x1b[?1049h\x1b[?25l');timer=setInterval(draw,100);draw();
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url))preview().catch(error=>{console.error(error.message);process.exitCode=1;});
