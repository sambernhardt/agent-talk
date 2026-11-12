#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile, chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {pickChat} from '../terminal-prototype/picker.mjs';
import {main as terminal} from '../terminal-prototype/cli.mjs';

const configDir = path.join(homedir(), '.config', 'voice-mode');
const configFile = path.join(configDir, 'config.json');
function promptToken() {
  return new Promise(resolve => {
    let value=''; const wasRaw=process.stdin.isRaw;
    process.stdout.write('Paste your AI Gateway token (hidden; stored locally with owner-only permissions): ');
    const finish = result => { process.stdin.off('data',data); process.stdin.setRawMode(Boolean(wasRaw)); process.stdin.pause(); process.stdout.write('\n'); resolve(result); };
    const data = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\x03' || char === '\x1b') return finish(null);
        if (char === '\r' || char === '\n') return finish(value.trim());
        if (char === '\x7f' || char === '\b') value=value.slice(0,-1);
        else if (char.charCodeAt(0)>=32) value+=char;
      }
    };
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data',data);
  });
}
async function credentials(force=false) {
  if (!force && process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  if (!force) {
    try { const value=JSON.parse(await readFile(configFile,'utf8')).gatewayToken; if(typeof value==='string' && value.trim()) return value; }
    catch(error) { if(error.code!=='ENOENT') throw Error(`Cannot read ${configFile}: ${error.message}`); }
  }
  const key=await promptToken(); if(!key) return null;
  await mkdir(configDir,{recursive:true,mode:0o700});
  await writeFile(configFile,JSON.stringify({gatewayToken:key})+'\n',{mode:0o600});
  await chmod(configFile,0o600);
  return key;
}
async function freePort() {
  const server=net.createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port; await new Promise(resolve=>server.close(resolve)); return port;
}
async function run() {
  const args=process.argv.slice(2);
  if(args.includes('--help') || args.includes('-h')) {
    console.log('Voice Mode\nUsage: voice-mode [setup | --demo | --help]\n\nChoose an agent, filter your chats, and press Enter to start voice.\nCodex supported; Claude coming soon.\nRequires macOS, Swift command line tools, Codex CLI with queue support,\nand an AI Gateway token. S start, X stop, M mute, Q quit.\nsetup replaces the saved token; AI_GATEWAY_API_KEY overrides saved credentials.');return;
  }
  if(args.length>1 || (args.length && !['setup','--demo'].includes(args[0]))) throw Error('Unknown argument. Run voice-mode --help.');
  if(!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Run voice-mode in an interactive terminal.');
  if(args[0]==='--demo') return terminal(['--demo']);
  if(args[0]==='setup') { if(await credentials(true)) console.log('AI Gateway token saved. Run voice-mode to begin.'); return; }
  let agent;
  do {
    agent=await pickChat([{id:'codex',name:'Codex'},{id:'claude',name:'Claude · Coming soon'}],{title:'Voice Mode · Choose your agent'});
    if(!agent) return;
    if(agent.id==='claude') { console.log('Claude support is coming soon. Choose Codex to start voice.'); }
  } while(agent.id!=='codex');
  if(process.platform!=='darwin') throw Error('Voice Mode currently requires macOS.');
  const codex=process.env.CODEX_BIN || 'codex';
  const check=spawnSync(codex,['queue','--help'],{encoding:'utf8'});
  if(check.error || check.status!==0) throw Error('Install/sign in to Codex CLI with `codex queue` support first.');
  const key=await credentials(); if(!key) return;
  const port=await freePort(); const origin=`http://127.0.0.1:${port}`;
  console.log('Starting local voice relay…');
  const relay=spawn(process.execPath,[fileURLToPath(new URL('../codex-voice-concierge-prototype/server.mjs',import.meta.url))],{
    env:{...process.env,PORT:String(port),AI_GATEWAY_API_KEY:key,VOICE_MODE_TERMINAL_ONLY:'1',CODEX_VOICE_DIAGNOSTICS_PATH:path.join(configDir,'diagnostics.jsonl')},stdio:['ignore','pipe','pipe']});
  let exited=false, failure=null;
  relay.once('error',error=>{failure=error;});relay.once('exit',()=>{exited=true;});
  // Never forward provider output or credentials into the terminal.
  relay.stdout.resume(); relay.stderr.resume();
  const stop=()=>{if(!exited) relay.kill('SIGTERM');};
  process.once('exit',stop);
  try {
    let ready=false;
    for(let attempt=0;attempt<100;attempt++) {
      if(failure) throw failure;
      if(exited) throw Error('Local voice relay exited before startup. Check Codex CLI installation and authentication.');
      try { const response=await fetch(origin,{signal:AbortSignal.timeout(400)}); if(response.ok && (await response.text()).includes('voice-token')) {ready=true;break;} } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!ready) throw Error('Local voice relay startup timed out.');
    await terminal(['--pick','--start','--relay',origin]);
  } finally {
    stop();
    if(!exited) await new Promise(resolve=>{const timer=setTimeout(()=>{relay.kill('SIGKILL');resolve();},7000);relay.once('exit',()=>{clearTimeout(timer);resolve();});});
    process.off('exit',stop);
  }
}
run().catch(error=>{console.error(`Voice Mode: ${error.message}`);process.exitCode=1;});
