# agent-talk — conversational prototype

A separate experiment alongside `../codex-voice-prototype` (the direct voice interface on port 4318). This version runs on **http://127.0.0.1:4320**. It does not replace or edit the original.

## Question being tested

Does a realtime conversational companion make asynchronous Codex work feel more natural? The voice session chats, clarifies and acknowledges requests immediately. The selected existing Codex chat owns tools, files, approvals and the durable work history. No additional persisted Codex chat is created.

## Run

Requires Node 24+, Codex CLI with `queue` support, and `AI_GATEWAY_API_KEY` in the launching environment.

```sh
cd codex-voice-concierge-prototype
npm install
npm start
```

Choose the existing work chat and enter voice mode. Talk conversationally, or explicitly say “Ask Codex to …” to request work. Use headphones. End voice mode to stop recording and close the billable realtime session. Previously queued Codex work continues.

## Architecture and limits

- Native GPT-Live through Gateway handles realtime audio in and out; this version does not use dedicated TTS or forward every utterance automatically.
- Client delegation triggers a small Gateway text-model call that builds a focused task, relevant context, and user constraints from recent speech from both sides and selected-chat context. Only new user requests authorize work. The structured message is sent through `codex queue`; raw transcripts are not appended. Ambiguous requests prompt clarification, and preparation failures send nothing.
- Handoff context is bounded to 40 conversation segments and about 20,000 characters. Previously delegated requests are tracked to avoid repeating them. The helper defaults to `openai/gpt-4.1-mini` (override with `CODEX_HANDOFF_MODEL`); each handoff adds a billable text-model call and its latency.
- The relay reads existing history without acquiring a writer lock. It tracks queued requests, detects their start, supplies observed commentary/progress and relays final results to the voice model for friendly explanation. New replies to typed Codex messages are also supplied.
- Conversation stays live during queue pickup and tool work. Queueing does not mean work started, and this version does not remove the observed desktop pickup delay.
- Voice cannot approve or cancel work. Handle approvals and cancellation in Codex. A follow-up is another queued request, not a mid-turn interruption.
- Native voice interruption remains experimental. The voice model chooses whether and when to delegate. Its words are conversational, rather than a verbatim read of the Codex result.
- Recent selected-chat context is provided on connection; only newly observed progress/results are relayed. Context and long results use bounded excerpts. The main chat remains the source of the complete record.
- Reconnection does not reconstruct pending delegation IDs, but still observes new final replies. Voice conversation and request state live in memory.
- Localhost only, random launch token, browser-origin checks; Gateway key stays on the server. Both realtime silence and audio are billable while connected. Running both apps in voice mode would capture the same microphone twice; end one before trying the other.

## Smoke check

`node smoke.mjs /path/to/24khz-mono-pcm16.pcm` tests real Gateway speech with a **simulated** Codex queue/history. It never submits a chat message. The sample should say “Please ask Codex what two plus two is.” It checks delegation, acknowledgment while pending, observed progress, and spoken result. It consumes Gateway credits.

Protocol references: https://vercel.com/docs/ai-gateway/modalities/realtime/gpt-live · https://learn.chatgpt.com/docs/cli/reference#codex-queue

Verified: isolated Gateway smoke passed one delegated request, acknowledgment while pending, observed progress, and 235,200 bytes of spoken result audio. A stricter, concise delegation instruction was required after an initial run only offered to relay. The work backend was simulated for this check; human testing with actual Codex remains.

## Session usage display

