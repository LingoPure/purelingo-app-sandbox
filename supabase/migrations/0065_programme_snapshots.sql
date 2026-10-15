-- 0065_programme_snapshots.sql
--
-- Persists the gap-driven improvement programme (phases + per-skill weekly
-- cadence) at the moment it becomes real for a student — discovery_status
-- turning 'complete' — so the nudge cron has a stable target to compare
-- activity against. Previously buildPlan() recomputed phases/totalWeeks
-- fresh from live gap_scores on every call; nothing persisted it, so there
-- was no stable "week N of M" to measure cadence against.
--
-- A later re-assessment (a fresh discovery completion) supersedes the
-- active row rather than editing it in place, so `committed_at` on an
-- active row is always a true, immutable start date for deriving the
-- current week number at read time.

create table if not exists public.programme_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.students(id) on delete cascade,
  status                  text not null default 'active'
                            check (status in ('active', 'superseded')),
  committed_at            timestamptz not null default now(),
  target_level            text not null,
  total_weeks             integer not null,
  -- [{ name, week_start, week_end,
  --    skill_targets: [{ skill, label, kind: 'micro_lesson'|'ai_voice'|'class',
  --                       times_per_week, cta_href }] }]
  phases                  jsonb not null,
  kickoff_nudge_sent_at   timestamptz,
  last_cadence_nudge_week integer,
  superseded_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- At most one active snapshot per student at any time.
create unique index if not exists programme_snapshots_one_active_idx
  on public.programme_snapshots (student_id)
  where status = 'active';

create index if not exists programme_snapshots_student_idx
  on public.programme_snapshots (student_id);

drop trigger if exists programme_snapshots_touch on public.programme_snapshots;
create trigger programme_snapshots_touch before update on public.programme_snapshots
  for each row execute function public.update_updated_at();

alter table public.programme_snapshots enable row level security;

-- Students read their own row(s) (parity with the gap_scores/students RLS
-- shape). All writes are service-role only (the discovery webhook + the
-- nudge cron) — same posture as students.plan_report_sent_at (migration 0059).
drop policy if exists "students_read_own_programme_snapshot" on public.programme_snapshots;
create policy "students_read_own_programme_snapshot"
  on public.programme_snapshots
  for select
  to authenticated
  using (auth.uid() = student_id);
