# Talk to Codex

A terminal voice companion for existing Codex chats. The terminal client is the active development direction; the browser prototypes remain as references and supply the shared conversational relay.

## Terminal voice

Requires macOS, Node 24+, Swift command line tools, Codex CLI with `codex queue`, and `AI_GATEWAY_API_KEY` in the relay environment.

Start the relay in one terminal:

```sh
npm --prefix codex-voice-concierge-prototype ci
npm --prefix codex-voice-concierge-prototype start
```

Then start the client in another terminal (or Codex's terminal panel):

```sh
node terminal-prototype/cli.mjs --thread YOUR_CHAT_ID
```

**S** starts voice, **X** stops, **M** mutes, and **Q** quits. See [terminal setup and controls](terminal-prototype/README.md). The repo-local `codex-voice-terminal` skill prepares a command bound to the current chat.

For an offline preview without microphone or Gateway usage:

```sh
node terminal-prototype/cli.mjs --thread preview --demo
```

## Browser references

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
node --test terminal-prototype/*.test.mjs codex-voice-prototype/*.test.mjs codex-voice-concierge-prototype/*.test.mjs
node --check codex-voice-prototype/server.mjs
node --check codex-voice-concierge-prototype/server.mjs
```

Gateway smoke checks are described in each approach's README. They consume Gateway credits and use simulated Codex work.

This repository was extracted from Flow state's tools directory. No remote repository is configured. Local dependencies and diagnostic recordings/logs are excluded from commits.


## Previous desktop experiments

The Electron menu panel, floating capsule, attached chin, and voice orb were retired on `codex/terminal-only`. Their source is preserved in checkpoint commit `5c96c9f` on `main`.
