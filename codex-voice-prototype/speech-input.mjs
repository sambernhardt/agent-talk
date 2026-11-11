// Forward each utterance after a transcription pause, independent of model delegation.
export class SpeechInput {
  constructor(forward, delay = 1600) { this.forward = forward; this.delay = delay; this.text = ''; this.timer = null; this.closed = false; this.chain = Promise.resolve(); }
  append(delta) {
    if (this.closed) return;
    this.text += delta;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush(); }, this.delay);
  }
  flush(delegationId = null) {
    clearTimeout(this.timer);
    const text = this.text.trim(); this.text = '';
    if (!text || this.closed) return this.chain;
    this.chain = this.chain.then(() => this.forward(text, delegationId));
    return this.chain;
  }
  stop() { this.closed = true; clearTimeout(this.timer); this.text = ''; }
}
