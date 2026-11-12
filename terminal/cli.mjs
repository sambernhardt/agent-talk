#!/usr/bin/env node
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {VoiceSession} from './session.mjs';
import {NativeAudio, prepareAudio} from './audio.mjs';
import {SessionCost} from '../relay/session-cost.mjs';
import {Controls, render, controlsRow, layout} from './ui.mjs';
import {handoffWriter} from './handoff-file.mjs';
import {pickChat} from './picker.mjs';
import {createScreen} from './screen.mjs';
import {loadPreferences, savePreferences} from './preferences.mjs';

export function options(args) {
  const result = {relay:'http://127.0.0.1:4320', demo:false, frames:0};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--demo') result.demo = true;
    else if (arg === '--pick') result.pick = true;
    else if (arg === '--start') result.start = true;
    else if (['--thread','--relay','--frames','--label'].includes(arg)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      result[arg.slice(2)] = arg === '--frames' ? Number(value) : value;
    } else throw new Error(`Unknown option ${arg}`);
  }
  if (result.help) return result;
  if (result.thread && /[\x00-\x20\x7f]/.test(result.thread)) throw new Error('--thread requires a valid chat ID.');
  if (!result.thread && !result.demo) result.pick = true;
  if (result.demo && !result.thread) result.thread = 'preview';
  if (result.demo && result.pick) throw new Error('--pick requires a live relay; omit --demo.');
  if (!Number.isInteger(result.frames) || result.frames < 0 || (result.frames && !result.demo)) throw new Error('--frames requires --demo and a positive integer');
  const url = new URL(result.relay);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('--relay must be http://127.0.0.1:PORT');
  result.relay = url.origin;
  return result;
}
async function relayToken(relay, fetchImpl = fetch) {
  let response;
  try { response = await fetchImpl(relay, {signal:AbortSignal.timeout(5000), redirect:'error'}); }
  catch { throw new Error(`Relay unavailable at ${relay}. Start the existing concierge relay first.`); }
  if (!response.ok) throw new Error(`Relay returned HTTP ${response.status}`);
  const token = /<meta\s+name="voice-token"\s+content="([^"]+)"/.exec(await response.text())?.[1];
  if (!token || token === '__TOKEN__') throw new Error('Relay did not provide a voice token.');
  return token;
}
export async function listChats(relay, fetchImpl = fetch) {
  const token = await relayToken(relay, fetchImpl);
  const response = await fetchImpl(`${relay}/api/threads`, {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),redirect:'error'});
  if (!response.ok) throw new Error(`Chat lookup returned HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.threads)) throw new Error('Relay returned an invalid chat list.');
  return data.threads.filter(chat => typeof chat.id === 'string' && chat.id && !/[\x00-\x20\x7f]/.test(chat.id)).map(chat => ({...chat,name:typeof chat.name === 'string' && chat.name.trim() ? chat.name.trim() : 'Untitled chat'}));
}
export async function resolveThreadLabel(opts, fetchImpl = fetch) {
  if (opts.label?.trim()) return opts.label.trim();
  if (opts.demo) return 'Voice preview';
  try {
    const token = await relayToken(opts.relay, fetchImpl);
    const response = await fetchImpl(`${opts.relay}/api/threads`, {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000),redirect:'error'});
    if (!response.ok) return 'Current chat';
    const data = await response.json();
    const name = data.threads?.find(thread => thread.id === opts.thread)?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : 'Current chat';
  } catch { return 'Current chat'; }
}
export async function changeChat(session,{relay,list=listChats,pick=pickChat,demo=false}={}) {
  const agent=await pick([{id:'codex',name:'Codex'},{id:'claude',name:'Claude · Coming soon'}],{title:'agent-talk · Change agent / chat'});
  if(!agent)return false;
  if(agent.id!=='codex'){session.notice='Claude support is coming soon · press H to choose a Codex chat';return false;}
  const chats=demo?[{id:'preview',name:'Voice preview'},{id:'orb-preview',name:'Build voice orb animation'}]:await list(relay);
  const chat=await pick(chats,{preferredId:session.thread});
  if(!chat||chat.id===session.thread)return false;
  session.stop();session.thread=chat.id;session.threadLabel=chat.name;session.messages=[];session.transcript='';session.handoff=null;session.cost=null;session.state='idle';session.notice='';
  return true;
}
export async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (opts.help) { console.log(`agent-talk terminal\nUsage: node terminal/cli.mjs [--pick] [--start] [--thread ID] [--relay http://127.0.0.1:4320] [--label "Chat title"]\n       node terminal/cli.mjs --thread ID --demo [--frames N]\n\nWithout --thread, opens a filterable chat picker. --pick always opens the picker.\n--thread preselects a chat in the picker; --start begins voice after selection.\nShows the chat title from the relay; --label overrides the display name.\nStarts idle. S start, X stop, M mute/unmute, H change chat, C config, Q quit.\nInside Config: T transcript, W waveforms, Esc close.\nMouse buttons work with SGR terminal mouse support.\nReal audio: macOS + Swift command line tools; existing concierge relay required.\nRelay credentials are read from its loopback HTML; no gateway key is read here.\n--demo never connects to a relay or opens audio. --frames prints finite fixture frames.\nUse headphones: native audio has no browser echo cancellation.`); return; }
  if (!opts.frames && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new Error('Interactive UI needs a TTY. Run in an interactive terminal, or use --demo --frames 1.');
  if (opts.pick) {
    const chat = await pickChat(await listChats(opts.relay), {preferredId:opts.thread || process.env.CODEX_THREAD_ID});
    if (!chat) return;
    opts.thread = chat.id; opts.label = chat.name;
  }
  let WebSocket;
  if (!opts.demo) {
    await prepareAudio();
    const require = createRequire(new URL('../package.json', import.meta.url));
    try { WebSocket = require('ws'); } catch { throw new Error('Missing relay dependency ws. Run npm install in the repository root.'); }
  }
  const session = new VoiceSession({thread:opts.thread,
    saveHandoff:handoffWriter(),
    makeAudio:(pcm,error) => new NativeAudio(pcm,error),
    connect:async () => {
      const token = await relayToken(opts.relay);
      return new WebSocket(`${opts.relay.replace('http:', 'ws:')}/voice?token=${encodeURIComponent(token)}`, {origin:opts.relay, handshakeTimeout:10000});
    }});
  session.threadLabel = await resolveThreadLabel(opts);
  const settings=await loadPreferences();let configOpen=false,picking=false,preferenceWrite=Promise.resolve();
  const screen = createScreen(process.stdout);
  const input = [], output = []; let tick = 0, quitting = false, orbPhase = 0;
  const fixtureStart = () => { session.state = 'listening'; session.cost = new SessionCost('fixture', Date.now() - 65000); session.notice = 'Fixture waves · no microphone, speaker, relay, or billed calls'; };
  if (opts.demo) fixtureStart();
  const draw = () => {
    if(picking||quitting)return;
    tick++;
    input.push(opts.demo && session.state === 'listening' && !session.muted ? Math.abs(Math.sin(tick * .42)) * .7 : session.input);
    output.push(opts.demo && session.state === 'listening' ? Math.abs(Math.cos(tick * .27)) * .6 : session.output);
    if (input.length > 80) { input.shift(); output.shift(); }
    session.input *= .6; session.output *= .6;
    orbPhase += session.handoff?.status === 'working' || session.state === 'starting' ? .23 : (output.at(-1) || 0) > .025 ? .11 : .05;
    const frame = render(session, {columns:process.stdout.columns || 80, rows:process.stdout.rows || 24, demo:opts.demo, input, output, time:tick/10, phase:orbPhase, ...settings, configOpen, bold:Boolean(process.stdout.isTTY) && !opts.frames, color:Boolean(process.stdout.isTTY) && !opts.frames && !('NO_COLOR' in process.env)});
    if (opts.frames) process.stdout.write(frame + '\n');
    else screen.draw(frame, process.stdout.columns || 80);
  };
  if (opts.frames) { for (let i = 0; i < opts.frames; i++) draw(); return; }
  const wasRaw = process.stdin.isRaw;
  let timer;
  const restore = () => {
    clearInterval(timer); process.stdin.off('data', onData); process.stdin.setRawMode(Boolean(wasRaw)); process.stdin.pause();
    process.stdout.write('\x1b[?2026l\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l');
  };
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const quit = () => { if (quitting) return; quitting = true; session.stop(); restore(); process.off('SIGINT', quit); process.off('SIGTERM', quit); process.off('exit', restore); resolveDone(); };
  const chooseChat = async()=>{
    if(picking)return;picking=true;configOpen=false;process.stdin.off('data',onData);
    // pickChat owns terminal input while open. Resume our alternate screen after it exits.
    process.stdout.write('\x1b[?1000l\x1b[?1006l');
    try{const changed=await changeChat(session,{relay:opts.relay,demo:opts.demo});if(changed){input.length=0;output.length=0;}}
    catch(error){session.notice=`Could not change chat: ${error.message}`;}
    finally{picking=false;if(!quitting){process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);screen.invalidate();draw();}}
  };
  const controls = new Controls(key => {
    if (key === 'q') quit();
    else if(key==='h'){void chooseChat();return;}
    else if(key==='c')configOpen=!configOpen;
    else if(key==='escape')configOpen=false;
    else if(configOpen&&(key==='t'||key==='w')){const setting=key==='t'?'showTranscript':'showWaveforms';settings[setting]=!settings[setting];const snapshot={...settings};preferenceWrite=preferenceWrite.then(()=>savePreferences(snapshot)).catch(()=>{session.notice='Could not save display preferences';});}
    else if (key === 'x') session.stop();
    else if (key === 'm') session.mute();
    else if (key === 's') { if (opts.demo) fixtureStart(); else void session.start(); }
    if (!quitting) draw();
  },()=>controlsRow(process.stdout.rows||24),()=>layout(session,{columns:process.stdout.columns||80,rows:process.stdout.rows||24,configOpen}).hits);
  const onData = chunk => controls.feed(chunk.toString());
  process.on('SIGINT', quit); process.on('SIGTERM', quit); process.once('exit', restore);
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onData);
  process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h');
  timer = setInterval(draw, 100); draw();
  if (opts.start && !opts.demo) void session.start();
  await done;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(`Voice terminal: ${e.message}`); process.exitCode = 1; });
