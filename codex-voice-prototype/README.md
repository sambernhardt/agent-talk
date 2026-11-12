# Codex voice companion proof of concept

Continuous conversation with an existing Codex desktop chat. GPT-Live transcribes speech through Vercel AI Gateway; dedicated TTS reads the exact Codex answer. Spoken requests use `codex queue --thread … --message …`; the desktop handles the work with its normal provider, tools and approvals. A separate app-server only reads history to find replies. No chat copy or writer takeover.

## Run

Requires Node 24+, Codex CLI with `queue` support (tested with 0.167.0), and `AI_GATEWAY_API_KEY` in the server environment.

```sh
cd codex-voice-prototype
npm install
npm start
```

Open http://127.0.0.1:4318 in Chrome, select your chat and enter voice mode. Speak normally; no push-to-talk. Keep Codex desktop running. End voice mode closes microphone capture and the billable Gateway session. Codex work already queued continues. Manage approvals and stop work in Codex itself.

## Behavior and limits

- Pins the selected chat; does not follow the focused desktop chat.
- Queued requests wait for the current turn; they do not steer it mid-turn.
- Polls the latest 50 turns every 1.5 seconds while awaiting replies. Watches all new final replies in the selected chat, including replies to typed input. Existing reply items form the initial baseline; reply IDs prevent duplicate playback. Spoken requests are also matched by transcript for timing. An identical manually typed request arriving at the same time could be ambiguous.
- Reads completed final replies only, without streaming tool progress. An interrupted status without a completion timestamp or error is treated as still running, since independent history readers report desktop-owned work this way. Reconnect watches the latest unfinished turn; queued inputs not yet started remain in Codex.
- Full retrieved answers are read through `openai/tts-1`, in chunks for long replies. Live-model conversation audio is discarded.
- Every transcribed utterance is forwarded after a 1.6-second pause, even when GPT-Live does not delegate. Model delegation can forward it sooner. Only dedicated TTS of the Codex result is played; live-model conversation audio is discarded.
- Continuous 24 kHz PCM audio uses `openai/gpt-live-1`. Silence during an open session is billable. Headphones help prevent echo. The user has verified human microphone input and audible replies; interruption quality remains experimental.
- Localhost only, browser origin checks, per-launch token; Gateway credential stays on the server.

## Validation

`node --test replies.test.mjs` checks matching, old-message exclusion, completion gating and distinct repeated requests. `npm run check` checks server syntax.

Verified: queue delivery into the actual desktop chat (user confirmed); independent read-only history on that desktop-owned chat; actual-chat Gateway voice startup; prior synthetic Gateway speech → independent Codex → speech loop. `smoke.mjs` exercises that independent audio path, not desktop queue integration. A synthetic real-Gateway test also passed speech → intercepted queue command → matching stubbed Codex reply → exact-text TTS audio. The user confirmed full human voice → actual desktop reply → audible browser playback. A simulated typed-chat reply with no voice request also produced real Gateway TTS audio.

References: https://learn.chatgpt.com/docs/cli/reference#codex-queue · https://learn.chatgpt.com/docs/app-server · https://vercel.com/docs/ai-gateway/modalities/realtime/gpt-live

Speech forwarding regression: `node --test speech-input.test.mjs replies.test.mjs`. A 1.6-second pause forwards input even with no model delegation; duplicate delegation cannot resend the same fragments.

TTS reference: https://vercel.com/docs/ai-gateway/getting-started/speech

## Latency experiments

Expand **Latency test settings** before entering voice. Reply checks can run every 1500ms (baseline) or 250ms. Speech can generate the full answer first (baseline) or start with the first sentence, then generate the rest in chunks. These options are independent for comparisons. Both currently wait for Codex to finish answering; this is not streaming from a generating Codex turn.

The timing trace measures forwarding, queue invocation and acceptance, first appearance in Codex history, completed reply detection, speech generation, and browser playback start. The starting time is an estimate from microphone amplitude (threshold 0.02 RMS); background noise can skew it. Codex timestamps have one-second precision. Observed history events also include polling delay. A session attached mid-turn is labeled and is not a complete speech-to-reply sample.

Measurements are saved locally in ignored `timings.jsonl` and exposed at the authenticated `/api/timings` endpoint. Records contain stage timings, random correlation IDs, and experiment settings, without message text or audio. Compare the same short request across settings; change one option at a time. `node --test *.test.mjs` checks reply tracking, forwarding and lossless speech chunking.

While voice mode is active, typed input in Codex also gets read aloud. Replies already present when voice connects are skipped. Unfinished turns can finish and be read after connection. Reading replies does not submit any additional message.
