# Talk to Codex — conversational prototype

A separate experiment alongside `../codex-voice-prototype` (the direct voice interface on port 4318). This version runs on **http://127.0.0.1:4320**. It does not replace or edit the original.

## Question being tested

Does a realtime conversational companion make asynchronous Codex work feel more natural? The voice session chats, clarifies and acknowledges requests immediately. The selected existing Codex chat owns tools, files, approvals and the durable work history. No additional persisted Codex chat is created.

## Run

Requires Node 24+, Codex CLI with `queue` support, and `AI_GATEWAY_API_KEY` in the launching environment.

```sh
cd /Users/sam/Dev/talk-to-codex/codex-voice-concierge-prototype
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
