# agent-talk

Run `npx agent-talk` in an interactive macOS terminal. Choose Codex, type to filter your chats, and press Enter to start voice. Claude is coming soon.

Requires Node.js 22+, macOS, Xcode Command Line Tools (`xcode-select --install`), and an authenticated Codex CLI that supports `codex queue`. The selected chat receives tasks you ask the voice companion to delegate. The terminal shows spoken exchanges, session cost, waveforms, and queued task labels.

First launch prompts for an AI Gateway token without echoing it. It is saved as plaintext in `~/.config/agent-talk/config.json` with owner-only file permissions. Set `AI_GATEWAY_API_KEY` to override it, or run `npx agent-talk setup` to replace it. Tokens saved by earlier versions under `~/.config/voice-mode/config.json` are still accepted; running setup saves to the new location. Gateway usage is billed separately from Codex. Voice starts after chat selection and may prompt for microphone permission. Use headphones.

S starts, X stops voice, M mutes, Q exits. Esc cancels a picker. `npx agent-talk --demo` previews the UI without credentials, audio, or billing. The CLI manages its own loopback relay and shuts it down on exit. Diagnostics stay under the user config directory.

This package does not provide an API for opening/running commands in the Codex app's integrated terminal.
