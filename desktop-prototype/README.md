# Codex Voice desktop lab

**Experimental UI prototypes**, using the existing conversational voice relay and Vite frontend.
The question: does this work best as a menu bar panel, a floating capsule, or a bottom bar attached to Codex?

## Run

Requires macOS, Node 24+, the Xcode command-line tools (`swiftc`), Codex CLI with `queue`
support and a signed-in Codex installation. Supply your own `AI_GATEWAY_API_KEY` in the
launching Terminal environment. The key is never included in the app bundle.

```sh
cd /Users/sam/Dev/talk-to-codex
npm --prefix codex-voice-concierge-prototype ci
cd desktop-prototype
npm ci
npx install-electron
npm start
```

Electron's current npm package downloads its native runtime with `install-electron`.
`npm start` builds Vite and the tiny Swift window-metadata helper, then launches Electron.
The app owns its own relay on **127.0.0.1:4330**; it doesn't restart either browser prototype.
Quit the desktop app to stop its relay and any active voice connection.

## Three presentations

- **Panel:** click the waveform menu bar icon for a compact chat/transcript panel. Pinned open
  by default; the tray's right-click menu can make it dismiss when focus moves away.
- **Capsule:** a small draggable control strip above the bottom of the display. Transcript
  stays available by switching back to Panel; changing presentations doesn't reload the page.
- **Codex:** a contrasting 64px chin below Codex, with a transparent 16px overlap that fits
  around its rounded bottom corners. It matches Codex's full width and
  following movement and resizing. It never covers Codex content. If there is not enough
  room underneath, it hides until you move or shorten Codex to leave 64px of space. The
  menu bar icon remains available to switch modes. Uses
  window bounds only; no window contents, screenshots, synthetic typing, or Accessibility
  permissions. Full-screen Spaces and window metadata restrictions can limit attachment.

Switch from the gear menu in the title strip or the tray's right-click menu.
**⌘⇧Space** shows/hides the companion. Drag the title strip to move the floating window.
Hiding keeps voice running; **Stop** ends voice. The tray tooltip indicates an active microphone.
The app asks for microphone access only when you choose Play.

Attachment targets the app's visible window; **chat selection remains explicit**. It does not
infer which Codex chat is focused. When another app takes focus the bar hides; selecting
Codex again brings it back. If no Codex window is visible, the bar shows a waiting message.
The existing Codex thread remains the actual work owner.

## Browser previews

For layout-only exploration:

```sh
npm --prefix ../codex-voice-concierge-prototype run dev
```

Open http://127.0.0.1:4320/?variant=panel (or `capsule`, `attached`). The development preview
has a floating previous/next switcher and left/right keyboard shortcuts. The native window
behavior requires Electron. Without a variant query, the ordinary browser UI stays intact.

## Build a local .app

```sh
npm run package
```

Writes `out/Codex Voice Prototype-darwin-<arch>/Codex Voice Prototype.app` for the current Mac's
architecture. The package includes only an explicit relay file list, Vite assets, `ws`, and
the compiled helper. Credentials, diagnostics, recordings, and Git files are excluded.
This is an unsigned local prototype, not a notarized team release. To launch with your
Terminal environment (including the Gateway key), execute the app's `Contents/MacOS/Codex Voice Prototype`
binary from Terminal. A signed release would need credential setup and distribution work.

Desktop session history lives in Electron's local browser storage (separate from Chrome);
voice diagnostics go in the app's macOS Application Support directory. Transcripts are in
memory. Neither history nor mode choice is synced to teammates.

## Launch from the original Codex chat

The repo-local `$codex-voice` skill is in `.agents/skills/codex-voice`. Invoke it in
this repository's original chat to start voice there, or ask it to show, stop, or
inspect the Mac companion. It uses the actual current thread ID, never the most
recent chat. No global skill installation is needed.

```sh
node desktop-prototype/launch.mjs --help
node desktop-prototype/launch.mjs show --thread-id "$CODEX_THREAD_ID"
node desktop-prototype/launch.mjs start --thread-id "$CODEX_THREAD_ID"
node desktop-prototype/launch.mjs status
node desktop-prototype/launch.mjs stop
```

Run these from the repository root. `show` binds and displays the attached chin
without opening the microphone. `start` explicitly starts voice and waits for the
renderer to confirm the requested thread is active. `stop` waits for idle; hiding
is separate from stopping. Stop/status never launch an absent app. A new launch
builds the frontend and native helpers; an existing app is reused without a build.
Keep the launching environment's Gateway credentials available. OS launch or
microphone permission may still require user interaction.

Control uses a per-repo Unix socket in the OS temporary directory, inside a mode
0700 directory with a mode 0600 socket. One JSON line carries
`{action:"show"|"start"|"stop"|"status",threadId?}`; replies contain `ok` and
voice state, or `ok:false,error`. The Electron single-instance owner removes stale
socket endpoints. The local socket does not touch the relay's HTTP protocol.
Packaged and development checkouts have separate control endpoints.

Main sends `voice:command` with `{id,action:"show"|"start"|"stop",threadId?}` after preload
`onCommand(callback)` registers. Renderer reports through `update` with
`{active,phase:"idle"|"starting"|"active"|"stopping",threadId,error?}`. Main merges
partial updates and serializes commands; stop supersedes a pending start; errors and 20-second missing-confirmation
timeouts fail visibly. Inspect status after a timeout before retrying. For show,
`mode()` and `onChange` also expose the bound `threadId` without starting audio.
The show command validates and binds the renderer picker without audio. Thread binding is logical; window attachment follows the visible Codex window and
does not infer which chat that window displays.

`npm --prefix desktop-prototype test` exercises parsing, thread binding, command
completion, errors, and private socket transport without GUI, audio, or billable
connections.

If an older app is already running without control support, stop voice and quit it
explicitly before retrying the launcher. The launcher never kills that instance.
