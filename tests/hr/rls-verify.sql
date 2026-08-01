-- RLS + constraint verification for the HR foundation.
-- Issue #4 acceptance criteria 1-6, 9.
--
-- Runs against a throwaway Postgres seeded by tests/hr/supabase-shim.sql and
-- 0027_hr_01_foundation.sql. Every check RAISEs on failure, so a non-zero psql
-- exit means a criterion is broken.
--
-- The point of testing RLS this way rather than through the UI: the requirement
-- says permissions must be enforced by the backend. These assertions query the
-- database directly as each role, which is the only way to know that is true.

\set ON_ERROR_STOP on
\timing off

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Two orgs, so cross-org isolation is testable. Five people in org A:
-- a Super Admin, two Admins, and two Staff reporting to Admin 1.

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'super@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'admin1@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'admin2@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'staff1@example.test'),
  ('a0000000-0000-4000-8000-000000000005', 'staff2@example.test'),
  ('a0000000-0000-4000-8000-000000000006', 'otherorg@example.test')
on conflict (id) do nothing;

insert into public.hr_organisations (id, name, country, timezone)
values ('0e5f1a10-0000-4000-8000-000000000002', 'Other Co', 'VN', 'Asia/Ho_Chi_Minh')
on conflict (id) do nothing;

insert into public.hr_org_policy (org_id)
values ('0e5f1a10-0000-4000-8000-000000000002')
on conflict (org_id) do nothing;

insert into public.hr_employees
  (id, org_id, auth_user_id, email, first_name, last_name, hr_role, manager_id, employment_start_date, status)
values
  ('b0000000-0000-4000-8000-000000000001', '0e5f1a10-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'super@example.test', 'Sam', 'Super', 'super_admin', null, '2024-01-01', 'active'),
  ('b0000000-0000-4000-8000-000000000002', '0e5f1a10-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'admin1@example.test', 'Ann', 'Admin', 'admin', null, '2024-01-01', 'active'),
  ('b0000000-0000-4000-8000-000000000003', '0e5f1a10-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'admin2@example.test', 'Bao', 'Admin', 'admin', null, '2024-01-01', 'active'),
  ('b0000000-0000-4000-8000-000000000004', '0e5f1a10-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'staff1@example.test', 'Chi', 'Staff', 'staff',
   'b0000000-0000-4000-8000-000000000002', '2024-06-01', 'active'),
  ('b0000000-0000-4000-8000-000000000005', '0e5f1a10-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000005', 'staff2@example.test', 'Dung', 'Staff', 'staff',
   'b0000000-0000-4000-8000-000000000002', '2024-06-01', 'active'),
  ('b0000000-0000-4000-8000-000000000006', '0e5f1a10-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000006', 'otherorg@example.test', 'Eve', 'Elsewhere', 'super_admin', null, '2024-01-01', 'active')
on conflict (id) do nothing;

-- ── Helper: run a check as a given user and assert a row count ───────────────
create or replace function pg_temp.visible_employee_count(
  p_sub uuid, p_email text
) returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub::text, true);
  perform set_config('request.jwt.claim.email', p_email, true);
  set local role authenticated;
  select count(*) into n from public.hr_employees;
  reset role;
  return n;
end;
$$;

create or replace function pg_temp.assert_eq(
  actual bigint, expected bigint, label text
) returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok: % (%)', label, actual;
end;
$$;

-- ── Criterion 2: Staff read only themselves ─────────────────────────────────
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-000000000004', 'staff1@example.test'),
  1, 'staff sees only themselves');
commit;

-- ── Criterion 3: Admin reads exactly their own reports, plus themselves ─────
-- Ann manages Chi and Dung, so 3 rows. She must NOT see Bao (a peer Admin) or
-- Sam (the Super Admin).
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-000000000002', 'admin1@example.test'),
  3, 'admin sees own team plus self');
commit;

-- An Admin with no reports sees only themselves.
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-000000000003', 'admin2@example.test'),
  1, 'admin with no reports sees only self');
commit;

-- ── Criterion 4: Super Admin reads their whole org and NOTHING outside it ───
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-000000000001', 'super@example.test'),
  5, 'super admin sees all 5 in own org');
commit;

-- The other org has exactly one employee. If cross-org isolation were broken
-- this would return 6.
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-000000000006', 'otherorg@example.test'),
  1, 'other-org super admin sees only their own org');
commit;

-- ── An authenticated user who is not an employee sees nothing ───────────────
begin;
select pg_temp.assert_eq(
  pg_temp.visible_employee_count(
    'a0000000-0000-4000-8000-00000000ffff', 'nobody@example.test'),
  0, 'non-employee sees zero rows');
commit;

-- ── hr_can_approve_for: an Admin may not approve their own leave ────────────
do $$
declare
  can_self boolean;
  can_report boolean;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  perform set_config('request.jwt.claim.email', 'admin1@example.test', true);
  select public.hr_can_approve_for('b0000000-0000-4000-8000-000000000002') into can_self;
  select public.hr_can_approve_for('b0000000-0000-4000-8000-000000000004') into can_report;
  if can_self then
    raise exception 'FAIL: an admin must not approve their own leave';
  end if;
  if not can_report then
    raise exception 'FAIL: an admin must be able to approve for a direct report';
  end if;
  raise notice 'ok: admin approves reports but not self';
