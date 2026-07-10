/**
 * Content-layer status vocabulary, shared by the marketing content
 * (src/content/home.ts) and the canvas annotation primitives.
 *
 *   - 'ready'   — final copy, ships now.
 *   - 'confirm' — placeholder copy exists but must be validated before launch.
 *   - 'pending' — draft shown for review, but the real copy must come from
 *                 customer research (the annotation says which question).
 */
export type BlockStatus = "ready" | "confirm" | "pending";

export interface Annotation {
  /** Short label, e.g. "Evidence pending". */
  label: string;
  /** Why this block is in this state, and what unblocks it. */
  note: string;
}
