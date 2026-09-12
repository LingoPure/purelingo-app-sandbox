-- 0037: LingoPure 2K — Curriculum Engine (C0).
-- The product spine: per-student learning plans + the dynamic reset loop.
--
-- Tables:
--   curricula           — one row per (student, version); the plan itself
--   curriculum_lessons  — lessons/tasks within a plan (4 modalities)
--   lesson_completions  — when a lesson was completed (append-only)
--   tutor_feedback      — standing teacher feedback input (append-only)
--   curriculum_resets   — audit trail of WHY a plan was rewritten (provenance)
--
-- Rules:
--   - curricula is versioned + immutable; a reset writes a NEW version (rows are
--     never mutated in place) — lineage mirrors canonical_results/result_freeeeze.
--   - lesson_completions, tutor_feedback and curriculum_resets are append-only
--     (no UPDATE/DELETE), matching the evidence-pool discipline.
--   - RLS: learner can read own curricula/lessons/completions/resets; feedback
--     is written by the teacher path via service role (org scoping lands in C1).
--   - version uniqueness per student is enforced; lessons/completions cascade.

-- ─── 1. CURRICULA (per-student versioned plans) ───────────────────────────────
create table if not exists public.curricula (
  curriculum_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  version integer not null default 1,
  target_level text not null check (target_level in ('A1','A2','B1','B2','C1','C2')),
  baseline_ref uuid references public.canonical_results(result_id) on delete set null,
  timeline jsonb not null default '{}',
  plan_jsonb jsonb not null default '{}',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, version)
);

drop trigger if exists curricula_updated_at on public.curricula;
create trigger curricula_updated_at before update on public.curricula
  for each row execute function public.update_updated_at();

alter table public.curricula enable row level security;
drop policy if exists "curricula_self_select" on public.curricula;
create policy "curricula_self_select"
  on public.curricula for select to authenticated
  using (student_id = auth.uid());

-- ─── 2. CURRICULUM LESSONS ────────────────────────────────────────────────────
create table if not exists public.curriculum_lessons (
  lesson_id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(curriculum_id) on delete cascade,
  modality text not null check (
    modality in ('live_tutor','writing','speaking','comprehension')
  ),
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  title text not null,
  materials text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'SCHEDULED' check (
    status in ('SCHEDULED','IN_PROGRESS','COMPLETED','SKIPPED')
  ),
  rationale text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists curriculum_lessons_updated_at on public.curriculum_lessons;
create trigger curriculum_lessons_updated_at before update on public.curriculum_lessons
  for each row execute function public.update_updated_at();

create index if not exists curriculum_lessons_plan_idx
  on public.curriculum_lessons (curriculum_id, order_index);

alter table public.curriculum_lessons enable row level security;
drop policy if exists "curriculum_lessons_self_select" on public.curriculum_lessons;
create policy "curriculum_lessons_self_select"
  on public.curriculum_lessons for select to authenticated
  using (exists (
    select 1 from public.curricula c
    where c.curriculum_id = curriculum_lessons.curriculum_id
      and c.student_id = auth.uid()
  ));

-- ─── 3. LESSON COMPLETIONS (append-only) ──────────────────────────────────────
create table if not exists public.lesson_completions (
  completion_id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.curriculum_lessons(lesson_id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  modality text not null check (
    modality in ('live_tutor','writing','speaking','comprehension')
  ),
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  evidence jsonb not null default '{}',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lesson_completions_student_time_idx
  on public.lesson_completions (student_id, completed_at);

create or replace function public.prevent_lesson_completion_mutation() returns trigger as $$
begin
  raise exception 'lesson_completions is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_lesson_completion_append_only on public.lesson_completions;
create trigger trg_lesson_completion_append_only
  before update or delete on public.lesson_completions
  for each row execute function public.prevent_lesson_completion_mutation();

alter table public.lesson_completions enable row level security;
drop policy if exists "lesson_completions_self_select" on public.lesson_completions;
create policy "lesson_completions_self_select"
  on public.lesson_completions for select to authenticated
  using (student_id = auth.uid());
drop policy if exists "lesson_completions_self_insert" on public.lesson_completions;
create policy "lesson_completions_self_insert"
  on public.lesson_completions for insert to authenticated
  with check (student_id = auth.uid());

-- ─── 4. TUTOR FEEDBACK (append-only) ───────────────────────────────────────────
create table if not exists public.tutor_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  lesson_id uuid references public.curriculum_lessons(lesson_id) on delete set null,
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  outcome_status text not null check (
    outcome_status in ('positive','neutral','negative','inconclusive')
  ),
  teacher_action text,
  teacher_observation text not null,
  artifacts jsonb not null default '[]',
  next_action text,
  source text not null default 'live_tutor' check (
    source in ('live_tutor','ai_voice','writing_resubmit','work_observation')
  ),
  created_at timestamptz not null default now()
);

create index if not exists tutor_feedback_student_time_idx
  on public.tutor_feedback (student_id, created_at);

create or replace function public.prevent_tutor_feedback_mutation() returns trigger as $$
begin
  raise exception 'tutor_feedback is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_tutor_feedback_append_only on public.tutor_feedback;
create trigger trg_tutor_feedback_append_only
  before update or delete on public.tutor_feedback
  for each row execute function public.prevent_tutor_feedback_mutation();

alter table public.tutor_feedback enable row level security;
drop policy if exists "tutor_feedback_self_select" on public.tutor_feedback;
create policy "tutor_feedback_self_select"
  on public.tutor_feedback for select to authenticated
  using (student_id = auth.uid());

-- ─── 5. CURRICULUM RESETS (append-only provenance) ──────────────────────────────
create table if not exists public.curriculum_resets (
  reset_id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(curriculum_id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  from_version integer not null,
  to_version integer not null,
  trigger_type text not null check (
    trigger_type in ('INITIAL','LESSON_COMPLETION','TUTOR_FEEDBACK','WORK_OBSERVATION','MANUAL')
  ),
  trigger_key text,
  rationale text not null,
  inputs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists curriculum_resets_student_idx
  on public.curriculum_resets (student_id, created_at desc);

create or replace function public.prevent_curriculum_reset_mutation() returns trigger as $$
begin
  raise exception 'curriculum_resets is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_curriculum_reset_append_only on public.curriculum_resets;
create trigger trg_curriculum_reset_append_only
  before update or delete on public.curriculum_resets
  for each row execute function public.prevent_curriculum_reset_mutation();

alter table public.curriculum_resets enable row level security;
drop policy if exists "curriculum_resets_self_select" on public.curriculum_resets;
create policy "curriculum_resets_self_select"
  on public.curriculum_resets for select to authenticated
  using (student_id = auth.uid());