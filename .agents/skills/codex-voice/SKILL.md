---
name: codex-voice
description: Open the Mac voice companion attached to Codex, start voice in the current chat, stop voice, or inspect its status.
---

Use `desktop-prototype/launch.mjs` from this repository. Read `--help` for syntax. The launcher reuses the running Mac app and displays its attached chin. Keep work in the original Codex chat.

For “open/show”, run `show --thread-id CURRENT_THREAD_ID`; this binds the picker without audio. For an explicit start request (including `$codex-voice` without a narrower action), run `start --thread-id CURRENT_THREAD_ID`. Skill invocation authorizes this start. Resolve the actual current chat ID from trusted task context or `CODEX_THREAD_ID`. If unavailable, ask for it rather than choosing a recent chat or inventing an ID.

For “stop”, run `stop`; for inspection, run `status`. Neither launches an absent app. Stop ends voice while keeping the app available. Hiding keeps listening.

Start succeeds when JSON reports `phase: "active"` for the requested thread; stop succeeds at `phase: "idle"`. Report launcher errors. After a timeout inspect status before retrying: voice may still be active. If another chat is active, report the conflict and let the user choose whether to stop it.

For build or launch prerequisites read [the desktop README](../../../desktop-prototype/README.md). Request OS launch permission through the execution tool if required. Use the Mac launcher rather than opening a terminal companion. Starting voice does not authorize sending text messages to other chats or people.