The live counter shows elapsed time and an estimated voice cost at the published GPT-Live rate of $3/hour, verified November 10, 2026. Gateway cumulative usage snapshots update the estimate; the final provider duration determines the ended session total when available. A disconnect without final usage is marked approximate. Handoff-model calls and Codex work are excluded. See [Gateway pricing and usage](https://vercel.com/docs/ai-gateway/modalities/realtime/gpt-live).

A ten-second on-screen summary appears when voice closes. The bottom history keeps the latest 100 completed sessions in this browser's local storage, across page reloads. It stores timestamps, durations, and estimated costs, not transcripts or audio. Browser storage restrictions may prevent persistence. The Gateway invoice remains the billing source of truth.

Cost is displayed visually, with no automatic spoken announcements or checkbox. Ask the voice companion “What has this session cost?” to delegate a read-only question to the selected Codex chat. Every handoff carries a timestamped session snapshot (voice cost estimate, rate, elapsed time, provider usage if available, selected chat, and queued/working request IDs). This application data is appended directly rather than rewritten by the handoff model.

Codex can query `GET /api/session` for fresher data using the same local Bearer token as `/api/threads`. Retrieve that token from the local UI HTML and use it only locally; do not print or queue it. The endpoint uses the existing Host check and authentication and returns no transcripts or audio. Costs continue accumulating while a request waits for Codex, so answers should identify their sample time. Without an active session the endpoint returns an empty sessions array.

## Diagnosing missed handoffs

The authenticated `/api/session` response includes a bounded timeline of the latest 40 handoff stages: delegation received, preparation started/finished (including `delegate`, `clarify`, or `none`), history baseline read, queue started/confirmed, work observed in Codex, and result observed. It records timestamps/IDs/statuses, not transcript text or credentials. The last input-transcript timestamp helps distinguish incoming speech from an actual delegation event. Diagnostic history is not appended to model handoffs.

A confirmed queue submission is distinct from desktop pickup. Handoff preparation has a 15-second deadline; history RPCs have a 30-second deadline. The CLI queue currently has no deadline, so `queue-started` without confirmation can indicate a hung queue process; do not blindly retry because submission may already have happened. Missing delegation events still depend on the realtime model: a spoken promise to ask Codex is not proof of dispatch.

Fixed regression: a leftover speech-threshold guard dropped quiet audio before Gateway received it, interfering with turn-end detection. `audio-relay.test.mjs` executes the actual browser-message handler and verifies that speech and subsequent quiet frames all reach Gateway.

## Failure visibility from the main Codex chat

Handoff stages and failures are asynchronously persisted to `handoff-diagnostics.jsonl` beside `server.mjs`, independent of `codex queue`. The file rotates at 1 MiB, keeping one backup (`.jsonl.1`); both are ignored by Git. Records include chat/session/delegation/job IDs, timestamp, failed phase, process exit code or signal, Gateway HTTP status when available, and a debugging hint. Transcripts, queued messages, raw stderr, audio, and credentials are excluded.

Codex can read these files directly even if voice or the server has stopped. While the app is running, authenticated `GET /api/diagnostics?threadId=<chat-id>` returns the latest 200 matching records plus active session snapshots and a persistence-error flag. It uses the same local token as `/api/session` and remains available if the Codex history reader is unavailable. The next successful handoff also includes the active session's latest three failures as context. No synthetic chat messages are queued for error reporting. A currently idle Codex chat is not automatically awakened by file writes; ask it to inspect diagnostics, or it sees failure context on the next successful handoff.

Look for `handoff-error.phase`: `preparation` means the text-model request/validation failed before queueing; `baseline-read` means history could not be read before submission; `queue` includes subprocess exit/signal details and requires checking the actual chat before retrying. `queue-confirmed` without `codex-observed` means the CLI succeeded but desktop pickup has not yet been observed. `start-error` captures startup failures. Errors from runtime voice connections are recorded without provider message text. Previously lost failures cannot be reconstructed from these new logs.

## Frontend (Vite + React)

Run `npm run dev` for the Vite frontend with React Fast Refresh and CSS hot updates,
served through the existing local relay at http://127.0.0.1:4320. Vite's HMR socket
uses `/vite-hmr`; voice uses `/voice`. The Gateway key stays in the relay environment.
Run `npm start` to build with Vite and serve the production `dist/` assets from the
same relay. `npm run build`, `npm run check`, and `npm test` build, type-check,
and run local regression tests. Built assets are ignored by Git.

The chat selector uses shadcn Command + Popover (cmdk/Radix). Its hidden native select
retains the existing session-switching bridge. The static page shell and audio/session
controller are bundled by Vite; audio capture, playback, and queue delivery remain
independent of React renders. The streaming transcript is a React root using the official
AI Elements Conversation, Message, and MessageResponse components, adapted locally;
see `frontend/ai-elements/README.md` for source and license. Streamdown renders partial
Markdown. `use-stick-to-bottom` follows new content and lets users scroll back, with
a button to return to the latest message. Transcript updates are batched once per
animation frame, completed rows are memoized, and the Markdown renderer is loaded
separately from voice startup. Transcript content stays in browser memory.

Theme colors follow system light/dark preferences. Pause tooltips are centered above
the button with 13px text and 5px/8px padding. Session summary toasts float independently
of the footer so they do not shift the control card.
