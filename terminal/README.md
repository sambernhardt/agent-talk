# agent-talk terminal

A terminal client for the existing concierge relay: explicit chat binding, elapsed time, shared session-cost estimate/final usage, independent input/output waveform histories, and start/stop/mute controls. This is the primary voice interface; it shares the existing relay.

```sh
node terminal/cli.mjs --help
node terminal/cli.mjs --pick --start
node terminal/cli.mjs --thread YOUR_CHAT_ID
node terminal/cli.mjs --thread YOUR_CHAT_ID --relay http://127.0.0.1:4320
```

With no `--thread`, the CLI opens a chat picker. Type to filter titles and workspace paths, use arrows to select, Enter to open, or Esc to cancel. `--pick --thread ID` preselects the originating chat while allowing a different selection. `--start` begins voice immediately after selection; without it the client starts idle. The picker selects existing chats and does not create a new Codex chat. The relay must already be running.

By default the real client starts idle; S opens microphone and connects. X stops voice, M toggles microphone mute, Q/Ctrl-C exits and restores terminal modes. SGR mouse clicks on the buttons work when the terminal forwards mouse input; keyboard controls always work. Small terminals clip the layout, so use the keyboard if buttons are clipped.

The header resolves the selected chat's title from the relay at launch. Use `--label "Chat title"` to supply a display label explicitly. If title lookup is unavailable, it shows “Current chat”; the required `--thread` ID still binds all voice work to the original chat. Existing skill invocations work without new arguments.

Spoken exchanges stream into a rolling transcript using the browser's existing `You`, `Voice`, and `Codex` message format. User and assistant fragments merge within their own turns; final Codex answers replace partial responses. The terminal keeps the latest 100 messages in memory and shows the latest lines that fit below its controls. Short panels use a compact layout. This updates the terminal transcript only, not the original Codex chat history. Running clients load code changes on their next launch; there is no need to interrupt an active call.

Queued requests show `Voice companion handoff · <request ID> · queued`, followed by their work status. The full request is saved in a private temporary directory and exposed as a short `handoff-<ID>.txt` link (clickable in terminals supporting OSC 8 file links). The request body is not rendered in the terminal. Files remain available after quitting until the OS clears temporary storage; the Codex queue still receives the full execution context.

Real audio requires macOS, Swift command line tools, microphone permission for the host application, and a running concierge relay with gateway credentials. Swift is compiled locally on first real launch. The native helper captures/resamples mono signed little-endian 24 kHz PCM and plays the relay's matching output. Mute sends zero PCM frames; stop kills audio subprocesses and asks the relay to end the billed session. Use headphones: this native path has no browser echo cancellation. Microphone/device failure or relay timeout ends the local session with an error; there is no simulated real-mode fallback. Cost reuses `session-cost.mjs`: estimates are labeled, final usage replaces estimates, and Codex/text charges are excluded.

The repo-local `codex-voice-terminal` skill uses the local relay on port 4320 and starts a relay when needed. Agent execution PTYs and Codex's integrated terminal are separate sessions: passing an exec session ID to `open_in_codex` does not attach that process. Automatic launch requires a dedicated app terminal execution tool, which this session currently does not expose. With only open/read tools, the skill opens the panel and supplies the exact command for the user to run. Codex local-environment actions also support user-triggered integrated-terminal commands. The skill never opens external Terminal or leaves an unattached background UI running.

## Offline verification

```sh
node terminal/cli.mjs --thread fixture --demo --frames 1
node terminal/cli.mjs --thread fixture --demo
node --test terminal/*.test.mjs
swiftc -module-cache-path /tmp/codex-voice-terminal-module-cache terminal/audio.swift -o /tmp/codex-voice-terminal-audio-check
```

Demo mode labels fixture waves/cost, skips native build/devices, and makes no network or billed calls. S/X/M/Q remain usable. `--frames N` prints finite frames without a TTY. Compiling the helper does not run it. Real microphone capture/playback and billed relay sessions have intentionally not been exercised.
