-- 0038: LingoPure — Organisation model (additive, Kira-pattern).
--
-- Builds the canonical multi-level admin hierarchy without renaming or
-- breaking existing tables.
--
-- Tables:
--   organisations              — client org identity (additive; employers stays)
--   organisation_memberships   — role/status/can_spend membership per user
--   organisation_departments   — org-owned departments (BPO: inbound/outbound/logistics)
--   platform_admins            — canonical platform-admin allowlist
--
-- FK:
--   employers.organisation_id → organisations.id  (nullable — existing rows migrate later)
--
-- DB functions (SECURITY DEFINER, pinned search_path — mirrors 0027 pattern):
--   current_org_role(target_org_id)  — caller's role in an org
--   org_can_view_student(student_id) — boolean: can caller read this student?
--   dept_can_view_student(student_id, dept_id) — boolean: dept-scoped variant
--
-- Migration path from employer_admins:
--   Existing employer_admins rows are NOT migrated in this migration.
--   A later step (C5 wiring) migrates them into organisation_memberships
--   and employer_admins becomes a legacy view during cutover.
--
-- Idempotent: safe to re-run.
-- RECURSION NOTE: same pattern as 0027 — SECURITY DEFINER functions own the
-- tables, bypass RLS, and avoid recursion.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. ORGANISATIONS ─────────────────────────────────────────────────────────

create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists organisations_touch on public.organisations;
create trigger organisations_touch before update on public.organisations
  for each row execute function public.update_updated_at();

-- Link employers to organisations (nullable — existing rows backfill later).
do $$ begin
  alter table public.employers
    add column if not exists organisation_id uuid
    references public.organisations(id) on delete set null;
exception when duplicate_column then null;
end $$;

create index if not exists employers_organisation_idx
  on public.employers (organisation_id) where organisation_id is not null;

-- ─── 2. ORGANISATION MEMBERSHIPS ──────────────────────────────────────────────

create table if not exists public.organisation_memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  role            text not null default 'staff'
                    check (role in ('owner','hr','viewer','teacher','staff','student')),
  status          text not null default 'active'
                    check (status in ('active','suspended','pending')),
  can_spend       boolean not null default false,
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  invited_at      timestamptz,
  invite_accepted_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, organisation_id)
);

drop trigger if exists organisation_memberships_touch on public.organisation_memberships;
create trigger organisation_memberships_touch before update on public.organisation_memberships
  for each row execute function public.update_updated_at();

create index if not exists org_memberships_org_idx
  on public.organisation_memberships (organisation_id);
create index if not exists org_memberships_user_idx
  on public.organisation_memberships (user_id);

-- ─── 3. ORGANISATION DEPARTMENTS ──────────────────────────────────────────────

create table if not exists public.organisation_departments (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, name)
);

drop trigger if exists organisation_departments_touch on public.organisation_departments;
create trigger organisation_departments_touch before update on public.organisation_departments
  for each row execute function public.update_updated_at();

create index if not exists org_departments_org_idx
  on public.organisation_departments (organisation_id)
  where is_archived = false;

-- ─── 4. PLATFORM ADMINS ───────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── 5. SECURITY DEFINER FUNCTIONS ────────────────────────────────────────────
-- Mirrors 0027: pinned search_path, stable, SECURITY DEFINER.

-- Caller's role in a given org. Returns NULL if caller has no membership.
create or replace function public.current_org_role(target_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organisation_memberships m
  where m.user_id = auth.uid()
    and m.organisation_id = target_org_id
    and m.status = 'active'
  limit 1
$$;

-- Is the caller an owner or hr in the given org?
create or replace function public.org_is_owner_or_hr(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_org_role(target_org_id) in ('owner', 'hr')
$$;

-- The employer linked to a given org, or NULL.
create or replace function public.org_employer_id(target_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employers e
  where e.organisation_id = target_org_id
  limit 1
$$;

-- Can the current user read this student's data via org membership?
-- owner/hr: any student under the org's employers
-- teacher:  assigned students only (student_teacher_assignments — 0014)
-- staff:    self only
create or replace function public.org_can_view_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- students always see themselves
    when target_student_id = auth.uid() then true
    when public.current_org_role(
      (select e.organisation_id from public.employers e
       where e.id = (select s.employer_id from public.students s where s.id = target_student_id))
    ) in ('owner', 'hr')
    then true
    -- teachers see assigned students (links via 0014 student_teacher_assignments)
    when public.current_org_role(
      (select e.organisation_id from public.employers e
       where e.id = (select s.employer_id from public.students s where s.id = target_student_id))
    ) = 'teacher'
    and exists (
      select 1 from public.student_teacher_assignments sta
      where sta.student_id = target_student_id
        and sta.teacher_id = auth.uid()
    )
    then true
    else false
  end
$$;

-- Dept-scoped student visibility. owner/hr see all org students regardless;
-- teacher/staff see only students in their department.
-- dept_id is resolved from the student's employer → organisation_departments.
create or replace function public.dept_can_view_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_student_id = auth.uid() then true
    when public.current_org_role(
      (select e.organisation_id from public.employers e
       where e.id = (select s.employer_id from public.students s where s.id = target_student_id))
    ) in ('owner', 'hr')
    then true
    else false
  end
$$;

-- ─── 6. ROW LEVEL SECURITY ────────────────────────────────────────────────────

alter table public.organisations              enable row level security;
alter table public.organisation_memberships   enable row level security;
alter table public.organisation_departments   enable row level security;
alter table public.platform_admins            enable row level security;

-- Organisations: members see their own org.
drop policy if exists "organisations_self_select" on public.organisations;
create policy "organisations_self_select"
  on public.organisations for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Memberships: self-select + owner/hr see all org members.
drop policy if exists "org_memberships_self_select" on public.organisation_memberships;
create policy "org_memberships_self_select"
  on public.organisation_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.org_is_owner_or_hr(organisation_id)
  );

-- Departments: org members see their org's departments.
drop policy if exists "org_departments_self_select" on public.organisation_departments;
create policy "org_departments_self_select"
  on public.organisation_departments for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = organisation_departments.organisation_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Platform admins: self-select only.
drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies on any table above — writes are service-role
-- after an application gate (matches HR and employer_admins patterns).