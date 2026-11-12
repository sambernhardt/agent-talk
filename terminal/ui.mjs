import {duration} from '../relay/session-cost.mjs';
import {pathToFileURL} from 'node:url';
export const clean = value => String(value ?? '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
const bars = ' ▁▂▃▄▅▆▇█';
export const controlsRow = rows => rows < 16 ? 8 : 10;
export function waveform(history, width) {
  return history.slice(-width).map(v => bars[Math.min(8, Math.round(v * 8))]).join('').padStart(width, ' ');
}
export function transcriptLines(messages,columns) {
  const width=Math.max(1,columns-3);
  return messages.flatMap(message=>{
    const text=`${clean(message.label)}: ${clean(message.text)}`;
    const lines=[];
    for(let offset=0;offset<text.length;offset+=width)lines.push(`  ${text.slice(offset,offset+width)}`);
    return lines;
  });
}
export function render(s, {columns = 80, rows = 24, demo = false, input = [], output = []} = {}) {
  const width = Math.max(12, Math.min(58, columns - 12));
  const cost = s.cost?.snapshot();
  const compact=rows<16;
  const lines = [
    `  AGENT TALK${demo ? '  ·  DEMO / FIXTURE · NO AUDIO OR NETWORK' : ''}`,
    `  Chat ${clean(s.threadLabel || 'Current chat')}`, `  ${clean(s.notice)}`,
    `  ${clean(s.state).toUpperCase()}${s.muted ? ' · MIC MUTED' : ''}   ${duration(cost?.elapsedSeconds || 0)}   ${demo ? 'Fixture' : cost?.estimated === false ? 'Usage' : 'Estimate'} $${(cost?.cost || 0).toFixed(4)}`,
    '  Voice $3/hr · excludes Codex/text charges', ...(!compact?['']:[]),
    `  IN  ${waveform(input, width)}`, `  OUT ${waveform(output, width)}`, ...(!compact?['']:[]),
    '  [S Start]   [X Stop]   [M Mute]   [Q Quit]',
  ];
  const fileRow=lines.length;
  if(s.handoff?.path)lines.push(`  Details: handoff-${clean(s.handoff.id)}.txt`);
  else if(s.handoff?.fileError)lines.push('  Handoff details file unavailable');
  const available=Math.max(0,rows-1-lines.length);
  if(available)lines.push(...transcriptLines(s.messages||[],columns).slice(-available));
  return lines.slice(0, Math.max(1, rows - 1)).map((l,index) => {
    const clipped=l.slice(0, Math.max(1, columns - 1));
    // OSC 8 links keep the visible label short; the target is a locally saved file.
    return index===fileRow && s.handoff?.path ? `\x1b]8;;${pathToFileURL(s.handoff.path).href}\x1b\\${clipped}\x1b]8;;\x1b\\` : clipped;
  }).join('\n');
}
export class Controls {
  constructor(action, buttonRow=()=>10) { this.action = action; this.pending = ''; this.buttonRow=buttonRow; }
  feed(chunk) {
    this.pending += chunk;
    while (this.pending.length) {
      if (this.pending.startsWith('\x1b')) {
        const mouse = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(this.pending);
        if (mouse) {
          this.pending = this.pending.slice(mouse[0].length);
          const [,button,x,y,edge] = mouse;
          if (edge === 'M' && button === '0' && Number(y) === this.buttonRow()) {
            const col = Number(x);
            if (col >= 3 && col <= 11) this.action('s');
            else if (col >= 15 && col <= 22) this.action('x');
            else if (col >= 26 && col <= 33) this.action('m');
            else if (col >= 37 && col <= 44) this.action('q');
          }
          continue;
        }
        if (/^\x1b(?:\[<\d*(?:;\d*){0,2})?$/.test(this.pending)) return;
        const escape = /^\x1b\[[0-9;?]*[A-Za-z~]/.exec(this.pending);
        this.pending = this.pending.slice(escape?.[0].length || 1); continue;
      }
      const key = this.pending[0].toLowerCase(); this.pending = this.pending.slice(1);
      if ('sxm q\x03'.includes(key) && key !== ' ') this.action(key === '\x03' ? 'q' : key);
    }
  }
}
