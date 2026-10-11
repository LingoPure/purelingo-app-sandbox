/**
 * Shared content-claims rules — the single source of truth for both
 * `check-content-claims.mjs` (the CI guard over marketing/content surfaces)
 * and `src/lib/whiteboard/validate.ts` (the lab-whiteboard content lint).
 *
 * Plain .mjs (no TypeScript) so it loads under both plain `node` (the CI
 * script) and the Next/TS build (via allowJs + resolveJsonModule-style
 * interop) without a build step either side.
 *
 * A human adds to either list, never the model (see the CI script's header).
 */

// Fabricated / unsupported claims + editorial-leak phrases that must never ship.
export const FORBIDDEN_CLAIM_TERMS = [
  "six-dimension",
  "gap score", // the marketing CLAIM; the internal gap_scores table is not scanned
  "cohorts",
  "audit-grade",
  "audit grade",
  "at your own pace",
  "the b2b argument lives here",
  "the b2c argument lives here",
  "landing page · scaffold",
];

// Approved product nouns — the only product terms content may assert.
export const APPROVED_PRODUCT_NOUNS = [
  "LP-18",
  "CEFR",
  "TrackTest",
  "placement report",
  "micro-lesson",
  "live class",
  "ClassIn",
  "communication signals",
  "micro-band",
];
