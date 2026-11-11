function finished(turn) {
  return ['completed', 'failed', 'interrupted'].includes(turn.status) &&
    !(turn.status === 'interrupted' && turn.completedAt == null && !turn.error);
}
function finals(turn) {
  return (turn.items || []).filter(i => i.type === 'agentMessage' && (!i.phase || i.phase === 'final_answer'));
}

// Observe the selected chat, independent of which client submitted its messages.
export class ReplyWatcher {
  constructor(baseline) {
    this.seenItems = new Set(baseline.flatMap(t => finished(t) ? finals(t) : finals(t).filter(i => i.completedAtMs != null)).map(i => i.id));
    this.seenTerminal = new Set(baseline.filter(finished).map(t => t.id));
  }
  scan(turns) {
    const replies = [];
    for (const turn of [...turns].reverse()) {
      if (!finished(turn)) continue;
      const items = finals(turn).filter(i => !this.seenItems.has(i.id));
      for (const item of items) this.seenItems.add(item.id);
      const text = items.map(i => i.text).filter(Boolean).join('\n');
      const error = !this.seenTerminal.has(turn.id) && turn.error?.message;
      this.seenTerminal.add(turn.id);
      if (text || error) replies.push({ turn, text: text || error, status: turn.status });
    }
    return replies;
  }
}
