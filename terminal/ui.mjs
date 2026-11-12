import {duration} from '../relay/session-cost.mjs';
import {pathToFileURL} from 'node:url';
import {asciiOrb, orbState} from './orb.mjs';
export const clean = value => String(value ?? '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
const bars=' ▁▂▃▄▅▆▇█';
export const controlsRow=rows=>Math.max(1,rows-1);
export function waveform(history,width){return history.slice(-width).map(v=>bars[Math.min(8,Math.max(0,Math.round(v*8)))]).join('').padStart(width,' ');}
export function transcriptLines(messages,columns){const width=Math.max(1,columns-3);return messages.flatMap(m=>{const text=`${clean(m.label)}: ${clean(m.text)}`,lines=[];for(let i=0;i<text.length;i+=width)lines.push(`  ${text.slice(i,i+width)}`);return lines;});}
export function layout(s,{columns=80,rows=24,configOpen=false}={}){
 const width=Math.max(1,columns-1),title=`  Codex   Chat ${clean(s.threadLabel||'Current chat')}`,changeX=Math.max(0,Math.min(title.length+3,width-10));
 const hits=[{x:Math.max(0,width-12),y:0,text:'[C Config]',key:'c'},{x:changeX,y:1,text:'[H Change]',key:'h'}];
 let x=2;for(const [text,key] of [['[S Start]','s'],['[X Stop]','x'],[s.muted?'[M Unmute]':'[M Mute]','m'],['[Q Quit]','q']]){if(x+text.length<=width){hits.push({x,y:controlsRow(rows)-1,text,key});x+=text.length+3;}}
 if(configOpen)hits.push({x:Math.max(0,width-24),y:2,text:'[T] Transcript',key:'t'},{x:Math.max(0,width-24),y:3,text:'[W] Waveforms',key:'w'});
 return {width,title,changeX,hits};
}
export function render(s,{columns=80,rows=24,demo=false,input=[],output=[],time=0,phase:motionPhase,color=false,bold=color,showTranscript=false,showWaveforms=false,configOpen=false,characterPreset='solid',customCharacters}={}){
 const {width,title,changeX,hits}=layout(s,{columns,rows,configOpen}),height=Math.max(1,rows-1),lines=Array(height).fill(''),cost=s.cost?.snapshot();
 const put=(y,text)=>{if(y>=0&&y<height)lines[y]=text.slice(0,width);};
 const overlay=(y,x,text)=>{if(y>=0&&y<height)lines[y]=(lines[y].slice(0,x).padEnd(x)+text).slice(0,width);};
 put(0,`  AGENT TALK${demo?' · DEMO / NO AUDIO OR NETWORK':''}`);put(1,title.slice(0,Math.max(0,changeX-2)));
 put(3,`  ${clean(s.state).toUpperCase()}${s.muted?' · MIC MUTED':''}   ${duration(cost?.elapsedSeconds||0)}   ${demo?'Fixture':cost?.estimated===false?'Usage':'Estimate'} $${(cost?.cost||0).toFixed(4)}`);
 const jobText={queued:'1 job queued for Codex',working:'1 job being worked on by Codex',completed:'1 job completed by Codex',failed:'1 job failed in Codex',error:'1 job failed in Codex'}[s.handoff?.state];
 if(jobText)put(4,`  ${jobText}`);
 let top=6;if(showWaveforms&&rows>=16){const waveWidth=Math.max(1,Math.min(58,width-7));put(6,`  IN  ${waveform(input,waveWidth)}`);put(7,`  OUT ${waveform(output,waveWidth)}`);top=9;}
 const bottom=Math.max(top,height-4);
 if(showTranscript){const transcript=transcriptLines(s.messages||[],columns),count=Math.min(transcript.length,Math.max(0,bottom-top+1));const start=bottom-count+1;transcript.slice(-count||transcript.length).forEach((line,i)=>put(start+i,line));}
 const available=Math.max(0,bottom-top),orbHeight=Math.min(14,available),level=output.at(-1)??s.output??0,state=orbState(s,level),phase=motionPhase??time*(state==='thinking'?2.3:state==='talking'?1.1:.5);
 const orb=showTranscript?[]:asciiOrb({columns:width,rows:orbHeight,time:phase,state,amplitude:level,color,characterPreset,customCharacters}),orbTop=top+Math.floor((available-orb.length)/2);
 orb.forEach((line,i)=>{lines[orbTop+i]=line;});
 const notice=clean(s.notice);if(notice!=='Press S to start'&&!notice.startsWith('Ready ·')&&!notice.startsWith('Voice companion handoff ·'))put(height-3,`  ${notice}`);
 for(const hit of hits)if(!['t','w'].includes(hit.key))overlay(hit.y,hit.x,hit.text);
 if(configOpen){const x=Math.max(0,width-24);overlay(2,x,`[T] Transcript  ${showTranscript?'On':'Off'}`.padEnd(24));overlay(3,x,`[W] Waveforms   ${showWaveforms?'On':'Off'}`.padEnd(24));}
 if(jobText){
  if(color)lines[4]=`\x1b[90m${lines[4]}\x1b[39m`;
  if(s.handoff?.path)lines[4]=`\x1b]8;;${pathToFileURL(s.handoff.path).href}\x1b\\${lines[4]}\x1b]8;;\x1b\\`;
 }
 if(bold)lines[0]=lines[0].replace('AGENT TALK','\x1b[1mAGENT TALK\x1b[22m');
 return lines.join('\n');
}
export class Controls{
 constructor(action,buttonRow=()=>10,hitboxes=null){Object.assign(this,{action,buttonRow,hitboxes});this.pending='';}
 feed(chunk){if(chunk==='\x1b'&&!this.pending){this.action('escape');return;}this.pending+=chunk;while(this.pending.length){if(this.pending.startsWith('\x1b')){const mouse=/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(this.pending);if(mouse){this.pending=this.pending.slice(mouse[0].length);const [,button,x,y,edge]=mouse;if(edge==='M'&&button==='0'){if(this.hitboxes){const hit=this.hitboxes().slice().reverse().find(h=>Number(y)===h.y+1&&Number(x)>=h.x+1&&Number(x)<=h.x+h.text.length);if(hit)this.action(hit.key);}else if(Number(y)===this.buttonRow()){const col=Number(x);if(col>=3&&col<=11)this.action('s');else if(col>=15&&col<=22)this.action('x');else if(col>=26&&col<=33)this.action('m');else if(col>=37&&col<=44)this.action('q');}}continue;}
 if(/^\x1b(?:\[<\d*(?:;\d*){0,2})?$/.test(this.pending))return;
 const escape=/^\x1b\[[0-9;?]*[A-Za-z~]/.exec(this.pending);this.pending=this.pending.slice(escape?.[0].length||1);continue;}
 const key=this.pending[0].toLowerCase();this.pending=this.pending.slice(1);if('sxm qchtw\x03'.includes(key)&&key!==' ')this.action(key==='\x03'?'q':key);}}
}
