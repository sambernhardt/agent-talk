import {packager} from '@electron/packager';
import {spawnSync} from 'node:child_process';
import {mkdir,cp,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url)),relay=path.resolve(root,'../codex-voice-concierge-prototype');
for(const [cmd,args,cwd] of [['npm',['run','build'],relay],['node',['build-helper.mjs'],root]]){
 const result=spawnSync(cmd,args,{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
const target=path.join(root,'resources/relay');await rm(path.join(root,'resources'),{recursive:true,force:true});await mkdir(target,{recursive:true});
// Explicit allowlist: no credentials, browser history, diagnostics, source recordings, or .git.
for(const file of ['server.mjs','diagnostics.mjs','queue-message.mjs','session-cost.mjs','session-context.mjs','handoff.mjs','reply-watcher.mjs','replies.mjs','audio-worklet.js','package.json'])await copyFile(path.join(relay,file),path.join(target,file));
await cp(path.join(relay,'dist'),path.join(target,'dist'),{recursive:true});
await cp(path.join(relay,'node_modules/ws'),path.join(target,'node_modules/ws'),{recursive:true});
await copyFile(path.join(root,'.build/codex-window-helper'),path.join(root,'resources/codex-window-helper'));
await copyFile(path.join(root,'.build/window-order.node'),path.join(root,'resources/window-order.node'));
const apps=await packager({dir:root,name:'Codex Voice Prototype',appBundleId:'dev.codex.voice.prototype',platform:'darwin',asar:false,arch:process.arch,out:path.join(root,'out'),overwrite:true,prune:true,ignore:[/^\/out($|\/)/,/^\/\.build($|\/)/,/^\/native($|\/)/],extendInfo:{NSMicrophoneUsageDescription:'Talk to your local Codex chat using your configured voice provider.',LSUIElement:true}});
console.log(apps.join('\n'));
