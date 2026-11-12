// Paint changed rows atomically without blanking the animation between frames.
export function createScreen(output) {
  let previous = [], columns, invalid = true, blocked = false;
  return {
    invalidate() { invalid = true; },
    draw(frame, width) {
      if (blocked) return;
      const lines = frame.split('\n');
      const reset = invalid || columns !== width;
      let packet = reset ? '\x1b[H\x1b[2J' : '';
      for (let i = 0; i < Math.max(lines.length, previous.length); i++) {
        const line = lines[i] ?? '';
        if (reset || line !== previous[i]) packet += `\x1b[${i + 1};1H\x1b[0m${line}\x1b[0m\x1b[K`;
      }
      if (!packet) return;
      previous = lines; columns = width; invalid = false;
      if (!output.write('\x1b[?2026h' + packet + '\x1b[?2026l')) {
        blocked = true;
        output.once('drain', () => { blocked = false; });
      }
    }
  };
}
