// Transcript rendering is frame-batched; audio processing never waits for React.
let messages=[];
let frame=null;
let nextId=0;
const listeners=new Set();
export const getTranscript=()=>messages;
export function subscribeTranscript(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function reduceTranscript(previous,role,text,{final=false,newTurn=false,id}={}){
  if(!text)return previous;
  const last=previous.at(-1);
  const merges=last?.label===role&&!newTurn&&last.streaming;
  const message={id:merges?last.id:id,label:role,from:role==='You'?'user':'assistant',text:merges?(final?text:last.text+text):text,streaming:!final&&['You','Voice','Codex'].includes(role)};
  return merges?[...previous.slice(0,-1),message]:[...previous.map(m=>m.streaming?{...m,streaming:false}:m),message];
}
export function appendTranscript(role,text,options={}){
  messages=reduceTranscript(messages,role,text,{...options,id:String(++nextId)});
  if(frame!==null)return;
  frame=requestAnimationFrame(()=>{frame=null;for(const listener of listeners)listener();});
}
