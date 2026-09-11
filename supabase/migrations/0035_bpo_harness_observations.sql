-- 0035: BPO Harness — workplace observations + gap_scores source expansion (BH-003).
--
-- The Edge exports structured packets; the cloud persists them here. This is
-- the workplace-analog of evidence_objects but artifact-scoped (evidence_objects
-- is keyed to assessment_sessions and must not be forced to carry workplace
-- observations — separately-regulated shapes stay in separate stores).
--
-- Rules:
--   - workplace_observations is append-only (no UPDATE/DELETE), matching the
--     evidence pool discipline.
--   - Only structured observation data crosses into this table — raw artifact
--     content stays in workplace_artifacts (client-side) and never lands here.
--   - gap_scores.source is extended with 'workplace' (baseline) and
--     'workplace_trained' (post-training) so the existing (student, skill,
--     source) unique key and §12 rollup accept harness data.

-- ─── 1. WORKPLACE OBSERVATIONS (append-only sink) ─────────────────────────────
create table if not exists public.workplace_observations (
  observation_id uuid primary key,
  artifact_id uuid not null references public.workplace_artifacts(artifact_id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  pseudonymous_id text not null,
  construct text not null,
  observation text not null,
  status text not null check (
    status in ('OBSERVED','NOT_OBSERVED','NOT_APPLICABLE','INSUFFICIENT','CONFLICTED','ZERO')
  ),
  authority text not null check (
    authority in ('DIRECT','PARTIAL','DERIVED','INFERRED','TRIANGULATED','UNOBSERVED')
  ),
  confidence numeric not null,
  capability text check (capability in ('LIS','VOC','GRM','SPK','RDG','INT')),
  skill text check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  source jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Query pattern: rollup by employer/pseudonym, ordered chronologically.
create index if not exists workplace_observations_employer_pseudo_time_idx
  on public.workplace_observations (employer_id, pseudonymous_id, created_at);

-- Append-only guard.
create or replace function public.prevent_workplace_observation_mutation() returns trigger as $$
begin
  raise exception 'workplace_observations is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_workplace_observation_append_only on public.workplace_observations;
create trigger trg_workplace_observation_append_only
  before update or delete on public.workplace_observations
  for each row execute function public.prevent_workplace_observation_mutation();

-- RLS: service-role write path (the Edge/cloud exchange is backend-to-backend);
-- learners and managers select through the §12 rollup route.
alter table public.workplace_observations enable row level security;

-- ─── 2. gap_scores: source expansion ──────────────────────────────────────────
alter table public.gap_scores
  drop constraint if exists gap_scores_source_check;
alter table public.gap_scores
  add constraint gap_scores_source_check
  check (source in (
    'discovery',
    'lesson',
    'session',
    'exam',
    'voice_transcript',
    'battery_task',
    'workplace',          -- BPO Harness: baseline workplace analysis (BH-003)
    'workplace_trained'   -- BPO Harness: post-training re-measurement (BH-005)
  ));