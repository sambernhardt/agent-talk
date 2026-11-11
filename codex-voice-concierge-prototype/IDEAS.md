# Voice companion ideas

Captured November 10, 2026. Exploration notes, not implementation commitments.

## Desktop presence

- Native macOS or Electron app, potentially a small overlay above the desktop.
- Explore a Raycast entry point or integration.
- Continue operating on existing Codex chats for tools and substantial work.

## Idle listening and long tasks

- Separate microphone listening from an active, billable AI voice connection.
- During long Codex tasks, end the AI voice session while keeping local idle listening available.
- Explore short audio snippets and a specific wake phrase or other explicit resume signal to reconnect conversational voice.
- Prefer local speech detection and a bounded, temporary audio buffer; continuous recording and retention are separate design choices.
- Decide whether task completion should reconnect voice automatically, notify the user, or wait for them to resume.
- Reconnection needs a compact conversation summary, pending task state, and new results so the companion can pick up where it left off.
- Optional waiting-room music while work runs; keep it interruptible and avoid microphone feedback.
- Voice can make the wait clearer, but the underlying task still takes time.

## Standalone project

- Move this experiment into its own project under `/Users/sam/Dev`, with its own Git history and branches for alternate approaches.
- Preserve the original direct voice version and the conversational version as distinct experiments.
- Keep existing Codex chat integration when moving; a separate repository does not require a separate work chat.
- Choose the destination and handle the running server's path when performing the move. Completed: both versions now live in `/Users/sam/Dev/talk-to-codex`; see the root `PLAN.md`.
