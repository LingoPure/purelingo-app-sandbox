-- 0010_roles_baselines.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Per-employer roles + per-role English baselines.
--
-- Buyer model: an employer (BPO, manufacturer, etc.) defines named roles
-- ("BPO Operator", "Manufacturing Sales Rep", "Technical Specialist"), each
-- with a per-skill minimum score that's acceptable for that position.
-- Students are assigned to a role within their employer; the gap analysis
-- and lesson generators work against the role's baseline rather than a
-- flat 80 across the board.
--
-- Designed for multi-year, 1k+ staff scale:
--   - is_archived rather than hard delete on roles (preserve historical
--     gap_scores rows whose role context still matters)
--   - indices on the columns the employer dashboard filters by
--     (employer_id, role_id) so per-cohort rollups stay sub-100ms even
--     at scale
--   - role_baselines PK is (role_id, skill) so upserts are idempotent
--     and there's exactly one baseline per skill per role
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── roles ──────────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  name text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, name)
);

drop trigger if exists roles_updated_at on public.roles;
create trigger roles_updated_at before update on public.roles
  for each row execute function public.update_updated_at();

-- Partial index: only non-archived roles. Most employer-facing queries
-- filter by is_archived = false, so this keeps the index small as
-- archived roles accumulate over the years.
create index if not exists roles_employer_id_idx
  on public.roles (employer_id) where is_archived = false;

alter table public.roles enable row level security;

-- Read access for any authenticated student (mirrors the existing employers
-- read policy). Writes are intentionally service-role-only — the employer
-- admin UI hits Supabase via the service-role key, not RLS-bound auth.
drop policy if exists "roles_authenticated_read" on public.roles;
create policy "roles_authenticated_read"
  on public.roles for select to authenticated using (true);

-- ─── role_baselines ─────────────────────────────────────────────────────────
-- Six rows per role (one per skill). The skill enum mirrors gap_scores.skill
-- exactly so a join "current_score → baseline_min_score" is trivial.
create table if not exists public.role_baselines (
  role_id uuid not null references public.roles(id) on delete cascade,
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  min_score smallint not null check (min_score between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, skill)
);

drop trigger if exists role_baselines_updated_at on public.role_baselines;
create trigger role_baselines_updated_at before update on public.role_baselines
  for each row execute function public.update_updated_at();

alter table public.role_baselines enable row level security;
drop policy if exists "role_baselines_authenticated_read" on public.role_baselines;
create policy "role_baselines_authenticated_read"
  on public.role_baselines for select to authenticated using (true);

-- ─── students.role_id ───────────────────────────────────────────────────────
-- Nullable: a student can exist before being assigned a role (e.g. just
-- invited, role TBD). On role delete we set to null rather than cascade —
-- losing a student because their role was archived would be wrong.
alter table public.students
  add column if not exists role_id uuid references public.roles(id) on delete set null;

-- Indices for the employer dashboard rollups. Both partial — most queries
-- exclude rows where the column is null.
create index if not exists students_role_id_idx
  on public.students (role_id) where role_id is not null;

create index if not exists students_employer_id_idx
  on public.students (employer_id) where employer_id is not null;

-- ─── helper view: students_with_role ────────────────────────────────────────
-- Convenience for the employer dashboard. Joins students → roles → employer
-- so the per-role coverage rollup can be a one-shot select. RLS on the
-- underlying tables still applies (the view is security_invoker).
create or replace view public.students_with_role
with (security_invoker = true)
as
select
  s.id            as student_id,
  s.name          as student_name,
  s.email         as student_email,
  s.employer_id,
  s.role_id,
  r.name          as role_name,
  r.is_archived   as role_archived,
  s.target_level,
  s.discovery_status,
  s.xp,
  s.streak_days
from public.students s
left join public.roles r on r.id = s.role_id;
