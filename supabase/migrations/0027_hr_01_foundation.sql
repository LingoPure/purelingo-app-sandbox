-- 0027_hr_01_foundation.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- HR & Leave module — foundation. Issue #4 of EPIC #10.
-- Spec: docs/HR_MODULE_SPEC.md
--
-- PORTABILITY CONTRACT (this file is designed to be lifted into another repo):
--   • Every object is prefixed `hr_`.
--   • NO foreign key to any non-`hr_` table except auth.users.
--   • NO dependency on other LingoPure migrations — including the shared
--     public.update_updated_at() trigger from 0001. This module ships its own
--     public.hr_touch_updated_at() precisely so the file applies to an empty
--     database with nothing else present.
--   • The `0027_` prefix is this repo's sequence; `_hr_01_` is the module's own
--     ordering and is what survives renumbering into a destination repo.
--
-- ACCESS MODEL (deliberate, mirrors 0023_content_editors.sql):
--   • READS are RLS-enforced and go through the USER-SCOPED client, so the
--     database — not the UI — decides who sees whom. hr_can_view_employee()
--     is the single predicate every read policy calls.
--   • WRITES are service-role only, performed by the API after an explicit
--     application gate. There is no authenticated write policy on any table;
--     absence of a policy is a denial.
--
--   Do NOT reach for the service-role client on read paths the way
--   src/lib/employer/auth.ts:41 does. That file uses service-role to dodge an
--   @supabase/ssr cookie-timing race, which bypasses RLS wholesale. Acceptable
--   for a demo gate; here, per-role isolation IS the product.
--
-- RECURSION NOTE: hr_can_view_employee() queries hr_employees and is called
-- from hr_employees' own RLS policy. This does not recurse because the function
-- is SECURITY DEFINER owned by the migration role, which also owns the table,
-- and a table owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set. This
-- is the same mechanism current_content_role() relies on in 0023.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Module-local updated_at trigger (see portability contract above) ─────────
create or replace function public.hr_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_organisations — the tenancy anchor.
-- One row on day one. It exists from the first migration so that org scoping is
-- structural rather than retrofitted; there is no org-switching UI and none is
-- planned pre-handover.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  legal_entity        text,
  registration_number text,
  country             text not null default 'VN',
  timezone            text not null default 'Asia/Ho_Chi_Minh',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists hr_organisations_touch on public.hr_organisations;
