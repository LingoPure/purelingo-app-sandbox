-- 0042: LingoPure — Org onboarding wizard state (C3).
--
-- Tracks where an organisation is in the onboarding lifecycle flow:
--
--   P0 creates org → selects package → P1 configures depts → P1 allocates staff
--   → P2 assigns teachers → baseline + curriculum (automatic) → done
--
-- The wizard is the UI representation of §6. The state machine is linear
-- (no back-navigation complexity this phase). Steps 4–5 (baseline assessment
-- + curriculum generation) are triggered automatically once teacher-student
-- assignments exist.
--
-- The table is additive (no existing tables touched). RLS: org members see
-- their own org's state; platform admins see all.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. ONBOARDING STATE ──────────────────────────────────────────────────────

create table if not exists public.org_onboarding (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  step            text not null default 'package'
                    check (step in (
                      'package',         -- P0: select service package
                      'departments',     -- P1: configure departments
                      'staff',           -- P1: allocate staff to departments
                      'teachers',        -- P2: assign teachers to students
                      'baseline',        -- automatic: 2K assessment running
                      'curriculum',      -- automatic: AI curriculum generation
                      'done'             -- onboarding complete
                    )),
  package         text check (package in ('1:1 Tutoring', 'Tutor + AI', 'Full BPO')),
  package_selected_at timestamptz,
  departments_configured_at timestamptz,
  staff_allocated_at timestamptz,
  teachers_assigned_at timestamptz,
  baseline_at      timestamptz,
  curriculum_at     timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists org_onboarding_touch on public.org_onboarding;
create trigger org_onboarding_touch before update on public.org_onboarding
  for each row execute function public.update_updated_at();

-- ─── 2. ROW LEVEL SECURITY ────────────────────────────────────────────────────

alter table public.org_onboarding enable row level security;

-- Org members see their own org's onboarding state; platform admins see all.
drop policy if exists "org_onboarding_org_select" on public.org_onboarding;
create policy "org_onboarding_org_select"
  on public.org_onboarding for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = org_onboarding.organisation_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — writes are service-role only.