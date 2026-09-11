-- 0033: LingoPure 2K — closed-loop persistence (ISS-036/ISS-037).
-- Freezes canonical results, captures teacher outcomes, and stores all evidence
-- (raw, adjudicated, and outcome-derived) as one append-only pool so the
-- outcome can be fed back as new evidence (G10) without rewriting history.
--
-- Rules:
--   - canonical_results and evidence_objects are append-only (no UPDATE/DELETE).
--   - lesson_outcomes are append-only with an idempotency key (outcome_id is
--     client-generated: re-posting the same outcome is a no-op, logging only).
--   - result_id links teacher outcomes back to the frozen result.

-- ─── 1. FROZEN CANONICAL RESULTS (C18 / G7) ─────────────────────────────────
create table if not exists public.canonical_results (
  result_id uuid primary key,                       -- frozen in the 2K layer
  assessment_id uuid not null references public.assessment_sessions(assessment_id) on delete cascade,
  learner_id uuid not null,
  result_jsonb jsonb not null,                      -- full frozen CanonicalAssessmentResult
  frozen_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- result_id is immutable — re-freezing an assessment creates a new row.
create unique index if not exists canonical_results_assessment_uq
  on public.canonical_results (assessment_id);

-- ─── 2. TEACHER OUTCOMES (C21 / G9＋G10) ─────────────────────────────────────
create table if not exists public.lesson_outcomes (
  outcome_id uuid primary key,                      -- client-generated idempotency key
  learner_id uuid not null,
  result_id uuid not null references public.canonical_results(result_id) on delete cascade,
  intervention_id text,
  teacher_action text not null,
  exposure text not null,
  learner_response text not null,
  teacher_observation text not null,
  artifacts jsonb not null default '[]',
  confounds text not null default 'LOW' check (
    confounds in ('NONE','LOW','MEDIUM','HIGH','CRITICAL')
  ),
  confound_notes jsonb not null default '[]',
  outcome_status text not null check (
    outcome_status in ('positive','neutral','negative','inconclusive')
  ),
  next_action text,
  created_at timestamptz not null default now()
);

-- ─── 3. EVIDENCE POOL (C08 input pool / G3) ──────────────────────────────────
create table if not exists public.evidence_objects (
  evidence_id uuid primary key,                     -- immutable
  assessment_id uuid not null references public.assessment_sessions(assessment_id) on delete cascade,
  result_id uuid references public.canonical_results(result_id) on delete cascade,
  construct text not null,
  observation text not null,
  status text not null check (
    status in ('OBSERVED','NOT_OBSERVED','NOT_APPLICABLE','INSUFFICIENT','CONFLICTED','ZERO')
  ),
  authority text not null check (
    authority in ('DIRECT','PARTIAL','DERIVED','INFERRED','TRIANGULATED','UNOBSERVED')
  ),
  source jsonb not null default '{}',
  provenance jsonb not null default '{}',
  confidence numeric not null,
  created_at timestamptz not null default now()
);

-- append-only via RLS (no update/delete policies) + trigger guard.
create or replace function public.prevent_evidence_mutation() returns trigger as $$
begin
  raise exception 'evidence_objects is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_evidence_append_only on public.evidence_objects;
create trigger trg_evidence_append_only
  before update or delete on public.evidence_objects
  for each row execute function public.prevent_evidence_mutation();

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────
alter table public.canonical_results enable row level security;
alter table public.lesson_outcomes enable row level security;
alter table public.evidence_objects enable row level security;

-- Results: owner learner (or a matching teacher) reads; writes are service-role.
create policy "canonical_results_owner_select" on public.canonical_results
  for select using (learner_id = auth.uid());

-- Outcomes: teacher capture via service-role; learner may read (audit).
create policy "lesson_outcomes_owner_select" on public.lesson_outcomes
  for select using (true);

-- Evidence is server-managed, readable by the assessment learner.
create policy "evidence_objects_owner_select" on public.evidence_objects
  for select using (assessment_id in (
    select assessment_id from public.assessment_sessions where learner_id = auth.uid()
  ));