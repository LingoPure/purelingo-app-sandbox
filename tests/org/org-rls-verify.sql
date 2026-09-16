-- RLS + SECURITY DEFINER budget verification for the org model (0038).
--
-- Runs against a throwaway Postgres seeded by tests/org/supabase-shim.sql plus
-- migrations 0001, 0004, 0007, 0014, 0030–0045, 0049. Every check RAISEs on
-- failure, so a non-zero psql exit means the gate layer is broken.
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
  ('a0000000-0000-4000-8000-000000000007', 'teacherb@example.test'),
  ('a0000000-0000-4000-8000-000000000008', 'platform-admin@example.test'),
  ('3c000000-0000-4000-8000-000000000001', 'student-other@example.test'),
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
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '0e5f1a10-0000-4000-8000-000000000002', 'staff',   'active'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', '0e5f1a10-0000-4000-8000-000000000002', 'teacher', 'active')
on conflict (id) do nothing;

insert into public.employers (id, name, organisation_id) values
  ('c0000000-0000-4000-8000-000000000001', 'Celadon', '0e5f1a10-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'OtherCo', '0e5f1a10-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.students (id, employer_id, name, email) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Phuong', 'phuong@example.test'),
  ('3c000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'OtherCo Student', 'student-other@example.test')
on conflict (id) do update set employer_id = excluded.employer_id;

insert into public.teachers (id, auth_user_id, full_name, email) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Coach Linh', 'coach@example.test'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007', 'Coach Binh', 'coach-b@example.test')
on conflict (id) do nothing;

insert into public.student_teacher_assignments (id, student_id, teacher_id, assignment_role) values
  ('c0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'primary'),
  ('c0000000-0000-4000-8000-000000000012', '3c000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'primary')
on conflict (id) do nothing;

-- C3: synthetic billing + onboarding state fixtures (0041/0042). Org members
-- (any active membership role) must see Celadon's subscription + onboarding;
-- the cross-org member must see neither.
insert into public.subscriptions
  (organisation_id, package, tier, status, price_monthly, currency)
values
  ('0e5f1a10-0000-4000-8000-000000000001', '1:1 Tutoring', 'standard', 'active', 1500.00, 'AUD')
on conflict (organisation_id) do nothing;

insert into public.org_onboarding (organisation_id, step, package) values
  ('0e5f1a10-0000-4000-8000-000000000001', 'departments', 'Full BPO')
on conflict (organisation_id) do nothing;

insert into public.platform_admins (user_id) values
  ('a0000000-0000-4000-8000-000000000008')
on conflict (user_id) do nothing;

-- C3: department fixture + membership linkage (0043).
insert into public.organisation_departments (id, organisation_id, name) values
  ('c0000000-0000-4000-8000-000000000021', '0e5f1a10-0000-4000-8000-000000000001', 'Inbound')
on conflict (organisation_id, name) do nothing;

update public.organisation_memberships
  set department_id = 'c0000000-0000-4000-8000-000000000021'
  where id = 'b0000000-0000-4000-8000-000000000004';

-- TeacherB is in Celadon but assigned to the OtherCo student — the org gate
-- grants visibility (teacher → student via assignment_id), NOT org membership
-- of the teacher.  This fixture proves that teacher membership + assignment
-- is the correct boundary, not employer co-location.

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

-- ── RLS: assessment_sessions / assessment_responses (2K, 0030 + 0040 org view) ─
-- Phuong owns two cells: one COMPLETE (with a response row) and one FAILED.
-- otherco2 owns one COMPLETE cell (different org, never visible to Celadon).
-- Each role is impersonated through auth.uid() and queried DIRECTLY, proving
-- the org_can_view_student policies (0040) are enforced by the database.

insert into public.assessment_sessions
  (assessment_id, learner_id, session_id, language, question_bank_version,
   context, consent, status, processing_stage, completed_at, created_at, updated_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'sess-1', 'vi-VN', 'v1', '{}', '{}', 'COMPLETE', 'COMPLETE', now(), now(), now()),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'sess-2', 'vi-VN', 'v1', '{}', '{}', 'FAILED',   'COMPLETE', null, now(), now()),
  ('f0000000-0000-4000-8000-000000000003', '3c000000-0000-4000-8000-000000000001', 'sess-3', 'vi-VN', 'v1', '{}', '{}', 'COMPLETE', 'COMPLETE', now(), now(), now())
on conflict (assessment_id) do nothing;

insert into public.assessment_responses
  (response_id, assessment_id, question_id, stage, task, receiver, context,
   client_transcript, timing, device, assistance_status, upload_status,
   processing_status, created_at)
values
  ('f0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001', 'q-locate-1', 'LOCATE', 'Locate the goal', 'managed-hr', 'time-pressured', 'I need a status update by end of day.', '{}', '{}', 'none', 'uploaded', 'complete', now()),
  ('f0000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000003', 'q-locate-1', 'LOCATE', 'Locate the goal', 'managed-hr', 'time-pressured', 'Please resend the brief.',                 '{}', '{}', 'none', 'uploaded', 'complete', now())
on conflict (response_id) do nothing;

-- teacher_notes fixtures (0045): one note by the Celadon assigned teacher on
-- Phuong, one by the OtherCo teacherB on the OtherCo student.
insert into public.teacher_notes (id, teacher_id, student_id, body, created_at)
values
  ('f0000000-0000-4000-8000-000000000101', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Celadon teacher note on Phuong.', now()),
  ('f0000000-0000-4000-8000-000000000102', 'e0000000-0000-4000-8000-000000000002', '3c000000-0000-4000-8000-000000000001', 'OtherCo teacher note.', now())
on conflict (id) do nothing;

-- classin_sessions fixtures (0001 + 0004 + 0049): one scheduled session for
-- Phuong (Celadon) and one for the OtherCo student — the 0049 org/teacher
-- read gate must expose only the former to Celadon org roles.
insert into public.classin_sessions
  (id, student_id, classin_class_id, scheduled_at, status)
values
  ('f0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000001', 'cls-phuong-1', now() + interval '1 day', 'scheduled'),
  ('f0000000-0000-4000-8000-000000000202', '3c000000-0000-4000-8000-000000000001', 'cls-other-1', now() + interval '2 days', 'scheduled')
on conflict (id) do nothing;

-- ── RLS: assessment_sessions / assessment_responses — per-role visibility ────
-- The COMPLETE-gating loaders (src/lib/2k/journey-data.ts) resolve
-- org_can_view_student BEFORE querying. These assertions impersonate each
-- role through auth.uid() and query the tables DIRECTLY, proving the database
-- itself returns no rows the gate denies — whatever the UI loaders do.

-- Count the sessions a user can SEE through RLS.
create or replace function pg_temp.visible_session_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.assessment_sessions;
  reset role;
  return n;
end;
$$;

-- Count the responses a user can SEE through RLS.
create or replace function pg_temp.visible_response_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.assessment_responses;
  reset role;
  return n;
end;
$$;

-- Count the teacher_notes a user can SEE through RLS (0045 org_can_view gate).
create or replace function pg_temp.visible_note_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.teacher_notes;
  reset role;
  return n;
end;
$$;

-- Count the classin_sessions a user can SEE through RLS (0049 org_can_view gate).
create or replace function pg_temp.visible_classin_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.classin_sessions;
  reset role;
  return n;
end;
$$;

-- Count the subscriptions a user can SEE through RLS.
create or replace function pg_temp.visible_subscription_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.subscriptions;
  reset role;
  return n;
end;
$$;

-- Count the onboarding-state rows a user can SEE through RLS.
create or replace function pg_temp.visible_onboarding_count(p_sub text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  select count(*) into n from public.org_onboarding;
  reset role;
  return n;
end;
$$;

-- org_can_view_student gate matrix: assigned teacher sees Phuong, an
-- unassigned Celadon teacher does not, and cross-org views never resolve.
do $$
declare is_ok boolean;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
  is_ok := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if is_ok is not true then raise exception 'FAIL: assigned teacher must see Phuong'; end if;
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000007', true);
  is_ok := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  if is_ok is not false then raise exception 'FAIL: unassigned Celadon teacher must NOT see Phuong'; end if;
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  is_ok := public.org_can_view_student('3c000000-0000-4000-8000-000000000001');
  if is_ok is not false then raise exception 'FAIL: Celadon owner must NOT see OtherCo student'; end if;
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000007', true);
  is_ok := public.org_can_view_student('3c000000-0000-4000-8000-000000000001');
  if is_ok is not true then raise exception 'FAIL: OtherCo teacher must see their assigned student'; end if;
  raise notice 'ok: org_can_view_student gate matrix (assigned / unassigned / cross-org)';
end;
$$;

-- ── teacher_report_context (0040) — the §7 assignment link for the A3 report ──
-- The report page's single RPC must surface BOTH the boolean gate AND the
-- teacher→student assignment link (viewer_teacher_id / viewer_assignment_role /
-- primary_teacher / owning org). Fail-closed: unauthorized viewer gets
-- can_view = false and no identity fields.

do $$
declare
  r jsonb;
begin
  -- Assigned primary teacher → gate + assignment link + org identity.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
  r := public.teacher_report_context('d0000000-0000-4000-8000-000000000001');
  if (r->>'can_view')::boolean is not true then raise exception 'FAIL: primary teacher can_view must be true'; end if;
  if r->>'viewer_org_role' is distinct from 'teacher' then raise exception 'FAIL: teacher viewer_org_role'; end if;
  if r->>'viewer_teacher_id' is distinct from 'e0000000-0000-4000-8000-000000000001' then raise exception 'FAIL: teacher viewer_teacher_id'; end if;
  if r->>'viewer_assignment_role' is distinct from 'primary' then raise exception 'FAIL: teacher viewer_assignment_role'; end if;
  if r->>'organisation_name' is distinct from 'Celadon BPO' then raise exception 'FAIL: teacher org identity'; end if;
  if r->'primary_teacher'->>'id' is distinct from 'e0000000-0000-4000-8000-000000000001' then raise exception 'FAIL: primary_teacher link'; end if;

  -- HR admin → gate true (org role), no direct assignment link, but the
  -- student's primary coach is exposed for the "who coaches this learner" UI.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  r := public.teacher_report_context('d0000000-0000-4000-8000-000000000001');
  if (r->>'can_view')::boolean is not true then raise exception 'FAIL: hr can_view must be true'; end if;
  if r->>'viewer_org_role' is distinct from 'hr' then raise exception 'FAIL: hr viewer_org_role'; end if;
  if r->>'viewer_assignment_role' is not null then raise exception 'FAIL: hr must have no assignment link'; end if;
  if r->'primary_teacher'->>'full_name' is distinct from 'Coach Linh' then raise exception 'FAIL: hr sees primary coach'; end if;

  -- Cross-org outsider → fail closed, no org identity leaked.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000006', true);
  r := public.teacher_report_context('d0000000-0000-4000-8000-000000000001');
  if (r->>'can_view')::boolean is not false then raise exception 'FAIL: outsider can_view must be false'; end if;
  if r->>'organisation_name' is not null then raise exception 'FAIL: outsider org identity leaked'; end if;
  if r->'primary_teacher' is not null then raise exception 'FAIL: outsider primary_teacher leaked'; end if;

  -- Assigned teacher on the OTHER-ORG student → assignment grants cross-org view.
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000007', true);
  r := public.teacher_report_context('3c000000-0000-4000-8000-000000000001');
  if (r->>'can_view')::boolean is not true then raise exception 'FAIL: cross-org assigned teacher can_view'; end if;
  if r->>'organisation_name' is distinct from 'OtherCo' then raise exception 'FAIL: cross-org teacher org identity'; end if;

  raise notice 'ok: teacher_report_context — gate + assignment link + org identity (0040)';
end;
$$;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000001'),
  2, 'owner sees both Phuong sessions (FAILED and COMPLETE) — status filtering is app-layer');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000002'),
  2, 'hr sees both Phuong sessions');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000003'),
  2, 'assigned teacher sees both Phuong sessions via assignment');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('d0000000-0000-4000-8000-000000000001'),
  2, 'learner sees their own two sessions (self via auth.uid)');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_classin_count('d0000000-0000-4000-8000-000000000001'),
  1, 'learner sees their own classin session (self via auth.uid)');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_note_count('d0000000-0000-4000-8000-000000000001'),
  1, 'learner sees the coach note on their own lesson (self via auth.uid)');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000007'),
  1, 'teacher sees only their OTHER-ORG assigned student''s session');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000004'),
  0, 'staff sees ZERO assessment sessions');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000006'),
  0, 'cross-org outsider sees ZERO assessment sessions');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000001'),
  1, 'owner sees only Phuong''s response');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000003'),
  1, 'assigned teacher sees only Phuong''s response');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000004'),
  0, 'staff sees ZERO assessment responses');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000006'),
  0, 'cross-org outsider sees ZERO assessment responses');
