-- 0056_plan_status.sql
-- Plan delivery: track the student's engagement with their improvement programme.
--
-- After assessment (discovery + battery + micro-lessons), the system presents a
-- personalised improvement programme. These columns track the lifecycle:
--   'awaited'  → programme available, not yet reviewed
--   'viewed'   → programme presented (on-screen or in the plan-delivery voice session)
--   'committed'→ student agreed to the programme (commitment captured)
--   'declined' → student chose not to commit
--
-- The plan itself is derived deterministically from gap_scores at request time
-- (src/lib/plan/plan-delivery.ts) — we store the engagement status, not the plan.

alter table public.students
  add column if not exists plan_status text
    check (plan_status in ('awaited','viewed','committed','declined'))
    default 'awaited';

alter table public.students
  add column if not exists plan_committed_at timestamptz;

alter table public.students
  add column if not exists plan_notes text;

-- Expose the columns to the student (RLS: students can read/update their own row).
drop policy if exists "students_self_update_plan" on public.students;
create policy "students_self_update_plan"
  on public.students
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);