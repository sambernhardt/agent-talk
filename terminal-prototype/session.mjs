import {SessionCost} from '../codex-voice-concierge-prototype/session-cost.mjs';
import {reduceTranscript} from '../codex-voice-concierge-prototype/frontend/transcript-store.mjs';
export function level(pcm) {
  let sum = 0, count = Math.floor(pcm.length / 2);
  for (let i = 0; i < count; i++) sum += (pcm.readInt16LE(i * 2) / 32768) ** 2;
  return count ? Math.min(1, Math.sqrt(sum / count) * 4) : 0;
}
export class VoiceSession {
  constructor({thread, connect, makeAudio, now = Date.now, changed = () => {}, saveHandoff = null}) {
    Object.assign(this, {thread, connect, makeAudio, now, changed, saveHandoff});
    this.state = 'idle'; this.muted = false; this.input = 0; this.output = 0; this.notice = 'Press S to start'; this.generation = 0;
    this.messages=[];this.transcriptSequence=0;
  }
  appendTranscript(role,text,options={}) {
    this.messages=reduceTranscript(this.messages,role,text,{...options,id:String(++this.transcriptSequence)}).slice(-100);
    this.transcript=this.messages.at(-1)?.text||'';
  }
  send(message) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(message)); }
  async start() {
    if (!['idle','ended','error'].includes(this.state)) return;
    const generation = ++this.generation;
    this.state = 'starting'; this.notice = 'Preparing microphone…'; this.cost = null; this.lastUserAt = null; this.transcript = ''; this.handoff = null; this.changed();
    try {
      let remainder = Buffer.alloc(0);
      const audio = this.audio = this.makeAudio(chunk => {
        const joined = Buffer.concat([remainder, chunk]);
        const length = joined.length - joined.length % 2;
        let pcm = joined.subarray(0, length); remainder = joined.subarray(length);
        if (this.state !== 'listening' || !length) return;
        if (this.muted) pcm = Buffer.alloc(length);
        this.input = level(pcm);
        // Silent frames preserve the relay's timing while muted; no captured samples leave the process.
        if ((this.ws?.bufferedAmount || 0) > 192000) return this.fail(new Error('Relay is falling behind.'));
        this.send({type:'audio', audio:pcm.toString('base64'), speechAt:this.input > .08 ? this.now() : null});
      }, e => { if (generation === this.generation) this.fail(e); });
      await audio.start();
      if (generation !== this.generation) { audio.stop(); return; }
      const ws = await this.connect();
      if (generation !== this.generation) { ws.close(); return; }
      this.ws = ws;
      this.startTimer = setTimeout(() => this.fail(new Error('Relay startup timed out.')), 30000);
      ws.on('open', () => { if (generation === this.generation && ws.readyState === 1) ws.send(JSON.stringify({type:'start', threadId:this.thread})); });
      ws.on('message', data => { if (generation !== this.generation) return; try { this.receive(JSON.parse(data)); } catch (e) { this.fail(e); } });
      ws.on('error', e => { if (generation === this.generation) this.fail(e); });
      ws.on('close', () => { if (generation === this.generation) this.stop(); });
      this.notice = 'Connecting to relay…'; this.changed();
    } catch (e) { if (generation === this.generation) this.fail(e); }
  }
  receive(e) {
    if (e.type === 'listening') { clearTimeout(this.startTimer); this.cost ??= new SessionCost(String(this.now()), this.now()); this.state = 'listening'; this.notice = 'Listening · headphones recommended'; }
    else if (e.type === 'session-usage') this.cost?.usage(e.seconds, this.now());
    else if (e.type === 'audio') { const pcm = Buffer.from(e.audio, 'base64'); this.output = level(pcm); this.audio?.play(pcm); }
    else if (e.type === 'interrupt-audio') { this.audio?.interrupt(); this.output = 0; }
    else if (e.type === 'user-transcript') {
      const newTurn=this.lastUserAt == null || this.now() - this.lastUserAt > 1200;
      if (newTurn) { this.audio?.interrupt(); this.output = 0; }
      this.lastUserAt = this.now(); this.appendTranscript('You',e.delta,{newTurn});
    }
    else if (e.type === 'ended') { this.cost?.usage(e.seconds, this.now(), true); this.stop(); }
    else if (e.type === 'error') this.fail(new Error(e.message));
    else if (e.type === 'status' || e.type === 'handoff-error') this.notice = e.text || e.message;
    else if (e.type === 'voice-transcript') this.appendTranscript('Voice',e.delta);
    else if (e.type === 'codex-delta') this.appendTranscript('Codex',e.delta);
    else if (e.type === 'codex-final') this.appendTranscript('Codex',e.text,{final:true});
    else if (e.type === 'delegating') {
      const handoff = this.handoff = {id:e.id || 'request',state:'queued'};
      this.notice = `Voice companion handoff · ${handoff.id} · queued`;
      if (this.saveHandoff) Promise.resolve().then(()=>this.saveHandoff({id:e.id,text:e.text})).then(file=>{
        handoff.path=file; this.changed();
      }).catch(()=>{handoff.fileError=true;this.changed();});
    }
    else if (e.type === 'work-status' && this.handoff?.id === e.id) {
      this.handoff.state=e.state;
      if(this.state!=='error')this.notice=`Voice companion handoff · ${e.id} · ${e.state}`;
    }
    this.changed();
  }
  mute() { this.muted = !this.muted; this.input = 0; this.changed(); }
  stop() {
    ++this.generation; clearTimeout(this.startTimer);
    this.audio?.stop(); this.audio = null;
    const ws = this.ws; const cost = this.cost; this.ws = null;
    if (ws?.readyState === 0) { ws.close(); ws.terminate?.(); }
    else if (ws) {
      if (ws.readyState === 1) ws.send(JSON.stringify({type:'stop'}));
      // Keep the connection briefly for final authoritative usage.
      ws.removeAllListeners('message');
      ws.on('message', raw => { try { const e = JSON.parse(raw); if (e.type === 'ended') { cost?.usage(e.seconds, this.now(), true); this.changed(); } } catch {} });
      const timer = setTimeout(() => { ws.close(); ws.terminate?.(); }, 1500); timer.unref();
      ws.once('close', () => clearTimeout(timer));
    }
    this.cost?.finish(this.now()); this.input = this.output = 0;
    if (this.state !== 'error') { this.state = 'ended'; this.notice = 'Stopped · press S to start again'; }
    this.changed();
  }
  fail(e) { this.state = 'error'; this.notice = e.message; this.stop(); }
}
