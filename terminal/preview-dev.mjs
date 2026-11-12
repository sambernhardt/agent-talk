import {fork} from 'node:child_process';
import {watch} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Keep URL and controls stable while restarting all preview modules on edits.
export async function previewDev(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Run the preview in an interactive terminal.');
 let child,port=0,config={},restarting=false,stopping=false,debounce;
 const token=randomUUID();
 await new Promise(resolve=>{
  const watcher=watch(new URL('./',import.meta.url),(_event,file)=>{
   if(!file||file.endsWith('.test.mjs')||!(/\.(mjs|html)$/.test(file)))return;
   clearTimeout(debounce);debounce=setTimeout(()=>{if(stopping)return;restarting=true;if(child?.connected)child.send('reload');},180);
  });
  const stop=()=>{stopping=true;clearTimeout(debounce);watcher.close();child?.kill('SIGTERM');};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  const launch=()=>{
   restarting=false;
   child=fork(fileURLToPath(new URL('./preview.mjs',import.meta.url)),[],{stdio:['inherit','inherit','inherit','ipc'],env:{...process.env,AGENT_TALK_PREVIEW_PORT:String(port),AGENT_TALK_PREVIEW_TOKEN:token,AGENT_TALK_PREVIEW_CONFIG:JSON.stringify(config)}});
   child.on('message',message=>{if(message.url)port=Number(new URL(message.url).port);if(message.config)config=message.config;});
   child.on('error',error=>{console.error(error.message);stop();});
   child.on('exit',code=>{
    if(restarting&&!stopping){launch();return;}
    watcher.close();clearTimeout(debounce);process.off('SIGINT',stop);process.off('SIGTERM',stop);process.exitCode=code||0;resolve();
   });
  };
  launch();
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url))previewDev().catch(error=>{console.error(error.message);process.exitCode=1;});
