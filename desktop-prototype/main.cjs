// PROTOTYPE: three desktop presentations around the existing local voice relay.
const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,globalShortcut,screen,dialog,shell,systemPreferences}=require('electron');
const {spawn,spawnSync}=require('node:child_process');
const {mkdir}=require('node:fs/promises');
const path=require('node:path');
const readline=require('node:readline');
const {fit,attachedBounds,hasChinRoom,trayBounds}=require('./geometry.cjs');
const windowOrder=require(app.isPackaged?'./resources/window-order.node':'./.build/window-order.node');
const {socketPath,serve,VoiceControl}=require('./control.cjs');
let controlServer,commandReady=false;
const voiceControl=new VoiceControl(command=>{if(!commandReady)throw Error('Voice renderer is not ready.');win.webContents.send('voice:command',command);},()=>place('attached'));
const MODES=new Set(['panel','capsule','attached']);
const port=Number(process.env.CODEX_DESKTOP_PORT||4330);
const origin=`http://127.0.0.1:${port}`;
let win,tray,relay,tracker,mode='panel',quitting=false,pinned=true,attachment=null,ready=false,popoverBounds=null;
const relayPath=app.isPackaged?path.join(__dirname,'resources/relay'):path.join(__dirname,'../codex-voice-concierge-prototype');
const helperPath=app.isPackaged?path.join(__dirname,'resources/codex-window-helper'):path.join(__dirname,'.build/codex-window-helper');
const extraPath=[process.env.PATH,'/opt/homebrew/bin','/usr/local/bin',path.join(app.getPath('home'),'.local/bin'),path.join(app.getPath('home'),'.cargo/bin')].filter(Boolean).join(':');
function trusted(event){return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&new URL(event.senderFrame.url).origin===origin;}
let lastPresentation='';
function change(){
 const state={mode,pinned,threadId:voiceControl.state.threadId,attachment:attachment?{visible:attachment.visible,roomBelow:attachment.roomBelow,reason:attachment.reason}:null};
 const signature=JSON.stringify(state);
 if(ready&&signature!==lastPresentation){lastPresentation=signature;win.webContents.send('voice:change',state);}
}
function stopTracker(){tracker?.kill();tracker=null;attachment=null;}
function positionAttached(){
 if(popoverBounds)return;
 if(!attachment?.visible||!attachment.bounds){change();return;}
 const area=screen.getDisplayMatching(attachment.bounds).workArea;
 const bounds=attachedBounds(attachment.bounds,area);
 attachment.roomBelow=hasChinRoom(bounds,area);
 if(!attachment.roomBelow){win.hide();tray.setToolTip('Codex Voice · make 64px of space below Codex for the chin');change();return;}
 win.setBounds(bounds,false);windowOrder.round(win.getNativeWindowHandle(),mode==='attached');
 if(attachment.frontmost||win.isFocused()){win.showInactive();windowOrder.below(win.getNativeWindowHandle(),attachment.windowId);}else win.hide();
 change();
}
function startTracker(){
 tracker=spawn(helperPath,[],{stdio:['ignore','pipe','ignore']});
 readline.createInterface({input:tracker.stdout}).on('line',line=>{
  try{attachment=JSON.parse(line);if(!win||win.isDestroyed()||mode!=='attached')return;
   if(attachment.visible)positionAttached();else{win.showInactive();change();}
  }catch{}
 });
 tracker.on('error',()=>{attachment={visible:false,reason:'Window helper unavailable. Run npm run build:helper.'};change();});
}
function place(newMode,show=true){
 if(!MODES.has(newMode)||!win||win.isDestroyed())return;
 if(popoverBounds){win.setBounds(popoverBounds);popoverBounds=null;}
 stopTracker();win.setIgnoreMouseEvents(false);mode=newMode;
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 if(mode==='panel')win.setBounds(trayBounds(tray.getBounds(),area));
 if(mode==='capsule')win.setBounds(fit({x:area.x+(area.width-460)/2,y:area.y+area.height-184,width:460,height:152},area));
 if(mode==='attached'){
  win.setBounds(fit({x:area.x+area.width-392,y:area.y+80,width:380,height:580},area));
  attachment={visible:false,reason:'Looking for a visible Codex window…'};startTracker();
 }
 win.setFocusable(mode!=='attached');
 windowOrder.round(win.getNativeWindowHandle(),mode==='attached');
 win.setAlwaysOnTop(mode!=='attached','floating');change();
 if(show){if(mode==='attached')positionAttached();else{win.show();win.focus();}}
 rebuildMenu();
}
function toggle(){if(!win||win.isDestroyed()||quitting)return;if(win.isVisible()&&win.isFocused())win.hide();else{if(mode==='panel')win.setBounds(trayBounds(tray.getBounds(),screen.getDisplayMatching(tray.getBounds()).workArea));if(mode==='attached'&&attachment?.roomBelow===false){tray.popUpContextMenu(tray.contextMenu);return;}if(mode==='attached'){positionAttached();}else{win.show();win.focus();}}}
function rebuildMenu(){
 const items=[{label:'Show / hide voice companion',accelerator:'CommandOrControl+Shift+Space',click:toggle},{type:'separator'},
  ...[['panel','Menu bar panel'],['capsule','Floating capsule'],['attached','Codex chin (outside window)']].map(([value,label])=>({label,type:'radio',checked:mode===value,click:()=>place(value)})),
  {type:'separator'},{label:'Keep panel open when unfocused',type:'checkbox',checked:pinned,click:()=>{pinned=!pinned;rebuildMenu();change();}},
  {label:'Stop voice',click:()=>voiceControl.handle({action:'stop'}).catch(error=>dialog.showErrorBox('Cannot stop voice',error.message))},
  {label:'Quit Codex Voice',accelerator:'CommandOrControl+Q',click:()=>app.quit()}];
 tray.contextMenu=Menu.buildFromTemplate(items);
}
async function startRelay(){
 const found=spawnSync('/usr/bin/which',['codex'],{env:{...process.env,PATH:extraPath},encoding:'utf8'});
 const codex=process.env.CODEX_BIN||found.stdout.trim();
 if(!codex)throw Error('Codex CLI was not found. Install it and sign in, then relaunch from Terminal.');
 // The shell owns this port and never connects to an unrelated local server.
 const net=require('node:net');await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
 await mkdir(app.getPath('userData'),{recursive:true});
 relay=spawn(process.execPath,[path.join(relayPath,'server.mjs')],{cwd:relayPath,env:{...process.env,PATH:extraPath,ELECTRON_RUN_AS_NODE:'1',PORT:String(port),CODEX_BIN:codex,CODEX_VOICE_DIAGNOSTICS_PATH:path.join(app.getPath('userData'),'handoff-diagnostics.jsonl')},stdio:['ignore','ignore','ignore']});
 let failed;relay.once('error',error=>{failed=error;});relay.once('exit',code=>{failed=Error(`Local voice relay exited (${code}).`);if(ready&&!quitting){dialog.showErrorBox('Voice relay stopped',failed.message);app.quit();}});
 for(let attempt=0;attempt<100;attempt++){
  if(failed)throw failed;
  try{const result=await fetch(origin);if(result.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('The local voice relay did not start. Run npm start in the conversational prototype to inspect it.');
}
function secureSession(){
 const session=win.webContents.session;
 session.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>contents===win.webContents&&requestingOrigin===origin&&permission==='media'&&(!details.mediaType||details.mediaType==='audio'));
 session.setPermissionRequestHandler(async(contents,permission,respond,details)=>{
  if(contents!==win.webContents||permission!=='media'||!details.mediaTypes?.length||details.mediaTypes.some(type=>type!=='audio')){respond(false);return;}
  if(new URL(contents.getURL()).origin!==origin){respond(false);return;}
  const granted=systemPreferences.getMediaAccessStatus('microphone')==='granted'||await systemPreferences.askForMediaAccess('microphone');respond(granted);
 });
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
}
app.setName('Codex Voice Prototype');
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(win&&ready)place('attached');});
 app.whenReady().then(async()=>{
  try{
   await startRelay();
   const image=nativeImage.createFromPath(path.join(__dirname,'assets/trayTemplate.png'));image.setTemplateImage(true);tray=new Tray(image);tray.setToolTip('Codex Voice · idle');tray.on('click',toggle);tray.on('right-click',()=>tray.popUpContextMenu(tray.contextMenu));
   win=new BrowserWindow({width:420,height:600,show:false,frame:false,resizable:false,roundedCorners:false,transparent:true,backgroundColor:'#00000000',hasShadow:true,skipTaskbar:true,title:'Codex Voice Prototype',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
   windowOrder.round(win.getNativeWindowHandle(),mode==='attached');
   secureSession();
   win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
   win.on('focus',()=>{if(mode==='attached'&&!popoverBounds&&attachment?.windowId)windowOrder.below(win.getNativeWindowHandle(),attachment.windowId);});
   win.on('blur',()=>{if(popoverBounds)win.webContents.send('voice:close-popover');if(mode==='panel'&&!pinned)win.hide();});
   ipcMain.handle('voice:mode',event=>trusted(event)?{mode,pinned,attachment,threadId:voiceControl.state.threadId}:null);
   ipcMain.handle('voice:set-mode',(event,value)=>{if(trusted(event)&&MODES.has(value))place(value);});
   // A tray-hosted native menu is not constrained by the tiny chin window.
   ipcMain.on('voice:settings',event=>{if(trusted(event))tray.popUpContextMenu(tray.contextMenu);});
   ipcMain.handle('voice:popover',(event,open)=>{
    if(!trusted(event)||typeof open!=='boolean')return;
    if(open&&!popoverBounds&&mode!=='panel'){
     popoverBounds=win.getBounds();
     const area=screen.getDisplayMatching(popoverBounds).workArea;
     const height=Math.min(480,popoverBounds.y+popoverBounds.height-area.y);
     win.setIgnoreMouseEvents(false);win.setBounds({...popoverBounds,y:popoverBounds.y+popoverBounds.height-height,height});
     win.setFocusable(true);win.setAlwaysOnTop(true,'floating');win.show();win.focus();
    }else if(!open&&popoverBounds){
     const bounds=popoverBounds;popoverBounds=null;win.setBounds(bounds,false);windowOrder.round(win.getNativeWindowHandle(),mode==='attached');
     win.setFocusable(mode!=='attached');win.setAlwaysOnTop(mode!=='attached','floating');if(mode==='attached')positionAttached();
    }
   });
   ipcMain.on('voice:pass-through',(event,value)=>{if(trusted(event)&&mode==='attached'&&typeof value==='boolean')win.setIgnoreMouseEvents(value,{forward:true});});
   ipcMain.on('voice:hide',event=>{if(trusted(event))win.hide();});
   ipcMain.on('voice:commands-ready',event=>{if(trusted(event))commandReady=true;});
   ipcMain.on('voice:state',(event,state)=>{if(trusted(event)&&state&&typeof state==='object'){voiceControl.update(state);tray.setToolTip(voiceControl.state.active?'Codex Voice · microphone active (hide keeps listening)':'Codex Voice · idle');}});
   await win.loadURL(`${origin}/?variant=panel`);ready=true;place('attached');
   for(let attempt=0;!commandReady&&attempt<100;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
   if(!commandReady)throw Error('Voice command listener did not register. Rebuild the frontend.');
   controlServer=await serve(socketPath(__dirname),command=>voiceControl.handle(command));
   globalShortcut.register('CommandOrControl+Shift+Space',toggle);app.dock?.hide();
  }catch(error){dialog.showErrorBox('Cannot start Codex Voice',error.message);app.quit();}
 });
 app.on('window-all-closed',()=>{});
 app.on('before-quit',event=>{
  if(quitting)return;
  quitting=true;controlServer?.close();event.preventDefault();globalShortcut.unregisterAll();stopTracker();win?.destroy();tray?.destroy();
  if(!relay){app.exit();return;}
  relay.once('exit',()=>app.exit());relay.kill('SIGTERM');setTimeout(()=>{relay?.kill('SIGKILL');app.exit();},8000).unref();
 });
}