commit;

-- ── C3: synthetic billing + onboarding visibility (0041/0042), dept link (0043) ──

begin;
select pg_temp.assert_eq(
  pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000001'),
  1, 'owner sees their org subscription');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000006'),
  0, 'cross-org member sees ZERO subscriptions');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000002'),
  1, 'hr sees their org onboarding state');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000006'),
  0, 'cross-org member sees ZERO onboarding state');
commit;

do $$
declare
  dept uuid;
begin
  -- 0043: membership department link must persist.
  select department_id into dept
    from public.organisation_memberships
    where id = 'b0000000-0000-4000-8000-000000000004'
    and department_id is not null;
  if dept is null then
    raise exception 'FAIL: staff membership department link missing after 0043';
  end if;
  raise notice 'ok: membership department link persisted after 0043';
end;
$$;

-- C4: platform-admin read-all (0044) ────────────────────────────────────────
-- platform-admin@example.test (a...08) is NOT a member of any org, yet the
-- 0044 policies grant read-all on the org-model tables to platform_admins.

begin;
select pg_temp.assert_eq(
  pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000008', 'platform-admin@example.test'),
  2, 'platform admin sees ALL organisations');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000008', 'platform-admin@example.test'),
  7, 'platform admin sees ALL memberships');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000008'),
  1, 'platform admin sees ALL subscriptions');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000008'),
  1, 'platform admin sees ALL onboarding state');
