import readline from 'node:readline';

// Every query word must match the title or workspace, regardless of order.
export function filterChats(chats, query) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return chats.filter(chat => words.every(word => `${chat.name} ${chat.cwd || ''}`.toLocaleLowerCase().includes(word)));
}
const plain = value => String(value || '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');

export function pickChat(chats, {input=process.stdin, output=process.stdout, preferredId, title='AGENT TALK · Choose a Codex chat'}={}) {
  if (!chats.length) throw new Error('No Codex chats found. Create a chat in Codex and try again.');
  if (!input.isTTY || !output.isTTY) throw new Error('The chat picker requires an interactive terminal.');
  return new Promise(resolve => {
    let query = '', selected = Math.max(0, chats.findIndex(chat => chat.id === preferredId));
    const wasRaw = input.isRaw;
    const draw = () => {
      const matches = filterChats(chats, query);
      selected = Math.max(0, Math.min(selected, matches.length - 1));
      const width = Math.max(10, (output.columns || 80) - 1);
      const count = Math.max(1, (output.rows || 24) - 6);
      const offset = Math.max(0, selected - count + 1);
      const lines = [title, `Search: ${query}`, 'Type to filter · ↑/↓ select · Enter open · Esc cancel', ''];
      if (!matches.length) lines.push('No matching chats');
      for (let i=offset; i<Math.min(matches.length, offset+count); i++) {
        const chat = matches[i];
        lines.push(`${i === selected ? '› ' : '  '}${plain(chat.name)}${chat.cwd ? ` · ${plain(chat.cwd)}` : ''}`);
      }
      output.write('\x1b[H\x1b[2J' + lines.map((line,index) => { const clipped=plain(line).slice(0,width); return index===0?clipped.replace(/^AGENT TALK/, '\x1b[1mAGENT TALK\x1b[22m'):clipped; }).join('\n'));
    };
    const finish = chat => {
      input.off('keypress', onKey); output.off('resize', draw);
      process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
      input.setRawMode(Boolean(wasRaw)); input.pause();
      output.write('\x1b[?25h\x1b[?1049l'); resolve(chat);
    };
    const cancel = () => finish(null);
    const onKey = (text, key={}) => {
      const matches = filterChats(chats, query);
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return cancel();
      if (key.name === 'return') { if (matches[selected]) finish(matches[selected]); return; }
      if (key.name === 'up') selected = Math.max(0, selected - 1);
      else if (key.name === 'down') selected = Math.min(matches.length - 1, selected + 1);
      else if (key.name === 'backspace') { query = Array.from(query).slice(0,-1).join(''); selected = 0; }
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f-\x9f]/.test(text)) { query += text; selected = 0; }
      draw();
    };
    readline.emitKeypressEvents(input); input.setRawMode(true); input.resume();
    input.on('keypress', onKey); output.on('resize', draw);
    process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
    output.write('\x1b[?1049h\x1b[?25l'); draw();
  });
}
