import { ReplyWatcher } from './reply-watcher.mjs';
import { generateSpeech } from 'ai';
import { speechChunks } from './speech-chunks.mjs';
import { SpeechInput } from './speech-input.mjs';
import { findReply } from './replies.mjs';
import http from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { randomBytes, randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 4318);
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(24).toString('hex');
const clients = new Set();
const pending = new Map();
let seq = 0;
const timingRecords = [];
let timingWrites = Promise.resolve();
function recordTiming(record) {
  timingRecords.push(record);
  if (timingRecords.length > 1000) timingRecords.shift();
  timingWrites = timingWrites.then(() => appendFile(new URL('./timings.jsonl', import.meta.url), JSON.stringify(record) + '\n', { mode: 0o600 })).catch(e => console.error('Timing log:', e.message));
}
// Independent app-server is strictly a history reader; desktop owns all work.
const codex = spawn(process.env.CODEX_BIN || 'codex', ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] });
function queueMessage(threadId, message) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CODEX_BIN || 'codex', ['queue', '--thread', threadId, '--message', message]);
    let output = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', d => { output = (output + d).slice(-4000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(output || `Queue exited ${code}`)));
  });
}
const recentTurns = threadId => rpc('thread/turns/list', { threadId, limit: 50, itemsView: 'full', sortDirection: 'desc' }).then(r => r.data);
function rpc(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    codex.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
const lines = readline.createInterface({ input: codex.stdout });
lines.on('line', line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id != null && !m.method) {
    const p = pending.get(m.id); if (!p) return;
    clearTimeout(p.timer); pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
    return;
  }
  if (m.id != null) {
    // Never silently approve server-initiated requests in this prototype.
    codex.stdin.write(JSON.stringify({ id: m.id, error: { code: -32601, message: 'Voice prototype cannot approve this request. Use a supported Codex client.' } }) + '\n');
    for (const c of clients) if (c.threadId === m.params?.threadId) c.fail('Codex needs an approval or tool interaction this prototype cannot handle.');
    return;
  }

});
codex.stderr.on('data', d => { if (process.env.DEBUG) process.stderr.write(d); });
function disconnected(error) {
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear();
  for (const c of clients) c.fail(error.message);
}
codex.on('error', disconnected);
codex.on('exit', code => disconnected(new Error(`Codex app-server exited (${code})`)));
const ready = rpc('initialize', { clientInfo: { name: 'codex_voice_prototype', title: 'Codex Voice Prototype', version: '0.1.0' } })
  .then(() => codex.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n'));
ready.catch(e => console.error('Codex initialization:', e.message));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end(); return; }
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    if (url.pathname === '/') {
      const html = (await readFile(new URL('./index.html', import.meta.url), 'utf8')).replace('__TOKEN__', token);
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:" + port + "; worker-src 'self' blob:; media-src 'self' blob:; frame-ancestors 'none'" }).end(html); return;
    }
    if (url.pathname === '/audio-worklet.js') { res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' }).end(await readFile(new URL('./audio-worklet.js', import.meta.url))); return; }
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403).end(); return; }
    await ready;
    if (url.pathname === '/api/timings') { res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ records: timingRecords })); return; }
    if (url.pathname === '/api/threads') {
      const result = await rpc('thread/list', { limit: 50, sortKey: 'updated_at', modelProviders: [], useStateDbOnly: true });
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ threads: result.data.map(t => ({ id: t.id, name: t.name || t.preview || 'Untitled chat', cwd: t.cwd, status: t.status })), gateway: Boolean(process.env.AI_GATEWAY_API_KEY), shared: Boolean(process.env.CODEX_VOICE_SOCKET) })); return;
    }
    res.writeHead(404).end();
  } catch (e) { res.writeHead(500, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message })); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, origin);
  if (req.headers.origin !== origin || u.pathname !== '/voice' || u.searchParams.get('token') !== token) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', ws => {
  if (clients.size) { send(ws, { type: 'error', message: 'A voice session is already open.' }); ws.close(); return; }
  const c = {
    threadId: null, live: null, speech: null, playbackVersion: 0, playback: Promise.resolve(), closing: false, starting: false,
    watcher: null, jobs: [], claimed: new Set(), pollTimer: null, pollErrors: 0,
    pollMs: 1500, speechMode: 'whole', lastSpeechAt: null, lastTranscriptAt: null,
    trace(job, stage, extra = {}) {
      job.id ||= randomUUID(); job.originAt ||= Date.now();
      const record = { type: 'timing', id: job.id, stage, at: Date.now(), elapsedMs: Date.now() - job.originAt, pollMs: this.pollMs, speechMode: this.speechMode, recovered: Boolean(job.recovered), ...extra };
      recordTiming(record); send(ws, record);
    },
    fail(message) { send(ws, { type: 'error', message }); },
    append(type, content, delegation_id = null) { if (!this.closing && this.live?.readyState === WebSocket.OPEN) send(this.live, { type, delegation_id, content: content.slice(0, 1500) }); },
    async poll() {
      if (this.closing) return;
      try {
        if (this.watcher) {
          const turns = await recentTurns(this.threadId);
          if (this.closing) return;
          for (const job of [...this.jobs]) {
            findReply(job, turns, this.claimed);
            if (job.turnId && !job.observed) {
              job.observed = true;
              const turn = turns.find(t => t.id === job.turnId);
              this.trace(job, 'message-in-codex', { codexStartedAt: turn?.startedAt == null ? null : turn.startedAt * 1000 });
            }
          }
          for (const reply of this.watcher.scan(turns)) {
            const { turn, ...result } = reply;
            const job = this.jobs.find(j => j.turnId === turn.id) || { originAt: Date.now(), recovered: true };
            this.trace(job, 'reply-detected', { codexCompletedAt: turn.completedAt == null ? null : turn.completedAt * 1000 });
            this.jobs = this.jobs.filter(j => j.turnId !== turn.id);
            send(ws, { type: 'codex-final', ...result });
            const version = this.playbackVersion;
            this.playback = this.playback.then(async () => {
              let chunkIndex = 0;
              for (const text of speechChunks(result.text, this.speechMode)) {
                if (this.closing || version !== this.playbackVersion) return;
                const index = chunkIndex++;
                this.trace(job, 'tts-start', { chunkIndex: index, characters: text.length });
                const speech = await generateSpeech({ model: 'openai/tts-1', text, voice: 'alloy', outputFormat: 'mp3', abortSignal: AbortSignal.timeout(30000) });
                if (this.closing || version !== this.playbackVersion) return;
                this.trace(job, 'audio-ready', { chunkIndex: index });
                send(ws, { type: 'audio-file', audio: speech.audio.base64, timingId: job.id, originAt: job.originAt, chunkIndex: index });
              }
            }).catch(error => { if (!this.closing) this.fail('Read-aloud failed: ' + error.message); });
          }
        }
        this.pollErrors = 0;
      } catch (error) {
        this.pollErrors++;
        if (this.pollErrors === 3) send(ws, { type: 'status', text: 'Reply monitoring is retrying. Check the Codex chat for progress.' });
      }
      if (!this.closing) this.pollTimer = setTimeout(() => this.poll(), Math.min(15000, this.pollMs * (this.pollErrors + 1)));
    },
    async forward(request, delegationId) {
      if (this.closing) return;
      send(ws, { type: 'status', text: 'Sending speech to the selected Codex chat…' });
      const job = { text: request, delegationId, originAt: this.lastSpeechAt || this.lastTranscriptAt || Date.now() };
      this.trace(job, 'forward-start', { lastTranscriptAt: this.lastTranscriptAt });
      try {
        const turns = await recentTurns(this.threadId);
        if (this.closing) return;
        job.baseline = new Set(turns.flatMap(t => t.items || []).map(i => i.id));
        this.trace(job, 'queue-start');
        this.jobs.push(job);
        try { await queueMessage(this.threadId, request); }
        catch (error) { this.jobs = this.jobs.filter(j => j !== job); throw error; }
        this.trace(job, 'queue-accepted');
        send(ws, { type: 'delegating', text: request });
        this.append('session.thinking.append', 'Request queued in the actual Codex desktop chat. It may wait for the current turn to finish. Remain silent until its result is provided. Do not answer independently.', delegationId);
      } catch (error) { this.fail(error.message); this.append('session.commentary.append', 'Codex could not accept the request: ' + error.message, delegationId); }
    },
    stop() {
      if (this.closing) return;
      this.closing = true;
      clearTimeout(this.pollTimer);
      this.speech?.stop();
      if (this.live?.readyState === WebSocket.OPEN) {
        send(this.live, { type: 'session.close' });
        const timer = setTimeout(() => this.live?.terminate(), 5000); timer.unref();
        this.live.once('close', () => clearTimeout(timer));
      } else this.live?.terminate();
    }
  };
  c.speech = new SpeechInput((text, delegationId) => c.forward(text, delegationId));
  clients.add(c);
  ws.on('message', async raw => {
    try {
      const m = JSON.parse(raw);
      if (m.type === 'start') {
        if (c.starting || c.live) throw new Error('Voice is already starting.');
        c.starting = true;
        c.pollMs = m.pollMs === 250 ? 250 : 1500;
        c.speechMode = m.speechMode === 'sentences' ? 'sentences' : 'whole';
        if (!process.env.AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is missing from the server environment.');
        if (!m.threadId) throw new Error('Choose a chat first.');
        await ready;
        const r = await rpc('thread/read', { threadId: m.threadId, includeTurns: false });
        c.threadId = r.thread.id;
        // Continue listening for work already in flight when voice reconnects.
        const baseline = await recentTurns(c.threadId);
        c.watcher = new ReplyWatcher(baseline);
        const latest = baseline[0];
        if (latest && latest.completedAt === null && !latest.error) {
          c.jobs.push({ text: '', turnId: latest.id, baseline: new Set(), delegationId: null, recovered: true });
          c.claimed.add(latest.id);
        }
        if (c.closing) return;
        send(ws, { type: 'status', text: 'Connecting voice…' });
        const live = c.live = new WebSocket('wss://ai-gateway.vercel.sh/v1/live/sessions', { headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}` }, handshakeTimeout: 15000 });
        live.on('open', () => send(live, { type: 'session.start', session: { model: 'openai/gpt-live-1', store: false, delegation: { type: 'client' }, audio: { format: { type: 'audio/pcm', rate: 24000 } }, instructions: 'You are only the speech renderer for an existing Codex desktop chat. Every user utterance must go to Codex using client delegation, including casual questions and clarifications. Do not answer questions yourself, hold a separate conversation, or greet the user. The relay also forwards transcripts automatically. Remain silent until a Codex result is provided. When a Codex result is provided, read it faithfully and concisely. Do not invent content. Respect interruptions.' } }));
        live.on('message', async raw => {
          try {
            const e = JSON.parse(raw);
            if (e.type === 'session.started') {
              send(ws, { type: 'listening' });
              c.poll();
            } else if (e.type === 'session.input_transcript.delta') { c.lastTranscriptAt = Date.now(); c.playbackVersion++; c.speech.append(e.delta); send(ws, { type: 'user-transcript', delta: e.delta }); }
            else if (e.type === 'session.delegation.created') await c.speech.flush(e.delegation.id);
            else if (e.type === 'error') { if (!c.closing) c.fail(e.error?.message || JSON.stringify(e)); c.stop(); }
            else if (e.type === 'session.closed') { send(ws, { type: 'ended', seconds: e.usage?.seconds }); live.close(); }
            else if (/interrupt|speech_started/.test(e.type)) send(ws, { type: 'interrupt-audio' });
          } catch (error) { c.fail(error.message); }
        });
        live.on('unexpected-response', (_, response) => { c.fail(`Gateway voice returned HTTP ${response.statusCode}.`); response.resume(); live.terminate(); });
        live.on('error', e => c.fail(e.message));
        live.on('close', () => { send(ws, { type: 'ended' }); if (ws.readyState === WebSocket.OPEN) ws.close(); });
      } else if (m.type === 'audio' && !c.closing && c.live?.readyState === WebSocket.OPEN) {
        if (Number.isFinite(m.speechAt) && Math.abs(Date.now() - m.speechAt) < 5000) c.lastSpeechAt = m.speechAt;
        send(c.live, { type: 'session.input_audio.append', audio: m.audio });
      } else if (m.type === 'audio-started' && typeof m.timingId === 'string' && Number.isFinite(m.clientAt)) {
        const previous = timingRecords.find(r => r.id === m.timingId);
        if (previous) c.trace({ id: m.timingId, originAt: previous.at - previous.elapsedMs }, 'audio-started', { chunkIndex: m.chunkIndex, clientAt: m.clientAt });
      }
      else if (m.type === 'stop') c.stop();

    } catch (error) { c.fail(error.message); if (!c.live) ws.close(); }
  });
  ws.on('close', () => { c.stop(); clients.delete(c); });
  ws.on('error', () => c.stop());
});
server.listen(port, '127.0.0.1', () => console.log(`Codex Voice Prototype: ${origin}`));
function shutdown() { for (const c of clients) c.stop(); setTimeout(() => { codex.kill(); server.close(); process.exit(); }, 5500).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
