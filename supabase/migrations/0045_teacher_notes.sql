-- 0045: teacher notes — the staff-side "notes" surface (C6 §7, 0039's deferred
-- staff view). Light placeholder store so /teacher/notes has real rows; no
-- ClassIn wiring this phase.
--
-- Visibility mirrors the org gate exactly (matches 0040):
--   - the note's teacher (assigned → org_can_view_student true),
--   - the student's org owner/hr,
--   - the learner themself.
-- Writes are service-role after the getTeacherIdentity route gate — no
-- INSERT/UPDATE/DELETE policies here (append-only discipline).

create table if not exists public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_notes_teacher_idx
  on public.teacher_notes (teacher_id, created_at desc);
create index if not exists teacher_notes_student_idx
  on public.teacher_notes (student_id, created_at desc);

alter table public.teacher_notes enable row level security;

drop policy if exists "teacher_notes_org_view" on public.teacher_notes;
create policy "teacher_notes_org_view"
  on public.teacher_notes for select to authenticated
  using (public.org_can_view_student(student_id));