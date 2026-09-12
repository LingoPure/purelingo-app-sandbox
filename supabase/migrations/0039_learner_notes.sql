-- 0039: learner notes for the A1 telemetry dashboard ("My notes" panel, §3.A1).
-- Per-learner free-text notes surfaced beside the journey; owner-only.
-- Append + latest-first; teachers may not write here (teacher notes land in
-- lesson_outcomes.teacher_observation / a future staff view).

create table if not exists public.learner_notes (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.students(id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.learner_notes enable row level security;

drop policy if exists "learner_notes_owner_select" on public.learner_notes;
create policy "learner_notes_owner_select" on public.learner_notes
  for select to authenticated using (learner_id = auth.uid());

drop policy if exists "learner_notes_owner_insert" on public.learner_notes;
create policy "learner_notes_owner_insert" on public.learner_notes
  for insert to authenticated with check (learner_id = auth.uid());

drop policy if exists "learner_notes_owner_update" on public.learner_notes;
create policy "learner_notes_owner_update" on public.learner_notes
  for update to authenticated using (learner_id = auth.uid())
  with check (learner_id = auth.uid());

drop policy if exists "learner_notes_owner_delete" on public.learner_notes;
create policy "learner_notes_owner_delete" on public.learner_notes
  for delete to authenticated using (learner_id = auth.uid());