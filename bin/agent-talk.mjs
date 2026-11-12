#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile, chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {installProjects} from './install.mjs';
import {pickChat} from '../terminal/picker.mjs';
import {main as terminal} from '../terminal/cli.mjs';
import {previewDev as preview} from '../terminal/preview-dev.mjs';

const configDir = path.join(homedir(), '.config', 'agent-talk');
const configFile = path.join(configDir, 'config.json');
function promptToken() {
  return new Promise(resolve => {
    let value=''; const wasRaw=process.stdin.isRaw;
    process.stdout.write('\x1b[?1049h\x1b[H\x1b[2J' + [
      'agent-talk · Connect AI Gateway',
      'Paste your token · Enter continue · Esc cancel',
      '',
      'Your token stays hidden and is saved locally for future sessions.',
      '',
      'AI Gateway token: ',
    ].join('\n'));
    const finish = result => { process.stdin.off('data',data); process.stdin.setRawMode(Boolean(wasRaw)); process.stdin.pause(); process.stdout.write('\x1b[?1049l'); resolve(result); };
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
    // Reuse credentials from releases before the agent-talk rename.
    const legacyFile = path.join(homedir(), '.config', 'voice-mode', 'config.json');
    try { const value=JSON.parse(await readFile(legacyFile,'utf8')).gatewayToken; if(typeof value==='string' && value.trim()) return value; }
    catch(error) { if(error.code!=='ENOENT') throw Error(`Cannot read legacy token setup: ${error.message}`); }
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
    console.log('agent-talk\nUsage: agent-talk [setup | preview | --demo | --help]\n       agent-talk install-codex-voice-action [PROJECT_DIR ...]\n\nChoose an agent, filter your chats, and press Enter to start voice.\nCodex supported; Claude coming soon.\nRequires macOS, Swift command line tools, Codex CLI with queue support,\nand an AI Gateway token. S start, X stop, M mute, Q quit.\ninstall-codex-voice-action adds a Codex Voice toolbar action to each project (default: current directory).\nsetup replaces the saved token; AI_GATEWAY_API_KEY overrides saved credentials.');return;
  }
  if(args[0]==='preview') { if(args.length!==1)throw Error('Usage: agent-talk preview');return preview(); }
  if(args[0]==='install-codex-voice-action') {
    if(args.slice(1).some(arg=>arg.startsWith('-'))) throw Error('Usage: agent-talk install-codex-voice-action [PROJECT_DIR ...]');
    process.exitCode=await installProjects(args.slice(1));return;
  }
  if(args.length>1 || (args.length && !['setup','--demo'].includes(args[0]))) throw Error('Unknown argument. Run agent-talk --help.');
  if(!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Run agent-talk in an interactive terminal.');
  if(args[0]==='--demo') return terminal(['--demo']);
  if(args[0]==='setup') { if(await credentials(true)) console.log('AI Gateway token saved. Run agent-talk to begin.'); return; }
  if(process.platform!=='darwin') throw Error('agent-talk currently requires macOS.');
  const key=await credentials(); if(!key) return;
  let agent;
  do {
    agent=await pickChat([{id:'codex',name:'Codex'},{id:'claude',name:'Claude · Coming soon'}],{title:'agent-talk · Choose your agent'});
    if(!agent) return;
    if(agent.id==='claude') { console.log('Claude support is coming soon. Choose Codex to start voice.'); }
  } while(agent.id!=='codex');
  const codex=process.env.CODEX_BIN || 'codex';
  const check=spawnSync(codex,['queue','--help'],{encoding:'utf8'});
  if(check.error || check.status!==0) throw Error('Install/sign in to Codex CLI with `codex queue` support first.');
  await mkdir(configDir,{recursive:true,mode:0o700});
  const port=await freePort(); const origin=`http://127.0.0.1:${port}`;
  console.log('Starting local voice relay…');
  const relay=spawn(process.execPath,[fileURLToPath(new URL('../relay/server.mjs',import.meta.url))],{
    env:{...process.env,PORT:String(port),AI_GATEWAY_API_KEY:key,CODEX_VOICE_DIAGNOSTICS_PATH:path.join(configDir,'diagnostics.jsonl')},stdio:['ignore','pipe','pipe']});
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
run().catch(error=>{console.error(`agent-talk: ${error.message}`);process.exitCode=1;});