create trigger hr_organisations_touch before update on public.hr_organisations
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_org_policy — every leave RULE lives here as DATA.
--
-- This table is the reason the module is buildable while client questions are
-- still open: each unanswered question in docs/HR_MODULE_QUESTIONS_FOR_THAO.md
-- maps to a column below, shipped with that document's recommended default. An
-- answer becomes an UPDATE, never a code change.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_org_policy (
  org_id                uuid primary key references public.hr_organisations(id) on delete cascade,

  -- A1/A2: working pattern. ISO day-of-week, 1=Mon … 7=Sun.
  working_days          smallint[] not null default '{1,2,3,4,5}'::smallint[],
  saturday_hours        text not null default 'none'
                          check (saturday_hours in ('none','half','full')),
  count_basis           text not null default 'working_days'
                          check (count_basis in ('working_days','calendar_days')),

  -- A5: what a "day" means, for half-day display.
  day_start_time        time not null default '08:30',
  day_end_time          time not null default '17:30',

  -- B1/B2: how entitlement arrives and when the year turns over.
  accrual_mode          text not null default 'monthly'
                          check (accrual_mode in ('monthly','annual_grant')),
  leave_year_basis      text not null default 'calendar'
                          check (leave_year_basis in ('calendar','anniversary')),

  -- B3: carry-over. expiry_month 3 = must be used by 31 March.
  carry_over_max_days   numeric(4,1) not null default 5.0,
  carry_over_expiry_month smallint check (carry_over_expiry_month between 1 and 12),

  -- B4: pro-rata for mid-year joiners.
  prorate_first_year    boolean not null default true,

  -- C1: what happens when a request exceeds the remaining balance.
  over_balance_policy   text not null default 'block'
                          check (over_balance_policy in ('block','allow_negative','spill_to_unpaid')),

  -- C4: minimum notice for planned leave, in working days. 0 = none enforced.
  min_notice_days       smallint not null default 0,

  -- D1/D2: who approves the approvers.
  approver_escalation   text not null default 'super_admin'
                          check (approver_escalation in ('super_admin','peer_super_admin','self_approve_logged')),

  -- D4: self-cancellation of already-approved leave.
  self_cancel_future    boolean not null default true,
  self_cancel_past      boolean not null default false,

  -- E3: public holiday reminder lead time, in calendar days.
  holiday_notice_days   smallint not null default 7,

  -- F2: fallback language when an employee has none set.
  default_locale        text not null default 'vi'
                          check (default_locale in ('en','vi')),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists hr_org_policy_touch on public.hr_org_policy;
create trigger hr_org_policy_touch before update on public.hr_org_policy
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_employees
--
-- auth_user_id is NULLABLE on purpose: a Super Admin creates the employee
-- record first and invites afterwards, so the row exists before any login does.
-- Until acceptance, identity resolves by email — the same bootstrap trick
-- 0023_content_editors.sql uses to recognise a seeded admin on first sign-in.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_employees (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.hr_organisations(id) on delete cascade,
  auth_user_id          uuid unique references auth.users(id) on delete set null,
  email                 text not null,
  first_name            text not null,
  last_name             text not null,
  job_title             text,
  department            text,
  hr_role               text not null default 'staff'
                          check (hr_role in ('super_admin','admin','staff')),
  manager_id            uuid references public.hr_employees(id) on delete set null,
  employment_start_date date not null,
  employment_end_date   date,
  status                text not null default 'invited'
                          check (status in ('invited','active','deactivated')),
  locale                text check (locale in ('en','vi')),
  invited_at            timestamptz,
  invite_accepted_at    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- An employee cannot be their own manager. Longer cycles are rejected in the
  -- application layer (issue #5) since SQL cannot express them cheaply here.
  constraint hr_employees_not_self_managed check (manager_id is null or manager_id <> id)
);

create unique index if not exists hr_employees_org_email_key
  on public.hr_employees (org_id, lower(email));
create index if not exists hr_employees_manager_idx
  on public.hr_employees (manager_id);
create index if not exists hr_employees_org_status_idx
  on public.hr_employees (org_id, status);

drop trigger if exists hr_employees_touch on public.hr_employees;
create trigger hr_employees_touch before update on public.hr_employees
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_leave_types — a TABLE, not an enum.
--
-- The requirement gives the Super Admin control over leave policies, so adding
-- "maternity leave" must not require a migration. deducts_balance=false is what
-- makes "Public Holidays must not deduct Annual or Sick Leave" structural.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_leave_types (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.hr_organisations(id) on delete cascade,
  code              text not null,
  name_en           text not null,
  name_vi           text not null,
  deducts_balance   boolean not null default true,
  default_allowance numeric(4,1),
  requires_approval boolean not null default true,
  active            boolean not null default true,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, code)
);

drop trigger if exists hr_leave_types_touch on public.hr_leave_types;
create trigger hr_leave_types_touch before update on public.hr_leave_types
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_employee_entitlements — per-person, per-year allowance.
--
-- This is the requirement's "edit the employee's annual allowance", and it is
-- what turns seniority accrual (Vietnam grants +1 day per 5 years of service)
-- into a data question rather than a code change. Never a column on the
-- employee: allowance is year-scoped and must retain its history.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_employee_entitlements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.hr_organisations(id) on delete cascade,
  employee_id   uuid not null references public.hr_employees(id) on delete cascade,
  leave_type_id uuid not null references public.hr_leave_types(id) on delete cascade,
  leave_year    smallint not null,
  allowance     numeric(4,1) not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, employee_id, leave_type_id, leave_year)
);

