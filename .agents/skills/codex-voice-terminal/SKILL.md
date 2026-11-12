---
name: codex-voice-terminal
description: Open the voice terminal UI inside the current Codex window, with session cost, waveforms, elapsed time, and start, stop, and mute controls.
---

Launch the terminal client in this repository and request the current chat's built-in Codex terminal panel. Keep the original Codex thread as the work owner. Read [terminal setup](../../../terminal-prototype/README.md) for prerequisites and controls.

## Required terminal capability

An `exec_command` PTY and the desktop app's integrated terminal are separate sessions. Passing an execution `session_id` to `open_in_codex` does not attach that process to the app panel. This has been tested here: the panel opens a separate shell. A `queued` response confirms only a pending panel request.

Before launching a client, inspect available tools for an operation that executes a command in an **app terminal session**. `open_in_codex` and `read_thread_terminal` alone do not provide it. When no such operation is available, open the app terminal panel without a session ID, prepare the exact command bound to the current chat, and give it to the user to run there. Report this launch limitation before starting any background UI. Never repeat the execution-session attachment workaround. A configured Codex local-environment action is another supported user-triggered launch path.

## Launch

1. Resolve this repository's absolute root from this skill's location and the actual current thread ID from trusted task context or `CODEX_THREAD_ID`. If the ID is unavailable, ask for it. Bind the originating thread explicitly; choosing a recent thread is not a substitute.
2. For a preview, use `--demo` and skip relay and audio setup. For live use, check the existing concierge relay on `http://127.0.0.1:4320`, or the Mac app's relay on port 4330. Check for the `voice-token` meta tag without displaying its value. A successful HTTP response alone does not identify the relay. Reuse a matching relay; an already active voice interface must be stopped before starting another.
3. If no relay is running, check whether `AI_GATEWAY_API_KEY` is set without printing it. If missing, explain that the relay needs the key in its launching environment. Otherwise build the concierge frontend with `npm --prefix codex-voice-concierge-prototype run build`, then start `node codex-voice-concierge-prototype/server.mjs` in a persistent execution session from the repository root. Check startup output for readiness or errors. Keep its session ID for cleanup; only stop a relay this invocation started, after its voice session ends.
4. Prepare `node terminal-prototype/cli.mjs --thread THREAD_ID --relay RELAY_ORIGIN`, with the repository root as the working directory. Quote the thread ID as a shell argument. For preview, use `node terminal-prototype/cli.mjs --thread THREAD_ID --demo` instead.
5. If a dedicated app terminal execution operation is available, use its actual schema to launch the command and retain its app terminal identifier. Otherwise call `mcp__codex_app__open_in_codex` with `target:{type:"terminal"}` and `placement:"bottom"`, then present the prepared command for the user to run. Omit `threadId` to target this chat. Do not substitute an external Terminal window.
6. Verify output with `read_thread_terminal`: the current chat label and voice controls should be visible. An empty shell or `queued` response does not prove the client launched. Report the observed state accurately.

The client starts idle. Tell the user: **S** starts, **X** stops, **M** toggles microphone mute, and **Q** or **Ctrl-C** quits. Mouse buttons work when the terminal forwards SGR mouse reporting. Starting through the UI opens audio and the billable connection. For a requested immediate start, use the dedicated app terminal input operation only after the panel shows the client. A preview uses fixture waves and cost, with no microphone, relay, or billed calls.

## Stop and cleanup

Use the dedicated app terminal input operation, if exposed: `x` stops voice while keeping the UI open; `q` quits and restores terminal modes. `write_stdin` controls only agent execution sessions, not user-started app terminal sessions. Without app terminal input, explain the required key to the user. For an explicitly requested process stop, a verified client PID bound to the exact thread can receive SIGTERM for graceful cleanup. Confirm the resulting stopped state or process exit. Stop leaves already delegated Codex work running. Avoid terminating unrelated relay or app processes.

Launching voice does not authorize sending messages to other chats or people. This skill does not insert the voice transcript into Codex history.
