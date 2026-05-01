-- 0011_rescale_scores_to_1000.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Rescale all sub-skill scores from 0–100 to 0–1000.
--
-- Why: a 100-point scale collapses meaningful differences ("you went from 67
-- to 71" reads as noise). The 1000-point scale lets the dashboard say "you
-- closed 30 points on a 300-point gap" — the headline number tracks the
-- buyer's mental model directly. CEFR bands map at the same boundaries
-- shifted by ×10 (B2 = 600–799, C1 = 800–899, etc.).
--
-- Order matters here:
--   1. Drop the old 0..100 CHECK constraints so the multiply doesn't
--      violate them mid-flight.
--   2. Multiply existing data ×10 — guarded by a table-comment sentinel
--      so re-applying this migration is a no-op.
--   3. Add the new 0..1000 CHECK constraints.
--   4. Update the default for gap_scores.target (80 → 800).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Drop old CHECK constraints ──────────────────────────────────────────
alter table public.gap_scores
  drop constraint if exists gap_scores_score_check;
alter table public.gap_scores
  drop constraint if exists gap_scores_target_check;
alter table public.role_baselines
  drop constraint if exists role_baselines_min_score_check;

-- ─── 2. Multiply existing data ──────────────────────────────────────────────
do $$
declare
  already_rescaled boolean;
begin
  select coalesce(
    (
      select obj_description('public.gap_scores'::regclass, 'pg_class')
        like '%score-scale:1000%'
    ),
    false
  )
  into already_rescaled;

  if not already_rescaled then
    update public.gap_scores set score = score * 10 where score is not null;
    update public.gap_scores set target = target * 10 where target is not null;
    update public.role_baselines set min_score = min_score * 10;
    update public.certifications
       set result_json = jsonb_set(
             result_json,
             '{overall_score}',
             to_jsonb((result_json->>'overall_score')::int * 10)
           )
     where result_json ? 'overall_score';

    -- Sentinel — re-running this migration after rescale is a no-op.
    comment on table public.gap_scores is
      'Sub-skill scores. score-scale:1000 — 0..1000 since migration 0011.';
  end if;
end
$$;

-- ─── 3. Add new CHECK constraints (0..1000) ─────────────────────────────────
alter table public.gap_scores
  add constraint gap_scores_score_check
  check (score is null or score between 0 and 1000);

alter table public.gap_scores
  add constraint gap_scores_target_check
  check (target is null or target between 0 and 1000);

alter table public.role_baselines
  add constraint role_baselines_min_score_check
  check (min_score between 0 and 1000);

-- ─── 4. New default for gap_scores.target ───────────────────────────────────
alter table public.gap_scores
  alter column target set default 800;
