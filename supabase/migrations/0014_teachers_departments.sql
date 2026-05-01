-- 0014_teachers_departments.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- LingoPure-side teaching staff structure.
--
-- This is the SaaS provider's org chart, distinct from the buyer's
-- (employers + students). Models:
--   departments         — LingoPure's academic departments (Speaking,
--                         Writing, Business English, etc.)
--   teachers            — coaching staff. May be in-house, contractors,
--                         or AI tutors. Optionally linked to auth.users
--                         when they have a portal login.
--   teacher_departments — many-to-many; a teacher can span departments.
--                         is_head_of_department flags the lead per row.
--   student_teacher_assignments — links a student (employer's staff) to
--                         a teacher (LingoPure's coach). One primary
--                         per student + zero or more specialists.
--
-- Provisional shape — refine when LingoPure shares their real org chart.
-- The migration is intentionally additive: no existing tables touched.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── departments ────────────────────────────────────────────────────────────
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  focus       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists departments_updated_at on public.departments;
create trigger departments_updated_at before update on public.departments
  for each row execute function public.update_updated_at();

alter table public.departments enable row level security;

drop policy if exists "departments_authenticated_read" on public.departments;
create policy "departments_authenticated_read"
  on public.departments for select to authenticated using (true);

-- ─── teachers ───────────────────────────────────────────────────────────────
create table if not exists public.teachers (
  id                  uuid primary key default gen_random_uuid(),
  -- Optional portal login. AI tutors and demo personas have no auth row.
  auth_user_id        uuid unique references auth.users(id) on delete set null,
  full_name           text not null,
  email               text not null unique,
  classin_account_id  text,
  -- in_house = LingoPure-employed coach
  -- contractor = freelance/agency coach
  -- ai_tutor = AI-driven tutor (no human, no ClassIn account)
  employment_type     text not null default 'in_house'
                      check (employment_type in ('in_house','contractor','ai_tutor')),
  status              text not null default 'active'
                      check (status in ('active','on_leave','departed')),
  bio                 text,
  avatar_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists teachers_updated_at on public.teachers;
create trigger teachers_updated_at before update on public.teachers
  for each row execute function public.update_updated_at();

create index if not exists teachers_status_idx
  on public.teachers (status) where status = 'active';

alter table public.teachers enable row level security;

drop policy if exists "teachers_authenticated_read" on public.teachers;
create policy "teachers_authenticated_read"
  on public.teachers for select to authenticated using (true);

-- ─── teacher_departments ────────────────────────────────────────────────────
-- Many-to-many. is_head_of_department lets us mark a department head.
-- Constraint at app level: at most one head per department (enforced at
-- write time, not via PG — easy to relax later).
create table if not exists public.teacher_departments (
  teacher_id              uuid not null references public.teachers(id) on delete cascade,
  department_id           uuid not null references public.departments(id) on delete cascade,
  is_head_of_department   boolean not null default false,
  created_at              timestamptz not null default now(),
  primary key (teacher_id, department_id)
);

create index if not exists teacher_departments_dept_idx
  on public.teacher_departments (department_id);

create index if not exists teacher_departments_head_idx
  on public.teacher_departments (department_id) where is_head_of_department = true;

alter table public.teacher_departments enable row level security;

drop policy if exists "teacher_departments_authenticated_read" on public.teacher_departments;
create policy "teacher_departments_authenticated_read"
  on public.teacher_departments for select to authenticated using (true);

-- ─── student_teacher_assignments ────────────────────────────────────────────
-- A student has 1 primary teacher (assignment_role = 'primary') and may
-- have additional specialists. ended_at = null means current; we keep
-- history rather than overwriting on reassignment.
create table if not exists public.student_teacher_assignments (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students(id) on delete cascade,
  teacher_id        uuid not null references public.teachers(id) on delete cascade,
  assignment_role   text not null default 'primary'
                    check (assignment_role in ('primary','specialist')),
  assigned_at       timestamptz not null default now(),
  ended_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists student_teacher_assignments_updated_at on public.student_teacher_assignments;
create trigger student_teacher_assignments_updated_at before update on public.student_teacher_assignments
  for each row execute function public.update_updated_at();

-- "Current primary teacher" is the most common query — make it cheap.
create index if not exists student_teacher_assignments_active_primary_idx
  on public.student_teacher_assignments (student_id)
  where assignment_role = 'primary' and ended_at is null;

create index if not exists student_teacher_assignments_teacher_idx
  on public.student_teacher_assignments (teacher_id) where ended_at is null;

alter table public.student_teacher_assignments enable row level security;

-- A student can read their own assignment(s); a teacher can read
-- theirs; the layout-level employer-admin check decides whether
-- /employer/* dashboards see the cohort. Writes are service-role only.
drop policy if exists "student_teacher_assignments_self_select" on public.student_teacher_assignments;
create policy "student_teacher_assignments_self_select"
  on public.student_teacher_assignments for select to authenticated
  using (
    student_id = auth.uid()
    or teacher_id in (
      select id from public.teachers where auth_user_id = auth.uid()
    )
  );
