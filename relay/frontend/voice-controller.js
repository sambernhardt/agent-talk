
import {SessionCost, saveSession, duration} from '../session-cost.mjs';
import {appendTranscript} from './transcript-store.mjs';
const token=document.querySelector('meta[name=voice-token]').content;
const $=id=>document.getElementById(id);
let selectedView='transcript';
function setView(view){selectedView=view;document.body.dataset.view=view;$('transcript-panel').hidden=view!=='transcript';$('session-history').hidden=view!=='history';$('history-tab').setAttribute('aria-expanded',String(view==='history'));$('history-tab').textContent=view==='history'?'Back to transcript':'History';}
$('history-tab').onclick=()=>setView(selectedView==='history'?'transcript':'history');
let canStart=false,toggleMode='idle',startGeneration=0;
function setToggle(mode){toggleMode=mode;const button=$('toggle');const running=mode==='active';$('waveform').dataset.active=String(running);button.disabled=mode==='starting'||mode==='stopping'||(mode==='idle'&&!canStart);button.setAttribute('aria-label',running?'End voice mode':'Enter voice mode');button.setAttribute('aria-pressed',String(running));button.dataset.tooltip=running?'Stop':'Play';}
function renderBar(seconds,cost){const time=seconds<60?`${Math.floor(seconds)}s`:duration(seconds);$('session-time').textContent=time;$('session-price').textContent=`$${cost.toFixed(2)}`;$('session-meter').dataset.tooltip=`${duration(seconds)} elapsed · estimated voice cost $${cost.toFixed(4)}`;}
let sessionCost=null,meterTimer,toastTimer;
let sessionHistory=[];
try{const saved=JSON.parse(localStorage.getItem('codexVoiceSessions')||'[]');if(Array.isArray(saved))sessionHistory=saved.filter(s=>s&&typeof s.id==='string'&&Number.isFinite(s.startedAt)&&Number.isFinite(s.seconds)&&s.seconds>=0&&Number.isFinite(s.cost)&&s.cost>=0).slice(0,100);}catch{}
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:4}).format(value);
function renderHistory(){const rows=sessionHistory.map(s=>{const li=document.createElement('li');const date=document.createElement('span');date.textContent=new Date(s.startedAt).toLocaleString();const total=document.createElement('span');total.textContent=`${duration(s.seconds)} · ${s.estimated?'≈ ':''}${money(s.cost)}`;li.append(date,total);return li;});if(!rows.length){const li=document.createElement('li');li.textContent='No completed sessions yet.';rows.push(li);}$('session-list').replaceChildren(...rows);}
function renderMeter(){if(!sessionCost)return;const s=sessionCost.snapshot();renderBar(s.elapsedSeconds,s.cost);}
function beginMeter(){sessionCost=new SessionCost(crypto.randomUUID());clearInterval(meterTimer);clearTimeout(toastTimer);$('session-toast').hidden=true;renderMeter();meterTimer=setInterval(renderMeter,1000);}
function finishMeter(seconds){if(!sessionCost)return;const first=sessionCost.endedAt===null;if(Number.isFinite(seconds))sessionCost.usage(seconds,Date.now(),true);sessionCost.finish();clearInterval(meterTimer);const s=sessionCost.snapshot();renderBar(s.seconds,s.cost);sessionHistory=saveSession(sessionHistory,s);try{localStorage.setItem('codexVoiceSessions',JSON.stringify(sessionHistory));}catch{}renderHistory();if(first||!$('session-toast').hidden){$('session-toast').textContent=`Voice session ended · ${duration(s.seconds)} · ${s.estimated?'≈ ':''}${money(s.cost)} voice cost`; $('session-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('session-toast').hidden=true,10000);}}
renderHistory();
let waveInput,waveOutput,waveFrame,lastWaveAt=0;
const waveBars=Array.from({length:4},()=>{const bar=document.createElement('span');$('waveform').append(bar);return bar;});
const inputWave=new Uint8Array(512),outputWave=new Uint8Array(512);
function resetWaveform(){waveBars.forEach((bar,index)=>{bar.style.height=`${[6,11,14,8][index]}px`;});}
resetWaveform();
function animateWaveform(now){waveFrame=requestAnimationFrame(animateWaveform);if(now-lastWaveAt<50)return;lastWaveAt=now;waveInput?.getByteTimeDomainData(inputWave);waveOutput?.getByteTimeDomainData(outputWave);for(let i=0;i<waveBars.length;i++){let peak=0;for(let j=Math.floor(i*512/waveBars.length);j<Math.floor((i+1)*512/waveBars.length);j++)peak=Math.max(peak,Math.abs(inputWave[j]-128),Math.abs(outputWave[j]-128));waveBars[i].style.height=`${3+Math.min(11,peak*.25)}px`;}}
let restartForChatChange=false;
let ws,ctx,stream,capture,source,mute,nextTime=0,sources=new Set(),lastUser=0,active=false;
function status(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
function log(role,text,options){appendTranscript(role,text,options);}
async function refresh(){try{const r=await fetch('/api/threads',{headers:{Authorization:`Bearer ${token}`}});const data=await r.json();if(!r.ok)throw Error(data.error);const selected=localStorage.getItem('codexConciergeChat')||$('threads').value;$('threads').replaceChildren(...data.threads.map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name.slice(0,110);return o;}));if(data.threads.some(t=>t.id===selected))$('threads').value=selected;canStart=data.gateway&&Boolean(data.threads.length);$('threads').disabled=!canStart;setToggle('idle');status(data.gateway?'Ready to talk':'Gateway key missing from server environment');}catch(e){status(e.message,true);}}
function clearAudio(){for(const s of sources){try{s.stop();}catch{}}sources.clear();nextTime=ctx?.currentTime||0;}
function play(base64){if(!ctx||!active)return;const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const pcm=new Int16Array(bytes.buffer);const buffer=ctx.createBuffer(1,pcm.length,24000);const channel=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)channel[i]=pcm[i]/32768;const s=ctx.createBufferSource();s.buffer=buffer;s.connect(waveOutput);const when=Math.max(ctx.currentTime+.025,nextTime);s.start(when);nextTime=when+buffer.duration;sources.add(s);s.onended=()=>sources.delete(s);}
async function cleanup(){active=false;capture?.disconnect();source?.disconnect();mute?.disconnect();stream?.getTracks().forEach(t=>t.stop());clearAudio();await ctx?.close().catch(()=>{});ctx=null;setToggle(ws && ws.readyState!==WebSocket.CLOSED?'stopping':'idle');$('threads').disabled=false;cancelAnimationFrame(waveFrame);resetWaveform();}
async function start(){
 const generation=++startGeneration;
 setToggle('starting');$('threads').disabled=true;localStorage.setItem('codexConciergeChat',$('threads').value);status('Opening microphone…');
 try{
  const requestedStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  if(generation!==startGeneration){requestedStream.getTracks().forEach(track=>track.stop());return;}
  stream=requestedStream;
  ctx=new AudioContext({sampleRate:24000});await ctx.resume();await ctx.audioWorklet.addModule('/audio-worklet.js');
  if(generation!==startGeneration)return;
  waveInput=ctx.createAnalyser();waveOutput=ctx.createAnalyser();waveInput.fftSize=waveOutput.fftSize=512;waveOutput.connect(ctx.destination);
  source=ctx.createMediaStreamSource(stream);capture=new AudioWorkletNode(ctx,'capture');mute=ctx.createGain();mute.gain.value=0;source.connect(capture);capture.connect(mute).connect(ctx.destination);source.connect(waveInput);waveInput.connect(mute);
  ws=new WebSocket(`ws://${location.host}/voice?token=${token}`);
  ws.onopen=()=>ws.send(JSON.stringify({type:'start',threadId:$('threads').value}));
  ws.onmessage=({data})=>{const e=JSON.parse(data);
   if(e.type==='listening'){beginMeter();active=true;waveFrame=requestAnimationFrame(animateWaveform);status('Listening · talk naturally');setToggle('active');$('threads').disabled=false;}
   else if(e.type==='session-usage'){sessionCost?.usage(e.seconds);renderMeter();}
   else if(e.type==='audio')play(e.audio);
   else if(e.type==='user-transcript'){const newTurn=Date.now()-lastUser>1200;if(newTurn)clearAudio();lastUser=Date.now();log('You',e.delta,{newTurn});}
   else if(e.type==='voice-transcript')log('Voice',e.delta);
   else if(e.type==='delegating'){status('Request queued · keep talking');log('Sent to Codex',e.text);}
   else if(e.type==='codex-delta')log('Codex',e.delta);
   else if(e.type==='codex-final'){log('Codex',e.text,{final:true});status('');}
   else if(e.type==='interrupt-audio')clearAudio();
   else if(e.type==='codex-progress')log('Codex progress',e.text);
   else if(e.type==='work-status'){work.set(e.id,e.state);$('requests').textContent=[...work].map(([id,state])=>`Request ${id}: ${state}`).join('\n');}
   else if(e.type==='status')status(e.text);
   else if(e.type==='handoff-error'){status(e.message,true);log('Handoff issue',e.message);}
   else if(e.type==='error'){status(e.message,true);log('Error',e.message);end(false);}
   else if(e.type==='ended'){finishMeter(e.seconds);cleanup();}
  };
  ws.onerror=()=>{status('Voice connection failed',true);end(false);};
  ws.onclose=async()=>{finishMeter();if(active)status('Voice session ended');await cleanup();if(restartForChatChange){restartForChatChange=false;start();}};
  capture.port.onmessage=({data})=>{if(!active||ws.readyState!==WebSocket.OPEN)return;const pcm=new Int16Array(data.length);let energy=0;for(let i=0;i<data.length;i++){const v=Math.max(-1,Math.min(1,data[i]));pcm[i]=Math.round(v*32767);energy+=v*v;}ws.send(JSON.stringify({type:'audio',speechAt:Math.sqrt(energy/data.length)>.02?Date.now():null,audio:btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)))}));};
 }catch(e){if(generation===startGeneration){status(e.message,true);end(false);}}
}
const work=new Map();
$('threads').onchange=()=>{localStorage.setItem('codexConciergeChat',$('threads').value);if(active){restartForChatChange=true;end();$('threads').disabled=true;status('Switching voice to selected chat…');}};
$('toggle').onclick=()=>{if(toggleMode==='active')end();else if(toggleMode==='idle')start();};
function end(update=true){startGeneration++;setToggle('stopping');if(update)status('Voice session ended');if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'stop'}));else ws?.close();cleanup();}
window.addEventListener('pagehide',()=>{finishMeter();stream?.getTracks().forEach(t=>t.stop());ws?.close();});refresh();
