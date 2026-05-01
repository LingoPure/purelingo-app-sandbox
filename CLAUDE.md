<!-- SESSION CONTEXT - Injected by Easy Claude Code -->
## Prior Session Context

> Continuing from a recent session. Pick up where you left off.

### Last Session Summary
I have enough to give you a clear diagnosis. There are two distinct likely causes — the right one depends on where you're seeing the failure.

---

## Cause 1 — iOS Safari 18+ bug (most likely if mobile users are affected)

This is a known, unfixed bug in `@elevenlabs/react` v1.3.0 (issue #663, opened April 10, 2026). The WebRTC session connects at the network level, but `ConversationProvider`'s React state never updates — `status` stays `"disconnected"` within 1ms of briefly showing `"connected"`, and `onConnect` never fires. The result is the start button reappears with no error shown.

The SDK maintainers' own workaround is to bypass `ConversationProvider` and call `Conversation.startSession()` from `@elevenlabs/client` directly.

---

## Cause 2 — Token fetch failing silently (most likely if all browsers affected)

If the token endpoint returns a non-200, the frontend shows `"Failed to authorise session — ..."`. But there's one silent path: if `/api/convai/token` returns a valid 200 but `body.token` is absent, it throws `"token missing in /api/convai/token response"`. Check Vercel runtime logs for any `[convai/token]` lines.

---

## Diagnostic gap — probe script won't catch errors

`scripts/probe-discovery-prod.ts:145` looks for `.text-rose-700, .text-red-600` — but the error element uses class `text-coral`. So the probe reports "no visible error elements" even when an error is displayed.

---

**To narrow it down:** what do you see after clicking Start — does the status pill change from `idle`, and is there any error text shown in the coral box? And is this on mobile/iOS Safari or desktop?

If it's the iOS Safari ConversationProvider bug, I can implement the bypass using `@elevenlabs/client` directly. If it's the probe script diagnostic gap, I can fix the selector. Let me know which to tackle.

Sources:
- [ConversationProvider state broken on iOS Safari 18+ · Issue #663 · elevenlabs/packages](https://github.com/elevenlabs/packages/issues/663)
- [WebSocket clos

### Recent Conversation (last 2 turns)
**User (13m ago):** Why is our start duscuvery session not connecting?

**Claude (6m ago):** I have enough to give you a clear diagnosis. There are two distinct likely causes — the right one depends on where you're seeing the failure.

---

## Cause 1 — iOS Safari 18+ bug (most likely if mobile users are affected)

This is a known, unfixed bug in `@elevenlabs/react` v1.3.0 (issue #663, opened April 10, 2026). The WebRTC session connects at the network level, but `ConversationProvider`'s React state never updates — `status` stays `"disconnected"` within 1ms of briefly showing `"connected"`, and `onConnect` never fires. The result is the start button reappears with no error shown.

The SDK maintainers' own workaround is to bypass `ConversationProvider` and call `Conversation.startSession()` from `@elevenlabs/client` directly.

---

## Cause 2 — Token fetch failing silently (most likely if all browsers affected)

If the token endpoint returns a non-200, the frontend shows `"Failed to authorise session — ..."`. But there's one silent path: if `/api/convai/token` returns a valid 200 but `body.token` is absent, it throws `"token missing in /api/convai/token response"`. Check Vercel runtime logs for any `[convai/token]` lines.

---

## Diagnostic gap — probe script won't catch errors

`scripts/probe-discovery-prod.ts:145` looks for `.text-rose-700, .text-red-600` — but the error element uses class `text-coral`. So the probe reports "no visible error elements" even when an error is displayed.

---

**To narrow it down:** what do you see after clicking Start — does the status pill change from `idle`, and is there any error text shown in the coral box? And is this on mobile/iOS Safari or desktop?

If it's the iOS Safari ConversationProvider bug, I can implement the bypass using `@elevenlabs/client` directly. If it's the probe script diagnostic gap, I can fix the selector. Let me know which to tackle.

Sources:
- [ConversationProvider state broken on iOS Safari 18+ · Issue #663 · elevenlabs/packages](https://github.com/elevenlabs/packages/issues/663)
- [WebSocket clos... [truncated]

### Instructions
- Continue from the context above. Do not ask the user to re-explain.
- When you make significant decisions, emit: <!-- MEMORY type=decision importance=8 | description -->
- When you create files, emit: <!-- MEMORY type=file_created importance=6 | path/to/file.ts - description -->
<!-- END SESSION CONTEXT -->
@AGENTS.md