drop trigger if exists hr_employee_entitlements_touch on public.hr_employee_entitlements;
create trigger hr_employee_entitlements_touch before update on public.hr_employee_entitlements
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_leave_requests
--
-- requested_days is COMPUTED AT SUBMIT AND FROZEN. It must not be recalculated
-- on read: if a public holiday is added later, a request already approved keeps
-- the day count it was approved on, which is what the ledger recorded.
--
-- start_half / end_half record WHICH half is taken, for the calendar. The
-- arithmetic that consumes them lands in issue #6.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_leave_requests (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.hr_organisations(id) on delete cascade,
  -- RESTRICT, not CASCADE: an employee with leave history cannot be hard
  -- deleted. Deactivation (status='deactivated') is the supported path, so
  -- their record and its audit trail survive. See the note on hr_leave_ledger.
  employee_id         uuid not null references public.hr_employees(id) on delete restrict,
  leave_type_id       uuid not null references public.hr_leave_types(id),
  start_date          date not null,
  end_date            date not null,
  start_half          text check (start_half in ('am','pm')),
  end_half            text check (end_half in ('am','pm')),
  requested_days      numeric(4,1) not null check (requested_days >= 0),
  reason              text,
  status              text not null default 'pending'
                        check (status in ('pending','approved','declined','cancelled')),
  decided_by          uuid references public.hr_employees(id) on delete set null,
  decided_at          timestamptz,
  decision_note       text,
  cancelled_by        uuid references public.hr_employees(id) on delete set null,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint hr_leave_requests_date_order check (end_date >= start_date),
  -- A decided request must record who decided it and when.
  constraint hr_leave_requests_decision_complete check (
    status in ('pending','cancelled')
    or (decided_by is not null and decided_at is not null)
  )
);

create index if not exists hr_leave_requests_employee_idx
  on public.hr_leave_requests (org_id, employee_id, start_date desc);
create index if not exists hr_leave_requests_status_idx
  on public.hr_leave_requests (org_id, status) where status = 'pending';
-- Calendar range scans ("who is off between X and Y").
create index if not exists hr_leave_requests_range_idx
  on public.hr_leave_requests (org_id, start_date, end_date) where status = 'approved';

drop trigger if exists hr_leave_requests_touch on public.hr_leave_requests;
create trigger hr_leave_requests_touch before update on public.hr_leave_requests
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_leave_ledger — THE core table.
--
-- Append-only. `days` is SIGNED; a balance is SUM(days) over the rows. There is
-- deliberately no mutable balance column anywhere in this schema: a running
-- total drifts, and once it has drifted there is nothing left to reconcile it
-- against.
--
-- Sign convention:
--   opening_balance   +   carry_over        +   accrual           +
--   request_approved  -   request_cancelled +   expiry            -
--   manual_adjustment either
--
-- An approved request against a deducts_balance=false type still writes a row,
-- with days = 0. That keeps the invariant "every approved request has exactly
-- one request_approved row", which is what makes the unique index below a
-- meaningful guard for every leave type rather than only the deducting ones.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_leave_ledger (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.hr_organisations(id) on delete cascade,
  -- RESTRICT throughout. The ledger is the audit trail for every movement of
  -- someone's entitlement, so it must REFUSE deletion of its subject rather
  -- than quietly disappearing alongside it. Deactivate employees; never delete
  -- them. (A CASCADE here would also collide with the RESTRICT on request_id
  -- below, failing a delete in a way that is hard to read from the error.)
  -- Tearing down a whole org still works: org_id cascades from
  -- hr_organisations, which is the only intended bulk-delete path.
  employee_id    uuid not null references public.hr_employees(id) on delete restrict,
  leave_type_id  uuid not null references public.hr_leave_types(id),
  leave_year     smallint not null,
  entry_type     text not null check (entry_type in (
                   'opening_balance','accrual','carry_over','expiry',
                   'request_approved','request_cancelled','manual_adjustment'
                 )),
  days           numeric(4,1) not null,
  request_id     uuid references public.hr_leave_requests(id) on delete restrict,
  effective_date date not null,
  reason         text,
  created_by     uuid references public.hr_employees(id) on delete set null,
  created_at     timestamptz not null default now(),

  -- The requirement makes a reason mandatory on manual adjustment. Enforced
  -- here so it cannot be skipped by a caller that forgot.
  constraint hr_ledger_adjustment_needs_reason check (
    entry_type <> 'manual_adjustment'
    or (reason is not null and length(btrim(reason)) > 0)
  ),
  -- Request-linked entries must name their request, and only those may.
  constraint hr_ledger_request_link check (
    (entry_type in ('request_approved','request_cancelled') and request_id is not null)
    or (entry_type not in ('request_approved','request_cancelled') and request_id is null)
  )
);

