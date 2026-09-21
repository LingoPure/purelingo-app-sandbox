-- 0057_widen_skill_taxonomy.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Six-dimension taxonomy migration (ISS-048), step 1 of 3: WIDEN.
--
-- Sandbox testing (Daniel Maneveld's review, 2026-09-20) found the live six
-- skill keys don't match the product's own reference framework:
--
--   old key                    -> new key           nature
--   speaking_fluency           -> speaking           pure rename
--   listening_comprehension    -> listening          pure rename
--   writing_formal             -> writing            pure rename
--   reading_intent             -> reading            pure rename
--   business_vocabulary        -> grammar            CONSTRUCT CHANGE
--   presentation_delivery      -> live_interaction   CONSTRUCT CHANGE
--
-- This migration ONLY widens every skill CHECK constraint to accept BOTH the
-- old and new keys simultaneously. It changes no data and no application
-- behaviour — existing rows and existing (not-yet-deployed) code keep working
-- unchanged. This is deliberately separate from the data backfill (next
-- migration) and the code cutover (application deploy) so each step can be
-- verified independently, per the additive-then-cutover-then-narrow approach
-- (see the build plan / docs/ISSUES_TRACKER.md Phase 9, ISS-048).
--
-- The old-key CHECK support is dropped only once a live query against every
-- one of the 7 tables below confirms zero rows remain under old keys — a
-- separate, later "narrow" migration. Do not narrow until that's confirmed.
--
-- Constraint discovery: rather than hardcode a guessed constraint name (the
-- CREATE TABLE statements for these columns never named the check
-- constraint explicitly, so the actual name is whatever Postgres assigned at
-- creation time), this migration finds the existing check constraint on each
-- table's `skill` column by inspecting pg_constraint directly and drops it by
-- its real name. The replacement is explicitly named `<table>_skill_check`
-- so the later narrow migration can find it deterministically.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  tbl text;
  tbls text[] := array[
    'public.gap_scores',
    'public.role_baselines',
    'public.gap_score_history',
    'public.workplace_observations',
    'public.curriculum_lessons',
    'public.lesson_completions',
    'public.tutor_feedback'
  ];
  r record;
  new_name text;
begin
  foreach tbl in array tbls loop
    -- Drop whatever check constraint currently governs this table's `skill`
    -- column, regardless of its actual name.
    for r in
      select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any(c.conkey)
      where c.contype = 'c'
        and c.conrelid = tbl::regclass
        and a.attname = 'skill'
    loop
      execute format('alter table %s drop constraint %I', tbl, r.conname);
    end loop;

    -- Re-add, explicitly named, permitting BOTH old and new keys. `skill is
    -- null or skill in (...)` is safe whether the column is NOT NULL
    -- (gap_scores, role_baselines, gap_score_history, curriculum_lessons,
    -- lesson_completions, tutor_feedback) or nullable (workplace_observations)
    -- — a NOT NULL column simply never satisfies the null branch.
    new_name := replace(tbl, 'public.', '') || '_skill_check';
    execute format(
      'alter table %s add constraint %I check (skill is null or skill in ('
      || $q$'speaking_fluency','listening_comprehension','writing_formal',$q$
      || $q$'reading_intent','business_vocabulary','presentation_delivery',$q$
      || $q$'speaking','listening','writing','reading','grammar','live_interaction'$q$
      || '))',
      tbl,
      new_name
    );
  end loop;
end
$$;
