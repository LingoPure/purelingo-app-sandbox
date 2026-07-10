/**
 * Content layer types — the spine of the marketing canvas.
 *
 * Every user-facing string on the marketing site is described by a
 * ContentBlock, NOT hardcoded in a component. A block's `data` carries
 * i18n *keys* (resolved through `t()` from src/lib/i18n), never raw
 * English — so the page stays bilingual (EN/VI + fallbacks) and copy
 * edits happen in the dictionary, not in markup.
 *
 * The `status` field drives the annotation layer:
 *   - 'ready'   — final copy, shippable.
 *   - 'confirm' — placeholder copy exists but must be validated.
 *   - 'pending' — deliberately empty; the real copy must come from
 *                 customer research. Renders a visible empty slot in
 *                 canvas mode and NOTHING in production. `data` is null.
 *
 * Guessing at pending copy to "make the page look finished" is the one
 * thing this architecture exists to prevent. An empty slot is
 * information; invented copy is noise that ships because it looks
 * plausible.
 */

export type BlockStatus = "ready" | "confirm" | "pending";

export interface Annotation {
  /** Short uppercase label, e.g. "EVIDENCE PENDING". */
  label: string;
  /** Why this block is in this state, and what unblocks it. */
  note: string;
}

export interface ContentBlock<T = unknown> {
  id: string;
  status: BlockStatus;
  annotation?: Annotation;
  /** Null when status === 'pending' and nothing shippable exists yet. */
  data: T | null;
}

/** Narrowing helper: a block is renderable when it has data to show. */
export function hasData<T>(
  block: ContentBlock<T>
): block is ContentBlock<T> & { data: T } {
  return block.data != null;
}
