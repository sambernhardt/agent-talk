# agent-talk

Interactive terminal voice for coding agents. Codex is supported; Claude is coming soon.

```sh
npx agent-talk
```

First launch asks for an AI Gateway token, then lets you choose an agent and chat. Type to filter chats and press Enter to start voice. Requires macOS, Node.js 22+, Swift command line tools (`xcode-select --install`), and an authenticated Codex CLI with `codex queue` support.

**S** starts voice, **X** stops, **M** mutes, and **Q** quits. The terminal shows session cost, audio activity, spoken exchanges, and delegated task status. Gateway usage is billed separately from Codex. See [setup and credentials](AGENT-TALK.md) and [terminal controls](terminal/README.md).

## Launch from Codex

Open this project in Codex and choose **Voice** from the project actions in the top toolbar. The action runs `node bin/agent-talk.mjs` in the integrated terminal. Choose Codex, select your chat, and press Enter to start voice. Run `npm install` once before using the action in a fresh checkout.

The action is configured in `.codex/environments/environment.toml`. If it does not appear, select the `agent-talk` local environment in Codex's project settings.

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
npx --yes --package=./agent-talk-0.1.4.tgz agent-talk
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

Display controls: **H** changes the agent/chat from the title row. **C** opens Config, with **T** for transcript and **W** for IN/OUT waveforms; **Esc** closes it. Voice controls remain at the bottom. Display choices persist between launches. Changing chat stops the current voice session; press **S** to start again. Claude remains coming soon.

Waveforms are hidden by default. Transcript mode replaces the orb and uses the main content area; turning it off restores the orb. Saved display preferences still take precedence over defaults.

## Install the Codex toolbar action

From any project, run:

```sh
npx agent-talk install-codex-voice-action
```

Or register several projects at once:

```sh
npx agent-talk install-codex-voice-action ~/Dev/project-one ~/Dev/project-two
```

This adds **Voice** to each project's `.codex/environments/environment.toml`. The action runs `npx agent-talk` in Codex's integrated terminal. Existing actions, setup scripts, comments, and formatting are preserved. Re-running the installer skips an existing installation; a conflicting Voice action or invalid configuration is left untouched and reported. Installation needs no microphone, credentials, or running relay.

Open the project in Codex and choose **Voice** in the toolbar actions. If missing, select the project's local environment in settings. Actions are project-specific; installation does not create a global toolbar button.

## Browser-driven terminal preview

```sh
npm run preview
# or: node bin/agent-talk.mjs preview
```

Run in an interactive terminal and open the printed local URL in your browser.
The browser is the control panel; the terminal renders the live output using the
same renderer as the voice client. Toggles, text inputs, session/job state,
waveform levels, and animation speed stream over a local WebSocket. Changes stay
in the preview and do not alter saved preferences. No credentials or audio are
needed. Press Q or Ctrl-C in the terminal to stop both the preview and server.

Character presets include Original (the initial ASCII ramp), Dense ASCII, Blocks,
Dots, Solid, and Custom. Type a custom ramp from light to dense to switch to Custom
immediately; all presets keep the same colors. Solid is the default. Preview development watches terminal
`.mjs` and `.html` sources: edits restart the local renderer/server, refresh the
browser, and preserve the control URL and current settings. Restart the preview once
when upgrading an older running version to enable this watcher.
