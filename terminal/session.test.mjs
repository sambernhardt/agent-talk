import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {VoiceSession} from './session.mjs';
import {options} from './cli.mjs';
import {Controls, render} from './ui.mjs';
class Socket extends EventEmitter {
  readyState = 0; sent = []; bufferedAmount = 0;
  send(raw) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; this.emit('close'); }
  terminate() { this.terminated = true; this.close(); }
  open() { this.readyState = 1; this.emit('open'); }
}
function harness() {
  let time = 1000, audio, socket;
  const sockets = [];
  const s = new VoiceSession({thread:'chat-bound', now:() => time,
    connect:async () => { socket = new Socket(); sockets.push(socket); return socket; },
    makeAudio:(pcm, error) => (audio = {pcm,error,stops:0,interrupts:0,played:[], async start(){}, stop(){this.stops++;}, interrupt(){this.interrupts++;}, play(p){this.played.push(p);}})});
  return {s, sockets, get audio(){return audio;}, get socket(){return socket;}, set time(v){time = v;}};
}
async function listening(h) { await h.s.start(); h.socket.open(); h.s.receive({type:'listening'}); }

test('bound start, aligned PCM, muted zero PCM, unmute restores samples', async () => {
  const h = harness(); await listening(h);
  assert.deepEqual(h.socket.sent[0], {type:'start',threadId:'chat-bound'});
  h.audio.pcm(Buffer.from([1])); assert.equal(h.socket.sent.length, 1);
  h.audio.pcm(Buffer.from([2,3,4])); assert.equal(h.socket.sent[1].audio, Buffer.from([1,2,3,4]).toString('base64'));
  h.s.mute(); h.audio.pcm(Buffer.from([9,8]));
  assert.equal(h.socket.sent.at(-1).audio, 'AAA='); assert.equal(h.socket.sent.at(-1).speechAt, null); assert.equal(h.s.input, 0);
  h.s.mute(); h.audio.pcm(Buffer.from([5,6])); assert.equal(h.socket.sent.at(-1).audio, 'BQY=');
  h.s.stop();
});
test('interrupt on new user turn, not each transcript delta', async () => {
  const h = harness(); await listening(h);
  h.s.receive({type:'user-transcript',delta:'a'}); h.time = 1200; h.s.receive({type:'user-transcript',delta:'b'});
  assert.equal(h.audio.interrupts, 1);
  h.time = 2600; h.s.receive({type:'user-transcript',delta:'c'}); assert.equal(h.audio.interrupts, 2);
  h.s.stop();
});
test('stop releases audio and late final usage remains bound to old meter', async () => {
  const h = harness(); await listening(h); const oldSocket = h.socket, oldCost = h.s.cost, oldAudio = h.audio;
  h.s.stop(); assert.equal(oldAudio.stops, 1); assert.equal(oldSocket.sent.at(-1).type, 'stop');
  await listening(h); const newCost = h.s.cost;
  oldSocket.emit('message', JSON.stringify({type:'ended',seconds:42}));
  assert.equal(oldCost.snapshot().seconds, 42); assert.equal(newCost.usageSeconds, null);
  oldSocket.close(); h.s.stop();
});
test('stop during handshake terminates socket; late open cannot start replacement', async () => {
  const h = harness(); await h.s.start(); const old = h.socket;
  h.s.stop(); assert.equal(old.terminated, true);
  await h.s.start(); old.open(); assert.deepEqual(old.sent, []); assert.deepEqual(h.socket.sent, []);
  h.socket.open(); assert.deepEqual(h.socket.sent, [{type:'start',threadId:'chat-bound'}]); h.s.stop();
});
test('stop while audio initializes prevents connection', async () => {
  let release, stopped = 0, connects = 0;
  const s = new VoiceSession({thread:'t',connect:() => connects++,makeAudio:() => ({start:() => new Promise(r => release=r),stop:() => stopped++})});
  const start = s.start(); s.stop(); release(); await start;
  assert.equal(connects, 0); assert.ok(stopped >= 1); assert.equal(s.state, 'ended');
});
test('audio failure closes session and repeated stop is safe', async () => {
  const h = harness(); await listening(h); const audio = h.audio;
  audio.error(new Error('device lost')); h.s.stop();
  assert.equal(audio.stops, 1); assert.equal(h.s.state,'error'); assert.match(h.s.notice,/device lost/);
});
test('fragmented mouse input and keyboard dispatch controls; remote escapes sanitized', () => {
  const actions = [], controls = new Controls(k => actions.push(k));
  controls.feed('\x1b[<0;4;'); controls.feed('10Mmx\x03');
  assert.deepEqual(actions,['s','m','x','q']);
  const frame = render({thread:'t',state:'idle',notice:'bad\x1b[2J',transcript:''}); assert.ok(!frame.includes('\x1b'));
});
test('CLI validates binding, remote relay, and fixture options', () => {
  assert.equal(options(['--demo']).thread, 'preview');
  assert.throws(() => options(['--thread','bad id']), /valid chat ID/);
  assert.throws(() => options(['--thread','t','--relay','http://example.com']), /127.0.0.1/);
  assert.throws(() => options(['--thread','t','--frames','2']), /--demo/);
  assert.equal(options(['--thread','t','--demo','--frames','1']).frames,1);
});

