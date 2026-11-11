class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(480); this.offset = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (const value of input) {
      this.buffer[this.offset++] = value;
      if (this.offset === 480) { this.port.postMessage(this.buffer.slice()); this.offset = 0; }
    }
    return true;
  }
}
registerProcessor('capture', Capture);
