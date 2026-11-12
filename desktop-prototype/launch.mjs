#!/usr/bin/env node
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {socketPath,request,validate}=require('./control.cjs');
const root=fileURLToPath(new URL('.',import.meta.url));
export function parseArgs(args){
 let action='show',threadId,actionSeen=false;
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(arg==='--help'||arg==='-h')return {help:true};
  if(arg==='--thread-id'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('--thread-id needs a value.');threadId=args[++i];}
  else if(['show','start','stop','status'].includes(arg)||arg==='--status'){if(actionSeen)throw Error('Choose one action.');action=arg==='--status'?'status':arg;actionSeen=true;}
  else throw Error(`Unknown argument: ${arg}`);
 }
 return validate({action,...(threadId?{threadId}:{})});
}
export async function main(args){
 const command=parseArgs(args);if(command.help){console.log('Usage: node desktop-prototype/launch.mjs [show|start|stop|status] [--thread-id ID]\nshow: open/reuse attached chin without audio. start: explicitly start voice for ID.\nstop/status never launch an app. --status aliases status. JSON output.');return;}
 const socket=socketPath(root);
 try{console.log(JSON.stringify(await request(socket,command)));return;}catch(error){if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;}
 if(command.action==='status'||command.action==='stop'){console.log(JSON.stringify({ok:true,running:false,phase:'idle',active:false}));return;}
 if(process.platform!=='darwin')throw Error('The desktop app requires macOS.');
 // Build only when launching a new app; an existing app is always reused.
 for(const [cwd,args] of [[path.resolve(root,'../codex-voice-concierge-prototype'),['run','build']],[root,['run','build:helper']]]){
  const result=spawnSync('npm',args,{cwd,stdio:['ignore','inherit','inherit']});if(result.status!==0)throw Error('Desktop build failed. See README prerequisites.');
 }
 const electron=require('electron');const child=spawn(electron,[root],{cwd:root,detached:true,stdio:'ignore',env:process.env});child.unref();let failed;child.on('error',error=>{failed=error;});
 for(let attempt=0;attempt<150;attempt++){
  if(failed)throw failed;
  try{await request(socket,{action:'status'},1000);console.log(JSON.stringify(await request(socket,command)));return;}catch(error){if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Desktop did not become ready. An older Codex Voice app may hold the single-instance lock without control support. Stop voice there, quit that app, then rerun this command to relaunch the updated app. The launcher has left the existing app running. Also inspect startup prerequisites in desktop-prototype/README.md.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