-- THE idempotency guard. The requirement states it as prose — "the system must
-- prevent duplicate deductions if the approval action is triggered more than
-- once" — and this is that sentence as a constraint. A second approval write
-- for the same request violates it and fails loudly rather than silently
-- double-deducting someone's annual leave.
create unique index if not exists hr_ledger_one_entry_per_request
  on public.hr_leave_ledger (request_id, entry_type)
  where request_id is not null;

-- The balance query: SUM(days) for one employee / type / year.
create index if not exists hr_ledger_balance_idx
  on public.hr_leave_ledger (org_id, employee_id, leave_type_id, leave_year);
-- The adjustment-history view the requirement asks for.
create index if not exists hr_ledger_adjustments_idx
  on public.hr_leave_ledger (org_id, created_at desc)
  where entry_type = 'manual_adjustment';

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_public_holidays
-- Multi-day holidays (Tet) are stored as one row per DATE; the application
-- groups contiguous dates sharing a name for display. Storing a range would
-- make "is date D a holiday?" — the hot query in the day count — needlessly
-- expensive.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_public_holidays (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.hr_organisations(id) on delete cascade,
  date         date not null,
  name_en      text not null,
  name_vi      text not null,
  -- Fixed-date annual holidays (National Day) recur; lunar ones (Tet) are
  -- re-entered each year because their Gregorian dates move.
  is_recurring boolean not null default false,
  notified_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, date)
);

drop trigger if exists hr_public_holidays_touch on public.hr_public_holidays;
create trigger hr_public_holidays_touch before update on public.hr_public_holidays
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_working_day_overrides — the "làm bù" requirement.
--
-- Vietnam routinely shifts holidays and designates a weekend day as worked to
-- bridge them. A holidays-only table cannot express "this Saturday IS a working
-- day", and getting it wrong corrupts every day count in that week — so the
-- override is a first-class row, consulted BEFORE the holiday check.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_working_day_overrides (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.hr_organisations(id) on delete cascade,
  date           date not null,
  is_working_day boolean not null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, date)
);

drop trigger if exists hr_working_day_overrides_touch on public.hr_working_day_overrides;
create trigger hr_working_day_overrides_touch before update on public.hr_working_day_overrides
  for each row execute function public.hr_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_audit_log — NON-balance events only.
