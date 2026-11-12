import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
const source = fileURLToPath(new URL('./audio.swift', import.meta.url));
const binary = fileURLToPath(new URL('./.audio-host', import.meta.url));
// Generated speech arrives faster than playback. Bound memory independently of
// playback lag; the native pipe and semaphore still pace the output device.
export const MAX_PLAYBACK_BYTES = 24000 * 2 * 120;
export async function prepareAudio() {
  if (process.platform !== 'darwin') throw new Error('Native audio requires macOS and the Swift command line tools. Demo works on any OS.');
  const built = await stat(binary).catch(() => null);
  if (!built || built.mtimeMs < (await stat(source)).mtimeMs) {
    const r = spawnSync('/usr/bin/swiftc', [source, '-o', binary], {encoding:'utf8'});
    if (r.error || r.status !== 0) throw new Error(`Cannot build native audio. Install Xcode Command Line Tools (xcode-select --install). ${r.error?.message || r.stderr}`);
  }
}
export class NativeAudio {
  constructor(onPCM, onError) { this.onPCM = onPCM; this.onError = onError; this.children = new Set(); this.stopped = false; }
  child(mode) {
    const child = spawn(binary, [mode], {stdio:['pipe','pipe','pipe']});
    this.children.add(child);
    let diagnostic = '';
    child.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-3000); });
    child.on('error', e => this.onError(e));
    child.stdin.on('error', e => { if (!this.stopped && e.code !== 'EPIPE') this.onError(e); });
    child.on('exit', code => {
      this.children.delete(child);
      if (!this.stopped && !child.intentional) this.onError(new Error(`Native ${mode} exited (${code}): ${diagnostic.trim() || 'Check microphone/audio permissions.'}`));
    });
    return child;
  }
  async start() {
    this.capture = this.child('capture'); this.player = this.child('play');
    this.capture.stdout.on('data', b => this.onPCM(b));
    await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new Error('Microphone did not become ready. Check host app microphone permission.')), 15000);
      const ready = b => { text += b; if (text.includes('READY')) { clearTimeout(timer); resolve(); } };
      this.capture.stderr.on('data', ready);
      this.capture.once('exit', () => { clearTimeout(timer); reject(new Error('Microphone failed to start. Check permissions and input device.')); });
      this.capture.once('error', e => { clearTimeout(timer); reject(e); });
    });
  }
  play(pcm) {
    if ((this.player?.stdin.writableLength || 0) + pcm.length > MAX_PLAYBACK_BYTES) throw new Error('Audio playback queue exceeded two minutes; session stopped.');
    this.player?.stdin.write(pcm);
  }
  interrupt() {
    if (this.stopped) return;
    if (this.player) { this.player.intentional = true; this.player.kill(); }
    this.player = this.child('play');
  }
  stop() {
    this.stopped = true;
    for (const child of this.children) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 1000); timer.unref();
      child.once('exit', () => clearTimeout(timer));
    }
  }
}