test('short terminal panels keep the session error visible', () => {
  const frame = render({thread:'t',state:'error',notice:'Audio output is falling behind; session stopped.'},{rows:12,columns:100,showTranscript:true});
  assert.match(frame,/Audio output is falling behind/);
});

test('spoken exchanges stream into distinct transcript messages without overwriting user deltas',()=>{
 let updates=0,time=1000;
 const session=new VoiceSession({thread:'t',now:()=>time,changed:()=>updates++});
 session.receive({type:'user-transcript',delta:'Can you '});
 session.receive({type:'user-transcript',delta:'explain this?'});
 assert.equal(session.messages.length,1);assert.equal(session.messages[0].text,'Can you explain this?');
 const userId=session.messages[0].id;
 session.receive({type:'voice-transcript',delta:'Yes, '});
 session.receive({type:'voice-transcript',delta:'here is how.'});
 time=3000;session.receive({type:'user-transcript',delta:'Thanks.'});
 assert.deepEqual(session.messages.map(({label,text})=>({label,text})),[
  {label:'You',text:'Can you explain this?'},{label:'Voice',text:'Yes, here is how.'},{label:'You',text:'Thanks.'}
 ]);
 assert.equal(session.messages[0].id,userId);assert.equal(updates,5);
 const frame=render(session,{rows:24,columns:100,showTranscript:true});
 assert.match(frame,/You: Can you explain this\?/);assert.match(frame,/Voice: Yes, here is how\./);assert.match(frame,/You: Thanks\./);
});
test('Codex final responses replace streamed text in the transcript',()=>{
 const session=new VoiceSession({thread:'t'});
 session.receive({type:'codex-delta',delta:'Partial answer'});
 session.receive({type:'codex-final',text:'Complete answer'});
 assert.equal(session.messages.length,1);assert.equal(session.messages[0].label,'Codex');
 assert.equal(session.messages[0].text,'Complete answer');assert.equal(session.messages[0].streaming,false);
});
test('short panels show the transcript and preserve mouse controls in compact layout',()=>{
 const session=new VoiceSession({thread:'t'});
 session.receive({type:'user-transcript',delta:'Hello'});
 session.receive({type:'voice-transcript',delta:'Hi there'});
 const frame=render(session,{rows:12,columns:100,showTranscript:true});
 assert.match(frame,/You: Hello/);assert.match(frame,/Voice: Hi there/);
 assert.equal(frame.split('\n')[10],'  [S Start]   [X Stop]   [M Mute]   [Q Quit]');
 const actions=[];const controls=new Controls(key=>actions.push(key),()=>8);
 controls.feed('\x1b[<0;4;8M');assert.deepEqual(actions,['s']);
});
