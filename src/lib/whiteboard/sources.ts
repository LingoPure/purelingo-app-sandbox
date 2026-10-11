/**
 * Approved source registry.
 *
 * The renderer takes `source_embed` excerpt text ONLY from here — the model
 * (Phase 2) only ever supplies a `sourceId`, never excerpt text. Every entry
 * below is seeded as a PLACEHOLDER: `excerpt` is the literal sentinel
 * `__HUMAN_ENTRY_REQUIRED__` and `page`/`url` are left unset. A human pastes
 * the verbatim excerpt (with its page number, and a URL if one is stable)
 * before a lesson that cites it can ship for real — see
 * `src/app/privacy/page.tsx`'s own "template notice" pattern for the same
 * posture: a placeholder that is visibly a placeholder, never a guess.
 *
 * Do not add an entry whose `excerpt` is anything other than the sentinel.
 * Do not add a `page` or `url` you are not certain is correct — omit it and
 * let a human add it alongside the excerpt.
 *
 * Entries beyond the one Phase-1 needs are seeded here because they map
 * onto the six primary + two supporting dimensions this product actually
 * scores (@/lib/scoring/rubric SKILL_KEYS/SUPPORTING_SKILL_KEYS) and will be
 * the first ones any future lesson on those dimensions reaches for.
 */

export type ApprovedSource = {
  id: string;
  title: string;
  publisher: string;
  /** Page/section reference — human-supplied only. Omitted until it is. */
  page?: string;
  /** Verbatim excerpt text. The sentinel below until a human pastes it. */
  excerpt: string;
  url?: string;
};

export const HUMAN_ENTRY_REQUIRED = "__HUMAN_ENTRY_REQUIRED__" as const;

export const APPROVED_SOURCES: readonly ApprovedSource[] = [
  {
    id: "cefr-companion-repair-reformulation",
    title: "Common European Framework of Reference for Languages — Companion Volume",
    publisher: "Council of Europe",
    excerpt: HUMAN_ENTRY_REQUIRED,
    // Needed for: content/lessons/repair-reformulation.json, step 2.
    // Human to supply: the "Interaction strategies — Cooperating / repair"
    // descriptor text, its page number, and a stable URL if one exists.
  },
  {
    id: "cefr-companion-spoken-fluency",
    title: "Common European Framework of Reference for Languages — Companion Volume",
    publisher: "Council of Europe",
    excerpt: HUMAN_ENTRY_REQUIRED,
    // For a future lesson on the "speaking" dimension — spoken fluency descriptors.
  },
  {
    id: "cefr-companion-spoken-interaction",
    title: "Common European Framework of Reference for Languages — Companion Volume",
    publisher: "Council of Europe",
    excerpt: HUMAN_ENTRY_REQUIRED,
    // For a future lesson on "live_interaction" — turn-taking / repair strategies.
  },
  {
    id: "cefr-companion-grammatical-accuracy",
    title: "Common European Framework of Reference for Languages — Companion Volume",
    publisher: "Council of Europe",
    excerpt: HUMAN_ENTRY_REQUIRED,
    // For a future lesson on "grammar" — linguistic range / grammatical accuracy.
  },
  {
    id: "cefr-companion-written-production",
    title: "Common European Framework of Reference for Languages — Companion Volume",
    publisher: "Council of Europe",
    excerpt: HUMAN_ENTRY_REQUIRED,
    // For a future lesson on "writing" — written production / register descriptors.
  },
] as const;

const SOURCES_BY_ID: ReadonlyMap<string, ApprovedSource> = new Map(
  APPROVED_SOURCES.map((s) => [s.id, s])
);

export function getApprovedSource(sourceId: string): ApprovedSource | null {
  return SOURCES_BY_ID.get(sourceId) ?? null;
}

export function isApprovedSourceId(sourceId: string): boolean {
  return SOURCES_BY_ID.has(sourceId);
}

export function isPendingExcerpt(source: ApprovedSource): boolean {
  return source.excerpt === HUMAN_ENTRY_REQUIRED;
}
