# Voice companion plan

## Goal

Make continuous voice conversation useful alongside actual Codex work, preserving the existing Codex chat as the durable place for tasks, tools, approvals, and results.

## Baseline — completed

- Extract both prototypes into this standalone repository with separate directories and lockfiles.
- Preserve the original direct approach: speech transcription, queue to the selected Codex chat, and spoken replies including replies to typed messages.
- Preserve the conversational approach: native Gateway realtime voice, focused task/context/constraints handoffs built from both sides of recent conversation, and observed Codex progress/results relayed back to voice.
- Keep source, tests, run instructions, and exploration notes together; exclude secrets, dependencies, and runtime recordings/logs from Git.
- Start independent Git history with an initial commit. Future experiments can use `codex/` branches.

## Next: measure conversational handoffs

Measure end of speech, delegation signal, helper completion, CLI queue completion, appearance in Codex, first observed progress, result availability, and first spoken result. Report these separately so queue pickup is not confused with speech detection or task duration.

Exercise follow-up references, corrections, explicit constraints, ambiguous requests, typed Codex replies, overlapping requests, and reconnects. Verify that assistant suggestions and previously delegated requests do not create new work without a user request.

## Next: idle voice sessions

Separate local microphone activity from the billable Gateway voice connection. Explore local speech detection or a wake phrase with a bounded temporary audio buffer while Codex works. Define explicit idle and resume states, and decide whether task completion notifies, reconnects voice, or waits for user input.

On resume, provide a compact summary, pending task state, and new results. Preserve clear microphone/connection indicators and an explicit stop control. Treat recording retention as a separate choice; local listening does not require saving continuous audio.

## Active direction: terminal voice

Use `terminal-prototype` as the primary interface, sharing the conversational relay and existing Codex handoff behavior. Focus on terminal audio, transcript streaming, session cost, keyboard controls, and reliable task delivery. Preserve the two browser references.

Retire the Electron app, menu panel, capsule, attached chin, and standalone orb from this branch. The full desktop experiments are preserved in checkpoint commit `5c96c9f` on `main`.

## Explore: waiting experience

Try optional interruptible waiting-room music and concise progress updates grounded in observed work. These communicate waiting; they do not reduce the underlying task duration. Prevent playback from triggering microphone input.

## Completion checks for future changes

Run the relevant unit tests and syntax checks. Use the simulated Codex smoke flow for voice protocol changes, and a human conversation for microphone, interruption, and perceived latency. Keep approvals in Codex, avoid duplicate submissions, and verify reconnection behavior before relying on unattended long tasks.