commit;

begin;
select pg_temp.assert_eq(
  pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000006', 'outsider@example.test'),
  1, 'non-admin outsider still sees only their own org');
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

  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('assessment_sessions','assessment_responses','assessment_processing_events')
    and cmd in ('UPDATE','DELETE')
    and policyname <> 'assessment_responses_self_update';
  if n <> 0 then
    raise exception 'FAIL: unauthorized update/delete policies on 2K assessment tables, found %', n;
  end if;
  raise notice 'ok: no update/delete policies on 2K assessment tables (self_update kept)';

  -- C0 curriculum tables are append-only + service-role write (0037 trigger guards
  -- already block UPDATE/DELETE on completions/feedback/resets at the DB level).
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('curricula','curriculum_lessons','lesson_completions','tutor_feedback','curriculum_resets')
    and cmd in ('UPDATE','DELETE');
  if n <> 0 then
    raise exception 'FAIL: unauthorized update/delete policies on C0 curriculum tables, found %', n;
  end if;
  raise notice 'ok: no update/delete policies on C0 curriculum tables (writes are service-role)';
end;
$$;

-- ── C7: role × table visibility grid (RLS DB-verify) ────────────────────────
-- Exhaustive per-role matrix: each block proves exactly how many rows of each
-- core portal table a given role can see through RLS. The expectations encode
-- the C7 role-matrix spec (docs/ROLE_MATRIX.md); a drift in any count fails
-- the harness.

