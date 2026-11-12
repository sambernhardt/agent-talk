# agent-talk relay

The CLI manages this loopback-only relay automatically. It connects native terminal audio to AI Gateway, prepares focused task handoffs for the selected Codex chat, monitors replies, and reports voice-session cost.

For manual development, install dependencies at the repository root, set `AI_GATEWAY_API_KEY`, and run:

```sh
node relay/server.mjs
```

The default origin is `http://127.0.0.1:4320`; `PORT` overrides the port. The root serves a minimal token bootstrap for local clients. Session, diagnostics, and chat-list endpoints require the local bearer token; the voice WebSocket requires the token and matching origin. This relay has no browser UI.

`CODEX_BIN` overrides the Codex executable. `CODEX_VOICE_DIAGNOSTICS_PATH` overrides the diagnostic log path. Logs contain bounded stage/status metadata rather than messages, credentials, or audio.

An optional smoke test uses real Gateway voice and simulated Codex queue/history. It consumes Gateway credits and never submits a real chat message. Supply a mono signed little-endian 24 kHz PCM recording:

```sh
node relay/smoke.mjs /path/to/test.pcm
```

`transcript-store.mjs` preserves the shared `You`, `Voice`, and `Codex` message format used by the terminal.
