const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('voiceDesktop',Object.freeze({
 onCommand:callback=>{const handler=(_,command)=>callback(command);ipcRenderer.on('voice:command',handler);ipcRenderer.send('voice:commands-ready');return()=>ipcRenderer.removeListener('voice:command',handler);},
 mode:()=>ipcRenderer.invoke('voice:mode'),
 setMode:mode=>ipcRenderer.invoke('voice:set-mode',mode),
 hide:()=>ipcRenderer.send('voice:hide'),
 popover:open=>ipcRenderer.invoke('voice:popover',open),
 onClosePopover:callback=>{ipcRenderer.on('voice:close-popover',callback);return()=>ipcRenderer.removeListener('voice:close-popover',callback);},
 settings:()=>ipcRenderer.send('voice:settings'),
 passThrough:value=>ipcRenderer.send('voice:pass-through',value),
 update:state=>ipcRenderer.send('voice:state',state),
 onChange:callback=>{const handler=(_,state)=>callback(state);ipcRenderer.on('voice:change',handler);return()=>ipcRenderer.removeListener('voice:change',handler);},
 onStop:callback=>{const handler=()=>callback();ipcRenderer.on('voice:stop',handler);return()=>ipcRenderer.removeListener('voice:stop',handler);}
}));
