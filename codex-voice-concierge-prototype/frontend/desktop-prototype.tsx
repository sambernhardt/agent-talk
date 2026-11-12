// PROTOTYPE: three desktop shells on the existing route, switchable via ?variant=.
import React,{useEffect,useState} from 'react';
import {AudioLines,ChevronLeft,ChevronRight,Minus,PanelRight,RectangleEllipsis,Settings2} from 'lucide-react';
import './desktop-prototype.css';
import {Popover,PopoverContent,PopoverTrigger} from './ui/popover';
type Mode='panel'|'capsule'|'attached';
type State={mode:Mode;threadId?:string|null;attachment?:{visible:boolean;roomBelow?:boolean;reason?:string}|null};
declare global{interface Window{voiceDesktop?:{mode:()=>Promise<State>;setMode:(mode:Mode)=>Promise<void>;hide:()=>void;settings:()=>void;popover:(open:boolean)=>Promise<void>;onClosePopover:(cb:()=>void)=>()=>void;passThrough:(value:boolean)=>void;update:(state:{active:boolean;phase?:'idle'|'starting'|'active'|'stopping';threadId?:string|null;error?:string|null})=>void;onCommand:(cb:(command:{id:string;action:'show'|'start'|'stop';threadId?:string})=>void)=>()=>void;onChange:(cb:(state:State)=>void)=>()=>void;onStop:(cb:()=>void)=>()=>void}}}
const modes:Mode[]=['panel','capsule','attached'];
const names={panel:'Menu panel',capsule:'Floating capsule',attached:'Codex chin'};
const icons={panel:RectangleEllipsis,capsule:AudioLines,attached:PanelRight};
export function DesktopPrototype(){
 const requested=new URLSearchParams(location.search).get('variant');
 const [state,setState]=useState<State>({mode:modes.includes(requested as Mode)?requested as Mode:'panel'});
 const enabled=!!window.voiceDesktop||modes.includes(requested as Mode);
 const [native]=useState(!!window.voiceDesktop);
 useEffect(()=>{
  if(!enabled)return;
  const desktop=window.voiceDesktop;
  const apply=(value:State)=>{setState(value);document.documentElement.dataset.variant=value.mode;document.documentElement.dataset.desktop=String(!!desktop);const url=new URL(location.href);url.searchParams.set('variant',value.mode);history.replaceState(null,'',url);};
  apply(state);
  const observer=new MutationObserver(()=>desktop?.update({active:document.getElementById('toggle')?.getAttribute('aria-pressed')==='true'}));
  observer.observe(document.getElementById('toggle')!,{attributes:true,attributeFilter:['aria-pressed']});
  const stop=desktop?.onStop(()=>{const button=document.getElementById('toggle')!;if(button.getAttribute('aria-pressed')==='true')button.click();});
  let passing=false;
  const pointer=(event:MouseEvent)=>{const next=document.documentElement.dataset.variant==='attached'&&event.clientY<16&&event.clientX>16&&event.clientX<window.innerWidth-16;if(next!==passing){passing=next;desktop?.passThrough(next);}};
  window.addEventListener('mousemove',pointer);
  const change=desktop?.onChange(apply);void desktop?.mode().then(apply);
  return()=>{observer.disconnect();stop?.();change?.();window.removeEventListener('mousemove',pointer);};
 },[enabled]);
 async function select(mode:Mode){if(window.voiceDesktop){await window.voiceDesktop.setMode(mode);return;}setState({mode});document.documentElement.dataset.variant=mode;const url=new URL(location.href);url.searchParams.set('variant',mode);history.replaceState(null,'',url);}
 useEffect(()=>{
  if(!enabled||native)return;
  const keys=(event:KeyboardEvent)=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;if((event.target as HTMLElement).closest('input,textarea,button,[contenteditable=true],[role=combobox]'))return;event.preventDefault();void select(modes[(modes.indexOf(state.mode)+(event.key==='ArrowRight'?1:2))%3]);};
  window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);
 },[enabled,native,state.mode]);
 if(!enabled)return null;
 return <>
  <div className="prototype-titlebar"><div className="prototype-brand"><AudioLines size={15}/><span>Voice</span></div>
   <Popover><PopoverTrigger asChild><button className="prototype-settings" aria-label="Companion settings" title="Companion settings" onClick={event=>{if(native){event.preventDefault();window.voiceDesktop?.settings();}}}><Settings2 size={15}/></button></PopoverTrigger>
    {!native?<PopoverContent className="prototype-settings-menu" align="end" sideOffset={6}>{modes.map(mode=>{const Icon=icons[mode];return <button key={mode} aria-pressed={state.mode===mode} onClick={()=>void select(mode)}><Icon size={14}/>{names[mode]}</button>;})}</PopoverContent>:null}
   </Popover>
   {native?<button className="prototype-hide" aria-label="Hide companion (voice keeps running)" title="Hide · ⌘⇧Space to return" onClick={()=>window.voiceDesktop?.hide()}><Minus size={15}/></button>:<span className="prototype-tag">LAB</span>}
  </div>
  {state.mode==='attached'?<div className="prototype-attachment" role="status"><span className={state.attachment?.visible?'connected':''}/>{native?(state.attachment?.visible?'Following your Codex window':state.attachment?.reason||'Looking for Codex…'):'Bottom bar preview · follows Codex in the desktop app'}</div>:null}
  {state.mode==='capsule'&&!native?<div className="prototype-capsule-hint">A little voice companion. Out of your way.</div>:null}
  {!native&&import.meta.env.DEV?<div className="prototype-switcher"><button aria-label="Previous layout" onClick={()=>void select(modes[(modes.indexOf(state.mode)+2)%3])}><ChevronLeft size={15}/></button><span>{names[state.mode]}</span><button aria-label="Next layout" onClick={()=>void select(modes[(modes.indexOf(state.mode)+1)%3])}><ChevronRight size={15}/></button></div>:null}
 </>;
}
