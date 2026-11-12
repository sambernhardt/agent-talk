import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Check, ChevronsUpDown} from 'lucide-react';
import {Popover, PopoverContent, PopoverTrigger} from './ui/popover';
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from './ui/command';

const select = document.getElementById('threads') as HTMLSelectElement;
function readSelection() {
  return {value:select.value, disabled:select.disabled, chats:Array.from(select.options).map(o=>({id:o.value,name:o.textContent || 'Untitled chat'}))};
}
function ChatPicker() {
  const [selection,setSelection]=React.useState(readSelection);
  const [open,setOpen]=React.useState(false);
  React.useEffect(()=>{
    const update=()=>setSelection(readSelection());
    const observer=new MutationObserver(update);
    observer.observe(select,{childList:true,attributes:true,subtree:true});
    select.addEventListener('change',update);update();
    return ()=>{observer.disconnect();select.removeEventListener('change',update);};
  },[]);
  React.useEffect(()=>{if(selection.disabled)setOpen(false);},[selection.disabled]);
  React.useEffect(()=>window.voiceDesktop?.onClosePopover(()=>setOpen(false)),[]);
  React.useEffect(()=>{
    const desktop=window.voiceDesktop;if(!desktop)return;
    document.documentElement.dataset.pickerOpen=String(open);
    void desktop.popover(open);
    return()=>{document.documentElement.dataset.pickerOpen='false';void desktop.popover(false);};
  },[open]);
  const chosen=selection.chats.find(chat=>chat.id===selection.value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="chat-combobox-trigger" role="combobox" aria-label="Codex chat" aria-expanded={open} disabled={selection.disabled}
        onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}>
        <span>{chosen?.name || 'Select a chat…'}</span><ChevronsUpDown aria-hidden="true" size={14}/>
      </button>
    </PopoverTrigger>
    <PopoverContent className="chat-combobox-popover" align="start" side={window.voiceDesktop?"top":"bottom"} sideOffset={10}>
      <Command label="Choose a Codex chat">
        <CommandInput placeholder="Search chats…" aria-label="Search chats"/>
        <CommandList aria-label="Codex chats">
          <CommandEmpty>No chats found.</CommandEmpty>
          <CommandGroup>
            {selection.chats.map(chat=><CommandItem key={chat.id} value={`${chat.name} ${chat.id}`} onSelect={()=>{
              setOpen(false);
              if(chat.id!==select.value){select.value=chat.id;select.dispatchEvent(new Event('change',{bubbles:true}));}
              setSelection(readSelection());
            }}>
              <Check aria-hidden="true" size={14} style={{opacity:chat.id===selection.value?1:0}}/><span>{chat.name}</span>
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
createRoot(document.getElementById('chat-picker-root')!).render(<ChatPicker/>);
