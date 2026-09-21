-- 0058_backfill_skill_taxonomy_renames.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Six-primary + two-supporting taxonomy migration (ISS-048), step 2 of 3:
-- BACKFILL. Requires 0057 (widen) to have run first — this migration writes
-- new keys that 0057's widened CHECK constraints are what makes legal.
--
-- Locked design (superseding an earlier draft of this file that treated
-- business_vocabulary/presentation_delivery as construct changes and
-- demoted them to is_canonical=false): those two keys are KEPT, UNRENAMED,
-- and untouched by this migration — they remain live as SUPPORTING
-- measures (still scored every discovery call, shown as secondary signals
-- rather than headline bars). Only four keys are pure renames — the same
-- measured construct under a shorter, CEFR-aligned name:
--
--   speaking_fluency        -> speaking
--   listening_comprehension -> listening
--   writing_formal          -> writing
--   reading_intent          -> reading
--
-- grammar and live_interaction are genuinely NEW dimensions — not relabeled
-- from anything. There is no prior data to backfill for them; they start
-- null and the app's existing "not yet assessed" rendering (Phase 1,
-- ISS-047/058/059/060) already handles that correctly, not as a zero.
--
-- Per-table treatment:
--
--   gap_scores — a STUDENT'S MEASURED SCORE. Rename the 4 pure-rename skills
--   in place (id/history preserved). business_vocabulary/presentation_delivery
--   rows are NOT touched — same construct, same key, still canonical.
--
--   role_baselines — an EMPLOYER-SET POLICY THRESHOLD. Rename the SAME 4
--   pure-rename skills in place. business_vocabulary/presentation_delivery
--   baselines are NOT touched (self-setup.ts's SELF_SETUP_SKILLS only ever
--   seeded the 6 primary keys going forward — supporting measures use the
--   flat 800 default, never a role-specific baseline).
--
--   gap_score_history — intentionally UNTOUCHED. It is an append-only audit
--   trail; old rows stay under old keys as historical fact, and only new
--   scoring events after the application code cutover write new-key rows.
--   The old/new key pairs for the 4 pure renames are the same underlying
--   construct and can be charted as one continuous series by the UI layer
--   if desired — that is a display-time concern, not a data concern, and is
--   deliberately not solved here.
--
--   workplace_observations, curriculum_lessons, lesson_completions,
--   tutor_feedback — confirmed 0 rows in the live sandbox at migration time.
--   Nothing to backfill; 0057's widened constraint already covers them
--   going forward.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── gap_scores: 4 pure renames only ────────────────────────────────────────
update public.gap_scores set skill = 'speaking'  where skill = 'speaking_fluency';
update public.gap_scores set skill = 'listening' where skill = 'listening_comprehension';
update public.gap_scores set skill = 'writing'   where skill = 'writing_formal';
update public.gap_scores set skill = 'reading'   where skill = 'reading_intent';

-- ─── role_baselines: same 4 pure renames only ───────────────────────────────
update public.role_baselines set skill = 'speaking'  where skill = 'speaking_fluency';
update public.role_baselines set skill = 'listening' where skill = 'listening_comprehension';
update public.role_baselines set skill = 'writing'   where skill = 'writing_formal';
update public.role_baselines set skill = 'reading'   where skill = 'reading_intent';
