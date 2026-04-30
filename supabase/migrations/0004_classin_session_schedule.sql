-- Step 7 — ClassIn session scheduling fields.
-- The base classin_sessions table (migration 0001) only modeled post-session
-- data (attended, duration, recording). To show "next class" on the dashboard
-- and gate the /classroom/[sessionId] embed page on ownership + timing, we
-- need scheduling fields too. Idempotent.

alter table public.classin_sessions
  add column if not exists scheduled_at timestamptz,
  add column if not exists teacher_name text,
  add column if not exists join_url text,
  add column if not exists status text;

-- Backfill default status for any pre-existing rows so the CHECK doesn't fight
-- with historical data.
update public.classin_sessions
  set status = case when attended then 'completed' else 'scheduled' end
  where status is null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'classin_sessions_status_check'
      and table_name = 'classin_sessions'
  ) then
    alter table public.classin_sessions
      add constraint classin_sessions_status_check
      check (status in ('scheduled','live','completed','cancelled','no_show'));
  end if;
end $$;

create index if not exists classin_sessions_scheduled_idx
  on public.classin_sessions (student_id, scheduled_at desc);

create index if not exists classin_sessions_status_idx
  on public.classin_sessions (status);

-- Students need to be able to insert their own scheduled sessions through the
-- demo "Schedule a class" button. The base table only has a SELECT policy.
drop policy if exists "classin_sessions_self_insert" on public.classin_sessions;
create policy "classin_sessions_self_insert"
  on public.classin_sessions for insert to authenticated
  with check (student_id = auth.uid());
