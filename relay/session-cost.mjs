// Published GPT-Live voice rate, verified 2026-11-10. Excludes text handoffs and Codex.
export const HOURLY_USD = 3;
export const costForSeconds = seconds => Math.max(0, seconds) * HOURLY_USD / 3600;
export function duration(seconds) {
  const s = Math.floor(Math.max(0, seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export class SessionCost {
  constructor(id, startedAt = Date.now()) {
    this.id = id; this.startedAt = startedAt; this.usageSeconds = null;
    this.usageAt = startedAt; this.endedAt = null; this.finalUsage = false;
  }
  usage(seconds, now = Date.now(), final = false) {
    if (!Number.isFinite(seconds) || seconds < 0 || this.finalUsage) return;
    // Snapshots are cumulative, never additive. Ignore stale updates.
    if (!final && seconds < (this.usageSeconds ?? 0)) return;
    this.usageSeconds = seconds; this.usageAt = now; this.finalUsage = final;
  }
  finish(now = Date.now()) { this.endedAt ??= now; }
  snapshot(now = Date.now()) {
    const ended = this.endedAt !== null;
    const elapsedSeconds = Math.max(0, ((this.endedAt ?? now) - this.startedAt) / 1000);
    const seconds = this.finalUsage ? this.usageSeconds : ended
      ? (this.usageSeconds ?? elapsedSeconds)
      : this.usageSeconds === null ? elapsedSeconds : this.usageSeconds + Math.max(0, (now - this.usageAt) / 1000);
    return { id:this.id, startedAt:this.startedAt, seconds, elapsedSeconds,
      cost:costForSeconds(seconds), hourlyUsd:HOURLY_USD, estimated:!this.finalUsage };
  }
}
export function saveSession(history, entry) {
  return [entry, ...history.filter(s => s.id !== entry.id)].slice(0, 100);
}
