import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=(await readFile(new URL('./frontend/voice-controller.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
function harness(){
 const elements=new Map();let command,resolveMic,micRequests=0,stopped=0;
 const states=[];let refreshGate=null,releaseRefresh;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'thread-a',dataset:{},style:{},options:[],content:'token',append(){},replaceChildren(...options){this.options=options;},setAttribute(){},dispatchEvent(){},getAttribute(){return 'false';}});
  return elements.get(id);
 };
 const sandbox={console,Uint8Array,Int16Array,Map,Set,Promise,Event,URLSearchParams,location:{search:'',host:'127.0.0.1:4330'},
  document:{querySelector:()=>element('meta'),getElementById:element,createElement:()=>({style:{},append(){}}),body:{dataset:{}}},
  localStorage:{getItem:()=>null,setItem(){}},
  window:{voiceDesktop:{onCommand:fn=>{command=fn;},update:state=>states.push(state)},addEventListener(){}},
  navigator:{mediaDevices:{getUserMedia(){micRequests++;return new Promise(resolve=>{resolveMic=resolve;});}}},
  fetch:async()=>{await refreshGate;return {ok:true,json:async()=>({threads:[{id:'thread-a',name:'Task A'}],gateway:true})};},
  setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},cancelAnimationFrame(){},
  appendTranscript(){},duration:()=>'',SessionCost:class{},saveSession:()=>[],
  WebSocket:{OPEN:1,CLOSED:3},AudioContext:class{constructor(){throw Error('Audio should not open after stop');}}
 };
 vm.runInNewContext(source,sandbox);
 return {send:value=>command(value),states,holdRefresh(){refreshGate=new Promise(resolve=>{releaseRefresh=resolve;});},releaseRefresh(){releaseRefresh();},get micRequests(){return micRequests;},get stopped(){return stopped;},resolveMic:()=>resolveMic({getTracks:()=>[{stop(){stopped++;}}]})};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('desktop launch rejects unknown threads before requesting the microphone',async()=>{
 const app=harness();await flush();app.send({action:'start',threadId:'unavailable'});await flush();
 assert.equal(app.micRequests,0);assert.ok(app.states.some(state=>state.error?.includes('unavailable')));
});
test('stop during microphone permission cancels startup and releases the late stream',async()=>{
 const app=harness();await flush();app.send({action:'start',threadId:'thread-a'});await flush();
 assert.equal(app.micRequests,1);app.send({action:'stop'});app.resolveMic();await flush();
 assert.equal(app.stopped,1);assert.equal(app.states.at(-1).phase,'idle');
 assert.ok(!app.states.some(state=>state.active));
});
test('show binds the requested thread without opening audio',async()=>{
 const app=harness();await flush();app.send({action:'show',threadId:'thread-a'});await flush();
 assert.equal(app.micRequests,0);assert.equal(app.states.at(-1).threadId,'thread-a');
 assert.equal(app.states.at(-1).phase,'idle');
});
test('stop while thread discovery is pending prevents later microphone startup',async()=>{
 const app=harness();await flush();app.holdRefresh();app.send({action:'start',threadId:'thread-a'});await flush();
 app.send({action:'stop'});app.releaseRefresh();await flush();
 assert.equal(app.micRequests,0);assert.equal(app.states.at(-1).phase,'idle');
});
