-- RLS + SECURITY DEFINER budget verification for the org model (0038).
--
-- Runs against a throwaway Postgres seeded by tests/org/supabase-shim.sql plus
-- migrations 0001, 0014, 0038. Every check RAISEs on failure, so a non-zero
-- psql exit means the gate layer is broken.
--
-- The point of testing this way rather than through the UI: the gateway must be
-- enforced by the DATABASE. These assertions query directly as each role and
-- call the visibility functions through the authenticated path — the only way
-- to prove the data doesn't leak regardless of what the UI does.

\set ON_ERROR_STOP on
\timing off

-- ── Test helpers ─────────────────────────────────────────────────────────────

-- Count how many organisations the given user can see through RLS.
create or replace function pg_temp.visible_org_count(p_sub text, p_email text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('request.jwt.claim.email', p_email, true);
  set local role authenticated;
  select count(*) into n from public.organisations;
  reset role;
  return n;
end;
$$;

-- Count how many memberships rows the given user can see through RLS.
create or replace function pg_temp.visible_membership_count(p_sub text, p_email text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('request.jwt.claim.email', p_email, true);
  set local role authenticated;
  select count(*) into n from public.organisation_memberships;
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

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Two orgs so cross-org isolation is testable. Roles exercised:
--   ownerA (P0), hrA (P1), teacherA (P2, linked to teachers row),
--   staffA (P3, self-only), studentA (self), outsiderB (different org).

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'hr@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'teacher@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'staff@example.test'),
  ('a0000000-0000-4000-8000-000000000005', 'student@example.test'),
  ('a0000000-0000-4000-8000-000000000006', 'outsider@example.test'),
  ('d0000000-0000-4000-8000-000000000001', 'phuong@example.test')
on conflict (id) do nothing;

insert into public.organisations (id, name, slug) values
  ('0e5f1a10-0000-4000-8000-000000000001', 'Celadon BPO', 'celadon'),
  ('0e5f1a10-0000-4000-8000-000000000002', 'OtherCo', 'otherco')
on conflict (id) do nothing;

insert into public.organisation_memberships
  (id, user_id, organisation_id, role, status)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '0e5f1a10-0000-4000-8000-000000000001', 'owner',   'active'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '0e5f1a10-0000-4000-8000-000000000001', 'hr',      'active'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', '0e5f1a10-0000-4000-8000-000000000001', 'teacher', 'active'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', '0e5f1a10-0000-4000-8000-000000000001', 'staff',   'active'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', '0e5f1a10-0000-4000-8000-000000000001', 'student', 'active'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '0e5f1a10-0000-4000-8000-000000000002', 'staff',   'active')
on conflict (id) do nothing;

insert into public.employers (id, name, organisation_id) values
  ('c0000000-0000-4000-8000-000000000001', 'Celadon', '0e5f1a10-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'OtherCo', '0e5f1a10-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.students (id, employer_id, name, email) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Phuong', 'phuong@example.test')
on conflict (id) do update set employer_id = excluded.employer_id;

insert into public.teachers (id, auth_user_id, full_name, email) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Coach Linh', 'coach@example.test')
on conflict (id) do nothing;

insert into public.student_teacher_assignments (student_id, teacher_id)
values ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001')
on conflict do nothing;

-- ── current_org_role + org_is_owner_or_hr ────────────────────────────────────

do $$
declare
  owner_role   text;
  hr_role      text;
  outsider_role text;
  is_own bool; is_hr bool; is_staff bool;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  is_own := public.org_is_owner_or_hr('0e5f1a10-0000-4000-8000-000000000001');
  select public.current_org_role('0e5f1a10-0000-4000-8000-000000000001') into owner_role;
  if is_own is not true then
    raise exception 'FAIL: owner must pass org_is_owner_or_hr';
  end if;
  if owner_role <> 'owner' then
    raise exception 'FAIL: owner role resolved to %', owner_role;
  end if;

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  is_hr := public.org_is_owner_or_hr('0e5f1a10-0000-4000-8000-000000000001');
  select public.current_org_role('0e5f1a10-0000-4000-8000-000000000001') into hr_role;
  if is_hr is not true then
    raise exception 'FAIL: hr must pass org_is_owner_or_hr';
  end if;
  if hr_role <> 'hr' then
    raise exception 'FAIL: hr role resolved to %', hr_role;
  end if;

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  is_staff := public.org_is_owner_or_hr('0e5f1a10-0000-4000-8000-000000000001');
  if is_staff is not false then
    raise exception 'FAIL: staff must NOT pass org_is_owner_or_hr';
  end if;

  -- outsider in a different org resolves NULL for celadon (no membership + not status active)
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000006', true);
  select public.current_org_role('0e5f1a10-0000-4000-8000-000000000001') into outsider_role;
  if outsider_role is not null then
    raise exception 'FAIL: outsider must have NULL role in celadon, got %', outsider_role;
  end if;

  raise notice 'ok: current_org_role / org_is_owner_or_hr';
end;
$$;

-- ── org_can_view_student ─────────────────────────────────────────────────────

do $$
declare
  can_eq boolean;
begin
  -- owner sees Phuong
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  can_eq := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if can_eq is not true then
    raise exception 'FAIL: owner must see Phuong';
  end if;

  -- hr sees Phuong
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  can_eq := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if can_eq is not true then
    raise exception 'FAIL: hr must see Phuong';
  end if;

  -- assigned teacher sees Phuong (via teachers.auth_user_id indirection)
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
  can_eq := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if can_eq is not true then
    raise exception 'FAIL: assigned teacher must see Phuong';
  end if;

  -- staff does NOT see a colleague's student
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  can_eq := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if can_eq is not false then
    raise exception 'FAIL: staff must NOT see Phuong';
  end if;

  -- outsider (different org) does NOT see Phuong
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000006', true);
  can_eq := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if can_eq is not false then
    raise exception 'FAIL: outsider must NOT see Phuong';
  end if;

  raise notice 'ok: org_can_view_student across all five roles';
end;
$$;

-- ── RLS: organisations — members see own org only ────────────────────────────

begin;
select pg_temp.assert_eq(
  pg_temp.visible_org_count(
    'a0000000-0000-4000-8000-000000000002', 'hr@example.test'),
  1, 'hr sees only their own organisation');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_org_count(
    'a0000000-0000-4000-8000-000000000005', 'student@example.test'),
  1, 'student sees only their own organisation');
commit;

-- non-member sees zero orgs owned by them
begin;
select pg_temp.assert_eq(
  pg_temp.visible_org_count(
    'a0000000-0000-4000-8000-00000000ffff', 'nobody@example.test'),
  0, 'non-member sees zero organisations');
commit;

-- ── RLS: memberships — self-select + owner/hr see all org members ────────────

begin;
select pg_temp.assert_eq(
  pg_temp.visible_membership_count(
    'a0000000-0000-4000-8000-000000000005', 'student@example.test'),
  1, 'student sees only their own membership');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_membership_count(
    'a0000000-0000-4000-8000-000000000001', 'owner@example.test'),
  5, 'owner sees all celadon members');
commit;

-- outsider in another org sees only their own membership
begin;
select pg_temp.assert_eq(
  pg_temp.visible_membership_count(
    'a0000000-0000-4000-8000-000000000006', 'outsider@example.test'),
  1, 'outsider sees only their own membership');
commit;

-- ── Append-only guard: no UPDATE/DELETE policies exist on memberships ────────
-- Absence of a policy is a denial; confirm no update/delete policies exist.
do $$
declare
  n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('organisation_memberships','platform_admins')
    and cmd in ('UPDATE','DELETE');
  if n <> 0 then
    raise exception 'FAIL: update/delete policies must not exist on org tables, found %', n;
  end if;
  raise notice 'ok: no update/delete policies on org tables (writes are service-role)';
end;
$$;