end;
$$;

-- ── Criterion 5: the duplicate-deduction guard ─────────────────────────────
insert into public.hr_leave_requests
  (id, org_id, employee_id, leave_type_id, start_date, end_date, requested_days, status, decided_by, decided_at)
select 'c0000000-0000-4000-8000-000000000001', '0e5f1a10-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000004', lt.id, '2026-08-03', '2026-08-04', 2.0,
       'approved', 'b0000000-0000-4000-8000-000000000002', now()
from public.hr_leave_types lt
where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual'
on conflict (id) do nothing;

insert into public.hr_leave_ledger
  (org_id, employee_id, leave_type_id, leave_year, entry_type, days, request_id, effective_date)
select '0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
       lt.id, 2026, 'request_approved', -2.0, 'c0000000-0000-4000-8000-000000000001', '2026-08-03'
from public.hr_leave_types lt
where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual';

-- The same approval, applied twice. This is the exact bug the requirement
-- describes in prose; the unique index must refuse it.
do $$
begin
  insert into public.hr_leave_ledger
    (org_id, employee_id, leave_type_id, leave_year, entry_type, days, request_id, effective_date)
  select '0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
         lt.id, 2026, 'request_approved', -2.0, 'c0000000-0000-4000-8000-000000000001', '2026-08-03'
  from public.hr_leave_types lt
  where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual';
  raise exception 'FAIL: a second request_approved row was accepted — double deduction is possible';
exception
  when unique_violation then
    raise notice 'ok: duplicate request_approved rejected by hr_ledger_one_entry_per_request';
end;
$$;

-- A cancellation IS allowed alongside the approval, and restores the balance.
insert into public.hr_leave_ledger
  (org_id, employee_id, leave_type_id, leave_year, entry_type, days, request_id, effective_date)
select '0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
       lt.id, 2026, 'request_cancelled', 2.0, 'c0000000-0000-4000-8000-000000000001', '2026-08-03'
from public.hr_leave_types lt
where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual';

do $$
declare
  balance numeric;
begin
  select coalesce(sum(days), 0) into balance
  from public.hr_leave_ledger
  where employee_id = 'b0000000-0000-4000-8000-000000000004';
  if balance <> 0 then
    raise exception 'FAIL: cancel did not restore the balance — net % expected 0', balance;
  end if;
  raise notice 'ok: approve then cancel nets to zero';
end;
$$;

-- ── Criterion 6: a manual adjustment without a reason is rejected ───────────
do $$
begin
  insert into public.hr_leave_ledger
    (org_id, employee_id, leave_type_id, leave_year, entry_type, days, effective_date, reason)
  select '0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
         lt.id, 2026, 'manual_adjustment', 1.0, '2026-08-03', null
  from public.hr_leave_types lt
  where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual';
  raise exception 'FAIL: a manual adjustment with no reason was accepted';
exception
  when check_violation then
    raise notice 'ok: manual adjustment requires a reason';
end;
$$;

-- Whitespace is not a reason.
do $$
begin
  insert into public.hr_leave_ledger
    (org_id, employee_id, leave_type_id, leave_year, entry_type, days, effective_date, reason)
  select '0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
         lt.id, 2026, 'manual_adjustment', 1.0, '2026-08-03', '   '
  from public.hr_leave_types lt
  where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual';
  raise exception 'FAIL: a whitespace-only reason was accepted';
exception
  when check_violation then
    raise notice 'ok: whitespace-only reason rejected';
end;
$$;

-- ── The ledger refuses to let its subject be deleted ────────────────────────
do $$
begin
  delete from public.hr_employees where id = 'b0000000-0000-4000-8000-000000000004';
  raise exception 'FAIL: an employee with leave history was hard-deleted';
exception
  when foreign_key_violation then
    raise notice 'ok: employee with ledger history cannot be deleted (deactivate instead)';
end;
$$;

-- ── Seed sanity: the four leave types, with the right deduction flags ───────
do $$
declare
  n_types int;
  n_deducting int;
begin
  select count(*) into n_types from public.hr_leave_types
   where org_id = '0e5f1a10-0000-4000-8000-000000000001';
  select count(*) into n_deducting from public.hr_leave_types
   where org_id = '0e5f1a10-0000-4000-8000-000000000001' and deducts_balance;
  if n_types <> 4 then
    raise exception 'FAIL: expected 4 seeded leave types, got %', n_types;
  end if;
  -- Only annual and sick deduct. This is what makes "Public Holidays must not
  -- deduct Annual or Sick Leave" structural rather than a special case.
  if n_deducting <> 2 then
    raise exception 'FAIL: expected 2 deducting leave types, got %', n_deducting;
  end if;
  raise notice 'ok: 4 leave types seeded, 2 of them deducting';
end;
$$;

\echo 'ALL HR FOUNDATION CHECKS PASSED'