-- owner
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000001','owner@example.test'), 1, 'grid owner orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000001','owner@example.test'), 5, 'grid owner memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000001'), 1, 'grid owner subs');
select pg_temp.assert_eq(pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000001'), 1, 'grid owner onboarding');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000001'), 2, 'grid owner sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000001'), 1, 'grid owner responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000001'), 1, 'grid owner notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000001'), 1, 'grid owner classin');
commit;

-- hr
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000002','hr@example.test'), 1, 'grid hr orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000002','hr@example.test'), 5, 'grid hr memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000002'), 1, 'grid hr subs');
select pg_temp.assert_eq(pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000002'), 1, 'grid hr onboarding');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000002'), 2, 'grid hr sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000002'), 1, 'grid hr responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000002'), 1, 'grid hr notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000002'), 1, 'grid hr classin');
commit;

-- assigned teacher
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000003','teacher@example.test'), 1, 'grid teacher orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000003','teacher@example.test'), 1, 'grid teacher memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000003'), 1, 'grid teacher subs');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000003'), 2, 'grid teacher sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000003'), 1, 'grid teacher responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000003'), 1, 'grid teacher notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000003'), 1, 'grid teacher classin');
commit;

-- staff
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000004','staff@example.test'), 1, 'grid staff orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000004','staff@example.test'), 1, 'grid staff memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000004'), 1, 'grid staff subs');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000004'), 0, 'grid staff sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000004'), 0, 'grid staff responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000004'), 0, 'grid staff notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000004'), 0, 'grid staff classin');
commit;

