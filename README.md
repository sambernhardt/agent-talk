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

## Desktop UI lab

[desktop-prototype](desktop-prototype/README.md) adds an Electron menu bar app with three
experimental presentations: a transcript panel, a floating voice capsule, and a bottom bar
that follows the Codex window using a small native macOS helper. It reuses the conversational
relay and keeps the two browser implementations available.

```sh
cd desktop-prototype
npm ci
npx install-electron
npm start
```

## Voice launch skills and terminal UI

Repository skills live in `.agents/skills`:

- `codex-voice` opens the Mac chin and starts or stops voice bound to the originating Codex thread.
- `codex-voice-terminal` opens Codex's built-in terminal panel and prepares the voice command. Automatic launch requires an app terminal execution tool; with the current open/read tools, you run the prepared command in that panel.

The terminal interface shares the conversational relay and cost calculation. It has separate
microphone/speaker waveforms, elapsed time, estimated voice cost, keyboard controls, and mouse
buttons in terminals supporting SGR mouse reporting. Real audio uses a small macOS Swift helper.
See [terminal setup and controls](terminal-prototype/README.md).

For a preview with no microphone, relay connection, or Gateway usage:

```sh
node terminal-prototype/cli.mjs --thread preview --demo
```

Both interfaces bind an explicit thread ID. Start only one voice interface at a time;
stopping voice leaves delegated Codex work running. These launch additions do not insert
voice transcripts into Codex history or add a startup summarization call.
