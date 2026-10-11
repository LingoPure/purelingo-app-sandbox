-- 0061_gap_scores_provenance.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Score provenance (R6 gap, closed).
--
-- gap_scores/gap_score_history previously recorded WHICH pipeline wrote a
-- row (`source`) but never WHICH model, prompt version, or rubric version
-- produced it. A score from today was indistinguishable from one from three
-- months ago under a different model or rubric — not auditable, and not
-- recalibratable once the LP-18/LP-1000 mapping logic (0061-era rubric.ts)
-- is itself revised again later.
--
-- All three columns are nullable and purely additive — existing rows are
-- untouched (their provenance is genuinely unknown, which is the honest
-- state, not backfilled with a guess).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.gap_scores
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists rubric_version text;

alter table public.gap_score_history
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists rubric_version text;

comment on column public.gap_scores.model is
  'Model that produced this score, e.g. "claude-sonnet-4-6" or "deterministic:battery:v1". Null for rows written before 0061.';
comment on column public.gap_scores.prompt_version is
  'Version tag of the scoring prompt (discovery SYSTEM_PROMPT / session SESSION_SYSTEM_PROMPT / battery task prompt) that produced this score.';
comment on column public.gap_scores.rubric_version is
  'Version of the rubric.ts band-mapping logic (RUBRIC_VERSION) in effect when this score was written — lets a future mapping change be distinguished from a measurement change.';
