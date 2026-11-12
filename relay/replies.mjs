// Match only new user items with the exact queued transcript. Claim each turn once.
export function findReply(job, turns, claimed) {
  const turn = job.turnId ? turns.find(t => t.id === job.turnId) : [...turns].reverse().find(t =>
    !claimed.has(t.id) && (t.items || []).some(i => i.type === 'userMessage' && !job.baseline.has(i.id) &&
      (i.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim() === job.text));
  if (!turn) return null;
  job.turnId = turn.id; claimed.add(turn.id);
  if (!['completed', 'failed', 'interrupted'].includes(turn.status)) return null;
  // Another app-server sees a desktop-owned active turn as interrupted.
  // With no completion timestamp or error, it is still waiting for its owner.
  if (turn.status === 'interrupted' && turn.completedAt == null && !turn.error) return null;
  const text = (turn.items || []).filter(i => i.type === 'agentMessage' && (!i.phase || i.phase === 'final_answer')).map(i => i.text).join('\n');
  return { text: text || turn.error?.message || `Codex turn ${turn.status}.`, status: turn.status };
}
