# agent-talk

Interactive terminal voice for coding agents. Codex is supported; Claude is coming soon.

```sh
npx agent-talk
```

Choose an agent, type to filter chats, and press Enter to start voice. First launch asks for an AI Gateway token. Requires macOS, Node.js 22+, Swift command line tools (`xcode-select --install`), and an authenticated Codex CLI with `codex queue` support.

**S** starts voice, **X** stops, **M** mutes, and **Q** quits. The terminal shows session cost, audio activity, spoken exchanges, and delegated task status. Gateway usage is billed separately from Codex. See [setup and credentials](AGENT-TALK.md) and [terminal controls](terminal/README.md).

## Local development

```sh
npm install
node bin/agent-talk.mjs
```

The CLI starts and stops its own local relay. For an offline preview without a microphone or Gateway usage:

```sh
node bin/agent-talk.mjs --demo
```

For a locally packed build:

```sh
npm pack
npx --yes --package=./agent-talk-0.1.0.tgz agent-talk
```

## Source

- `bin/`: CLI entry point, setup, and local relay lifecycle.
- `terminal/`: agent/chat pickers, audio helper, transcript, and terminal UI.
- `relay/`: AI Gateway voice connection, Codex handoffs, reply monitoring, and session cost.
- `.agents/skills/`: Codex launch instructions.

The repo-local `codex-voice-terminal` skill prepares a command bound to the current chat. Running it automatically in Codex's integrated terminal requires an app terminal execution API.

## Validation

```sh
npm test
node --check relay/server.mjs
```

An optional Gateway smoke check uses simulated Codex work and real billable voice. See [relay notes](relay/README.md). Credentials, dependencies, logs, and recordings are excluded from Git and the npm package.