-- student (a...05 in Celadon)
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000005','student@example.test'), 1, 'grid student orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000005','student@example.test'), 1, 'grid student memberships');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000005'), 0, 'grid student sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000005'), 0, 'grid student responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000005'), 0, 'grid student notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000005'), 0, 'grid student classin (no own sessions)');
commit;

-- cross-org outsider (OtherCo staff)
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000006','outsider@example.test'), 1, 'grid outsider orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000006','outsider@example.test'), 1, 'grid outsider memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000006'), 0, 'grid outsider subs');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000006'), 0, 'grid outsider sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000006'), 0, 'grid outsider responses');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000006'), 0, 'grid outsider classin');
commit;

-- teacherB — assigned to the OtherCo student (cross-org teacher gate via assignment)
begin;
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000007'), 1, 'grid teacherB sessions');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000007'), 1, 'grid teacherB responses');
select pg_temp.assert_eq(pg_temp.visible_note_count('a0000000-0000-4000-8000-000000000007'), 1, 'grid teacherB notes');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000007'), 1, 'grid teacherB classin');
commit;

-- platform admin (a...08, member of no org)
begin;
select pg_temp.assert_eq(pg_temp.visible_org_count('a0000000-0000-4000-8000-000000000008','platform-admin@example.test'), 2, 'grid platform-admin orgs');
select pg_temp.assert_eq(pg_temp.visible_membership_count('a0000000-0000-4000-8000-000000000008','platform-admin@example.test'), 7, 'grid platform-admin memberships');
select pg_temp.assert_eq(pg_temp.visible_subscription_count('a0000000-0000-4000-8000-000000000008'), 1, 'grid platform-admin subs');
select pg_temp.assert_eq(pg_temp.visible_onboarding_count('a0000000-0000-4000-8000-000000000008'), 1, 'grid platform-admin onboarding');
select pg_temp.assert_eq(pg_temp.visible_session_count('a0000000-0000-4000-8000-000000000008'), 0, 'grid platform-admin sessions (org-view only, no membership)');
select pg_temp.assert_eq(pg_temp.visible_response_count('a0000000-0000-4000-8000-000000000008'), 0, 'grid platform-admin responses');
select pg_temp.assert_eq(pg_temp.visible_classin_count('a0000000-0000-4000-8000-000000000008'), 0, 'grid platform-admin classin (no org membership)');
commit;

-- ── dept_can_view_student gate (current behaviour == org gate) ───────────────
-- 0038's dept_can_view_student carries the dept-scoped branch as a forward
-- hook (staff allocation lands, then students become dept-linked). Until then
-- the function must MATCH org_can_view_student for every fixture role.

do $$
declare
  v_org  boolean;
  v_dept boolean;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  perform set_config('request.jwt.claim.email', 'owner@example.test', true);
  set local role authenticated;
  v_org  := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  v_dept := public.dept_can_view_student('d0000000-0000-4000-8000-000000000001');
  reset role;
  if v_org is distinct from v_dept then raise exception 'FAIL: owner dept gate diverges'; end if;

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  perform set_config('request.jwt.claim.email', 'staff@example.test', true);
  set local role authenticated;
  v_org  := public.org_can_view_student('d0000000-0000-4000-8000-000000000001');
  v_dept := public.dept_can_view_student('d0000000-0000-4000-8000-000000000001');
  reset role;
  if v_org is distinct from v_dept then raise exception 'FAIL: staff dept gate diverges'; end if;

  raise notice 'ok: dept_can_view_student mirrors org_can_view_student (forward hook, pre-dept-linking)';
end;
$$;