-- Employee-record constraint verification. Issue #5.
--
-- Covers the rules #5 relies on that are enforced by the DATABASE. The rules
-- enforced in TypeScript instead (management-cycle detection, manager-must-not-
-- be-staff, deactivation auto-declining pending requests) are NOT covered here
-- and are called out as a gap in the issue — a SQL file cannot reach them, and
-- pretending otherwise would be worse than leaving them visibly untested.
--
-- Runs after rls-verify.sql against the same throwaway database, so the org and
-- the five fixture employees already exist.

\set ON_ERROR_STOP on

-- ── Email is unique per org, case-insensitively ─────────────────────────────
-- Without the lower() index, "Chi@example.test" and "chi@example.test" would be
-- two employees, and hr_current_employee()'s email fallback would then resolve
-- a signing-in user to whichever row it happened to reach first.
do $$
begin
  insert into public.hr_employees
    (org_id, email, first_name, last_name, hr_role, employment_start_date, status)
  values
    ('0e5f1a10-0000-4000-8000-000000000001', 'STAFF1@example.test',
     'Duplicate', 'Person', 'staff', '2026-01-01', 'invited');
  raise exception 'FAIL: a case-variant duplicate email was accepted';
exception
  when unique_violation then
    raise notice 'ok: duplicate email rejected case-insensitively';
end;
$$;

-- The same address IS allowed in a different org — orgs are separate tenancies.
do $$
begin
  insert into public.hr_employees
    (org_id, email, first_name, last_name, hr_role, employment_start_date, status)
  values
    ('0e5f1a10-0000-4000-8000-000000000002', 'staff1@example.test',
     'Same', 'Address', 'staff', '2026-01-01', 'invited');
  raise notice 'ok: the same email may exist in a different org';
  delete from public.hr_employees
   where org_id = '0e5f1a10-0000-4000-8000-000000000002'
     and lower(email) = 'staff1@example.test';
end;
$$;

-- ── Nobody manages themselves ───────────────────────────────────────────────
do $$
begin
  update public.hr_employees
     set manager_id = 'b0000000-0000-4000-8000-000000000004'
   where id = 'b0000000-0000-4000-8000-000000000004';
  raise exception 'FAIL: an employee was set as their own manager';
exception
  when check_violation then
    raise notice 'ok: self-management rejected by CHECK constraint';
end;
$$;

-- ── Entitlements are per employee, per type, per YEAR ───────────────────────
-- The year in the key is what allows an allowance to change between years while
-- the previous year's figure stays intact for audit.
do $$
declare
  annual_type uuid;
begin
  select id into annual_type from public.hr_leave_types
   where org_id = '0e5f1a10-0000-4000-8000-000000000001' and code = 'annual';

  insert into public.hr_employee_entitlements
    (org_id, employee_id, leave_type_id, leave_year, allowance)
  values
    ('0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
     annual_type, 2026, 12.0);

  -- Same employee, same type, DIFFERENT year: allowed.
  insert into public.hr_employee_entitlements
    (org_id, employee_id, leave_type_id, leave_year, allowance)
  values
    ('0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
     annual_type, 2027, 13.0);
  raise notice 'ok: a different leave year may carry a different allowance';

  -- Same employee, same type, SAME year: rejected.
  begin
    insert into public.hr_employee_entitlements
      (org_id, employee_id, leave_type_id, leave_year, allowance)
    values
      ('0e5f1a10-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
       annual_type, 2026, 20.0);
    raise exception 'FAIL: two allowances accepted for one employee/type/year';
  exception
    when unique_violation then
      raise notice 'ok: one allowance per employee, type and year';
  end;
end;
$$;

-- ── A deactivated employee keeps their history and stays invisible ──────────
-- hr_current_employee() excludes deactivated rows, so a former employee whose
-- auth account still exists resolves to no HR identity at all rather than to a
-- stale one.
do $$
declare
  resolved uuid;
begin
  update public.hr_employees
     set status = 'deactivated', employment_end_date = '2026-08-01'
   where id = 'b0000000-0000-4000-8000-000000000005';

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000005', true);
  perform set_config('request.jwt.claim.email', 'staff2@example.test', true);
  select public.hr_current_employee() into resolved;

  if resolved is not null then
    raise exception 'FAIL: a deactivated employee still resolves to an HR identity';
  end if;
  raise notice 'ok: deactivated employee resolves to no HR identity';

  -- Their entitlement rows survive, which is what keeps a final-pay question
  -- answerable months later.
  if not exists (
    select 1 from public.hr_employee_entitlements
     where employee_id = 'b0000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'FAIL: deactivation destroyed the employee history';
  end if;
  raise notice 'ok: deactivated employee history retained';

  update public.hr_employees set status = 'active', employment_end_date = null
   where id = 'b0000000-0000-4000-8000-000000000005';
end;
$$;

-- ── Role values are constrained ─────────────────────────────────────────────
do $$
begin
  update public.hr_employees set hr_role = 'owner'
   where id = 'b0000000-0000-4000-8000-000000000004';
  raise exception 'FAIL: an unrecognised role was accepted';
exception
  when check_violation then
    raise notice 'ok: only super_admin/admin/staff are valid roles';
end;
$$;

-- ── Locale is constrained to the languages we actually render ──────────────
do $$
begin
  update public.hr_employees set locale = 'fr'
   where id = 'b0000000-0000-4000-8000-000000000004';
  raise exception 'FAIL: an unsupported locale was accepted';
exception
  when check_violation then
    raise notice 'ok: locale limited to en/vi';
end;
$$;

\echo 'ALL HR EMPLOYEE CHECKS PASSED'
