-- Step 8 — micro-lessons engine MVP.
-- Base table (migration 0001) has the columns but no insert/update RLS, and no
-- status field for tracking in-progress lessons. Add both. Idempotent.

alter table public.micro_lessons
  add column if not exists status text;

update public.micro_lessons
  set status = case when completed_at is not null then 'completed' else 'active' end
  where status is null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'micro_lessons_status_check'
      and table_name = 'micro_lessons'
  ) then
    alter table public.micro_lessons
      add constraint micro_lessons_status_check
      check (status in ('draft','active','completed','abandoned'));
  end if;
end $$;

-- Students need to be able to start lessons (insert) and submit responses
-- (update). Cross-student access is still gated by the existing self_select
-- policy from migration 0001.
drop policy if exists "micro_lessons_self_insert" on public.micro_lessons;
create policy "micro_lessons_self_insert"
  on public.micro_lessons for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "micro_lessons_self_update" on public.micro_lessons;
create policy "micro_lessons_self_update"
  on public.micro_lessons for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create index if not exists micro_lessons_status_idx
  on public.micro_lessons (student_id, status);

-- Allow gap_scores upserts by service-role to land with source='lesson'. The
-- existing CHECK constraint already lists 'lesson' so no schema change there.