-- Balance events are audited by hr_leave_ledger itself, which is the point of
-- an append-only ledger. This table covers role changes, deactivation, policy
-- edits, holiday edits and invite resends.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hr_audit_log (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.hr_organisations(id) on delete cascade,
  actor_employee_id uuid references public.hr_employees(id) on delete set null,
  action            text not null,
  entity_type       text not null,
  entity_id         uuid,
  before            jsonb,
  after             jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists hr_audit_log_org_idx
  on public.hr_audit_log (org_id, created_at desc);
create index if not exists hr_audit_log_entity_idx
  on public.hr_audit_log (entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity + visibility functions.
--
-- All three are SECURITY DEFINER with a pinned search_path, following
-- 0023_content_editors.sql. They are the only place the permission model is
-- expressed; every RLS policy below defers to them, and the application layer
-- must not re-derive the rules independently.
-- ─────────────────────────────────────────────────────────────────────────────

-- The current user's employee row id, or null. Resolves by auth_user_id first,
-- falling back to email so an invited-but-not-yet-accepted employee (and the
-- seeded first Super Admin, who has no auth row at seed time) is recognised on
-- their first sign-in.
create or replace function public.hr_current_employee()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.hr_employees e
  where e.status <> 'deactivated'
    and (
      e.auth_user_id = auth.uid()
      or lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by (e.auth_user_id = auth.uid()) desc nulls last
  limit 1
$$;

create or replace function public.hr_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.hr_role
  from public.hr_employees e
  where e.id = public.hr_current_employee()
$$;

create or replace function public.hr_current_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.org_id
  from public.hr_employees e
  where e.id = public.hr_current_employee()
$$;

-- THE permission predicate. "Admin sees only assigned team members" lives here
-- and nowhere else.
--   super_admin → every employee in their own org
--   admin       → employees whose manager_id is them, plus themselves
--   staff       → themselves only
create or replace function public.hr_can_view_employee(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.hr_current_role()
    when 'super_admin' then exists (
      select 1 from public.hr_employees t
      where t.id = target_employee_id
        and t.org_id = public.hr_current_org()
    )
    when 'admin' then exists (
      select 1 from public.hr_employees t
      where t.id = target_employee_id
        and t.org_id = public.hr_current_org()
        and (t.manager_id = public.hr_current_employee()
             or t.id = public.hr_current_employee())
    )
    when 'staff' then target_employee_id = public.hr_current_employee()
    else false
  end
$$;

-- Approval rights, used by application gates in issue #6. Kept here so the
-- rule sits beside the visibility rule rather than drifting apart from it.
create or replace function public.hr_can_approve_for(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.hr_current_role()
    when 'super_admin' then exists (
      select 1 from public.hr_employees t
      where t.id = target_employee_id
        and t.org_id = public.hr_current_org()
    )
    when 'admin' then exists (
      select 1 from public.hr_employees t
      where t.id = target_employee_id
        and t.org_id = public.hr_current_org()
        and t.manager_id = public.hr_current_employee()
        -- An Admin never approves their own leave; that escalates per
        -- hr_org_policy.approver_escalation.
        and t.id <> public.hr_current_employee()
    )
    else false
  end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security.
--
-- Every table: RLS on, SELECT policies only. No authenticated INSERT/UPDATE/
-- DELETE policy exists anywhere — writes are service-role after an application
-- gate, and the absence of a policy is the denial.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.hr_organisations          enable row level security;
alter table public.hr_org_policy             enable row level security;
alter table public.hr_employees              enable row level security;
alter table public.hr_leave_types            enable row level security;
alter table public.hr_employee_entitlements  enable row level security;
alter table public.hr_leave_requests         enable row level security;
alter table public.hr_leave_ledger           enable row level security;
alter table public.hr_public_holidays        enable row level security;
alter table public.hr_working_day_overrides  enable row level security;
alter table public.hr_audit_log              enable row level security;

-- Own org only.
drop policy if exists "hr_organisations_read" on public.hr_organisations;
create policy "hr_organisations_read" on public.hr_organisations
  for select to authenticated
  using (id = public.hr_current_org());

drop policy if exists "hr_org_policy_read" on public.hr_org_policy;
create policy "hr_org_policy_read" on public.hr_org_policy
  for select to authenticated
  using (org_id = public.hr_current_org());

-- The core one. Criteria 2-4 of issue #4 test exactly this policy.
drop policy if exists "hr_employees_read" on public.hr_employees;
create policy "hr_employees_read" on public.hr_employees
  for select to authenticated
  using (public.hr_can_view_employee(id));

-- Leave types, holidays and working-day overrides are org-wide reference data:
-- everyone in the org needs them to read a calendar or a request.
drop policy if exists "hr_leave_types_read" on public.hr_leave_types;
create policy "hr_leave_types_read" on public.hr_leave_types
  for select to authenticated
  using (org_id = public.hr_current_org());

drop policy if exists "hr_public_holidays_read" on public.hr_public_holidays;
create policy "hr_public_holidays_read" on public.hr_public_holidays
  for select to authenticated
  using (org_id = public.hr_current_org());

drop policy if exists "hr_working_day_overrides_read" on public.hr_working_day_overrides;
create policy "hr_working_day_overrides_read" on public.hr_working_day_overrides
  for select to authenticated
  using (org_id = public.hr_current_org());

-- Personal data: same visibility rule as the employee themselves.
drop policy if exists "hr_employee_entitlements_read" on public.hr_employee_entitlements;
create policy "hr_employee_entitlements_read" on public.hr_employee_entitlements
  for select to authenticated
  using (public.hr_can_view_employee(employee_id));

drop policy if exists "hr_leave_requests_read" on public.hr_leave_requests;
create policy "hr_leave_requests_read" on public.hr_leave_requests
  for select to authenticated
  using (public.hr_can_view_employee(employee_id));

drop policy if exists "hr_leave_ledger_read" on public.hr_leave_ledger;
create policy "hr_leave_ledger_read" on public.hr_leave_ledger
  for select to authenticated
  using (public.hr_can_view_employee(employee_id));

-- Audit log: Super Admin only. It records role changes and deactivations, which
-- a manager has no business reading across their team.
drop policy if exists "hr_audit_log_read" on public.hr_audit_log;
create policy "hr_audit_log_read" on public.hr_audit_log
  for select to authenticated
  using (
    org_id = public.hr_current_org()
    and public.hr_current_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: the organisation, its policy defaults, and the four leave types.
--
-- The org UUID is fixed so this migration is re-runnable and so later HR
-- migrations can reference it without a lookup. Policy values are the
-- RECOMMENDED DEFAULTS from docs/HR_MODULE_QUESTIONS_FOR_THAO.md — every one is
-- provisional until Thao confirms, and every one is a single UPDATE to change.
--
-- No employees are seeded here. Issue #6 (swap-in kit) owns fabricated demo
-- staff; the REAL roster never enters this sandbox.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.hr_organisations (id, name, legal_entity, country, timezone)
values (
  '0e5f1a10-0000-4000-8000-000000000001'::uuid,
  'LingoPure',
  'Lingopure Pte Ltd',
  'VN',
  'Asia/Ho_Chi_Minh'
)
on conflict (id) do nothing;

insert into public.hr_org_policy (org_id, carry_over_expiry_month)
values ('0e5f1a10-0000-4000-8000-000000000001'::uuid, 3)
on conflict (org_id) do nothing;

insert into public.hr_leave_types
  (org_id, code, name_en, name_vi, deducts_balance, default_allowance, sort_order)
values
  ('0e5f1a10-0000-4000-8000-000000000001'::uuid, 'annual',
   'Paid Annual Leave', 'Nghỉ phép năm có lương', true,  12.0, 1),
  ('0e5f1a10-0000-4000-8000-000000000001'::uuid, 'sick',
   'Sick Leave',        'Nghỉ ốm',                true,   3.0, 2),
  ('0e5f1a10-0000-4000-8000-000000000001'::uuid, 'unpaid',
   'Unpaid Leave',      'Nghỉ không lương',       false,  null, 3),
  ('0e5f1a10-0000-4000-8000-000000000001'::uuid, 'public_holiday',
   'Public Holiday',    'Nghỉ lễ',                false,  null, 4)
on conflict (org_id, code) do nothing;
