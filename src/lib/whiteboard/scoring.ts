/**
 * Phase 3 stub — the future voice-pipeline hook. Not wired. Requires a
 * consent flow and provenance decisions first (see docs/audit/
 * platform-state-2026-10-11.md R7/R8 — those gaps are real and unresolved
 * for the main product; this prototype must not quietly create a third).
 *
 * Nothing in Phase 1 calls this. The `spoken` quick-check records locally
 * for playback only (components/whiteboard/SidePanel.tsx) and discards the
 * audio — see §11 of the build brief.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- shape intentionally undefined pending the voice pipeline
export interface SpokenResponseScore {
  // To be defined with the voice pipeline.
}

/* eslint-disable @typescript-eslint/no-unused-vars -- stub signature, not wired yet (see file header) */
export async function scoreSpokenResponse(
  _audio: Blob,
  _ctx: { lessonId: string; stepId: string }
): Promise<SpokenResponseScore | null> {
  return null;
}
/* eslint-enable @typescript-eslint/no-unused-vars */
