# Talk to Codex

Two local voice experiments that work with existing Codex desktop chats.

| Approach | Folder | Local URL |
| --- | --- | --- |
| Direct speech → Codex → spoken reply | [Original](codex-voice-prototype/README.md) | http://127.0.0.1:4318 |
| Realtime conversation with focused Codex handoffs | [Conversational](codex-voice-concierge-prototype/README.md) | http://127.0.0.1:4320 |

Requires Node 24+, a Codex CLI supporting `codex queue`, and `AI_GATEWAY_API_KEY` in the server environment. Credentials stay outside Git. Each folder has its own dependency lockfile.

```sh
cd codex-voice-concierge-prototype
npm ci
npm start
```

Use the same commands in `codex-voice-prototype` for the original approach. Choose an existing Codex chat in the browser. Enable only one microphone session at a time. End voice mode to close the billable voice connection; queued work continues in Codex.

See [PLAN.md](PLAN.md) for the development plan and [exploration notes](codex-voice-concierge-prototype/IDEAS.md) for the original ideas.

## Validation

From the repository root:

```sh
node --test codex-voice-prototype/*.test.mjs codex-voice-concierge-prototype/*.test.mjs
node --check codex-voice-prototype/server.mjs
node --check codex-voice-concierge-prototype/server.mjs
```

Gateway smoke checks are described in each approach's README. They consume Gateway credits and use simulated Codex work.

This repository was extracted from Flow state's tools directory. No remote repository is configured. Local dependencies and diagnostic recordings/logs are excluded from commits.
