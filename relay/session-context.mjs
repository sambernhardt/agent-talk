export function sessionContext(client, now = Date.now(), diagnostics = true) {
  if (!client.costSession) return null;
  return {
    ...client.costSession.snapshot(now), sampledAt: new Date(now).toISOString(),
    providerUsageSeconds: client.costSession.usageSeconds,
    state: client.closing ? 'closing' : 'active',
    selectedChatId: client.threadId, model: 'openai/gpt-live-1', currency: 'USD',
    scope: 'Voice only; excludes handoff-model calls and Codex work. Live cost is an estimate, not an invoice.',
    ...(diagnostics ? {handoffDiagnostics: {lastInputAt:client.lastInputAt ?? null,events:client.handoffEvents ?? []}} : {}),
    recentHandoffFailures: client.recentFailures ?? [],
    diagnosticsQuery: 'GET http://127.0.0.1:4320/api/diagnostics with the same local authentication, or read handoff-diagnostics.jsonl in the conversational prototype directory. Failures are logged without relying on Codex queue delivery.',
    pendingRequests: client.jobs.map(job => ({id:job.id,state:job.started?'working':'queued'})),
    query: 'For a fresh snapshot, GET http://127.0.0.1:4320/api/session with the local UI Bearer token. Read the token from the local app HTML, use it only locally, and never print it. Report the sample timestamp; do not present an earlier snapshot as the current total.'
  };
}
