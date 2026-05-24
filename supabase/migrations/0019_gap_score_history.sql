-- 0019: gap_score_history — immutable, append-only trail of every score event.
--
-- gap_scores keeps ONE canonical row per (student, skill) — the current value, overwritten
-- on each score. That gives no progress signal. This table appends one row per scoring
-- event (discovery, lesson, battery, rescore) so the dashboard can chart score-over-time.
-- Never updated, never deleted (except by student cascade). gap_scores stays the source of
-- truth for "current"; this is the history beside it.

create table if not exists public.gap_score_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  score integer not null check (score between 0 and 1000),
  target integer check (target between 0 and 1000),
  -- Free text (not a constrained enum) so it survives the evolving gap_scores.source set.
  source text not null,
  scored_at timestamptz not null default now()
);

-- Query pattern: a student's trend for a skill, ordered in time.
create index if not exists gap_score_history_student_skill_time_idx
  on public.gap_score_history (student_id, skill, scored_at);

alter table public.gap_score_history enable row level security;

drop policy if exists "gap_score_history_self_select" on public.gap_score_history;
create policy "gap_score_history_self_select" on public.gap_score_history
  for select to authenticated using (student_id = auth.uid());

-- Writes happen through the service-role client (the scorers), which bypasses RLS.
