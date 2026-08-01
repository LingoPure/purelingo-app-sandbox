-- Team calendar verification. Issue #7.
--
-- The one property that matters here: a Staff member can see THAT a colleague
-- is away without seeing WHY. The requirement asks for both halves, and the RLS
-- policy from 0027 correctly refuses the first, so hr_team_availability is the
-- deliberate exception. These assertions are what stop that exception widening.
--
-- Runs after rls-verify.sql against the same throwaway database, so the org and
-- the fixture employees already exist.

\set ON_ERROR_STOP on

-- ── The projection cannot expose a reason, at the type level ────────────────
-- Not "does not currently select it" — cannot. If someone adds `reason` to the
-- return type later, this fails, which is the point.
do $$
declare
  leaked text;
begin
  select string_agg(p.proname || '.' || arg, ', ')
    into leaked
  from pg_proc p
  cross join lateral unnest(
    coalesce(p.proargnames, array[]::text[])
  ) as arg
  where p.proname = 'hr_team_availability'
    and arg in ('reason', 'decision_note', 'cancellation_reason');

  if leaked is not null then
    raise exception 'FAIL: hr_team_availability exposes % — leave reasons must never be in this projection', leaked;
  end if;
  raise notice 'ok: hr_team_availability has no reason column in its return type';
end;
$$;

-- ── Fixtures: one approved and one pending request for Chi (managed by Ann) ──
insert into public.hr_leave_requests
  (id, org_id, employee_id, leave_type_id, start_date, end_date, requested_days,
   reason, status, decided_by, decided_at)
select 'd0000000-0000-4000-8000-000000000001',
       '0e5f1a10-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000004',
       lt.id, '2026-09-07', '2026-09-08', 2.0,
       'PRIVATE MEDICAL DETAIL', 'approved',
       'b0000000-0000-4000-8000-000000000002', now()
from public.hr_leave_types lt
where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'sick'
on conflict (id) do nothing;

insert into public.hr_leave_requests
  (id, org_id, employee_id, leave_type_id, start_date, end_date, requested_days,
   reason, status)
select 'd0000000-0000-4000-8000-000000000002',
       '0e5f1a10-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000004',
       lt.id, '2026-09-21', '2026-09-22', 2.0,
       'PRIVATE PLANS', 'pending'
from public.hr_leave_types lt
where lt.org_id = '0e5f1a10-0000-4000-8000-000000000001' and lt.code = 'annual'
on conflict (id) do nothing;

create or replace function pg_temp.availability_as(
  p_sub uuid, p_email text, p_from date, p_to date
) returns table (request_id uuid, status text)
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub::text, true);
  perform set_config('request.jwt.claim.email', p_email, true);
  set local role authenticated;
  return query
    select a.request_id, a.status
    from public.hr_team_availability(p_from, p_to) a;
  reset role;
end;
$$;

-- ── A colleague sees the ABSENCE ────────────────────────────────────────────
-- Dung is a peer of Chi with no management relationship. Under the normal RLS
-- policy Dung sees none of Chi's requests at all; through this projection Dung
-- can see that Chi is away, which is what a shared calendar is for.
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000005', 'staff2@example.test',
    '2026-09-01', '2026-09-30');
  if n <> 1 then
    raise exception 'FAIL: a peer should see exactly the 1 APPROVED absence, saw %', n;
  end if;
  raise notice 'ok: a peer sees the approved absence';
end;
$$;

-- ── ...but NOT the pending request ──────────────────────────────────────────
-- A pending request is a plan, not a fact. Broadcasting one before a decision
-- invites exactly the pressure the approval step exists to avoid.
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000005', 'staff2@example.test',
    '2026-09-01', '2026-09-30') where status = 'pending';
  if n <> 0 then
    raise exception 'FAIL: a peer must not see pending requests, saw %', n;
  end if;
  raise notice 'ok: a peer sees no pending requests';
end;
$$;

-- ── The manager DOES see the pending one ────────────────────────────────────
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000002', 'admin1@example.test',
    '2026-09-01', '2026-09-30') where status = 'pending';
  if n <> 1 then
    raise exception 'FAIL: the assigned manager should see 1 pending request, saw %', n;
  end if;
  raise notice 'ok: the assigned manager sees the pending request';
end;
$$;

-- ── A manager of a DIFFERENT team does not ──────────────────────────────────
-- Bao is an admin, so the role test passes; hr_can_view_employee is what stops
-- them. Without that second condition every manager would see every team's
-- pending leave.
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000003', 'admin2@example.test',
    '2026-09-01', '2026-09-30') where status = 'pending';
  if n <> 0 then
    raise exception 'FAIL: a manager of another team must not see pending requests, saw %', n;
  end if;
  raise notice 'ok: a manager of another team sees no pending requests';
end;
$$;

-- ── Cross-org isolation holds through the projection ────────────────────────
-- A SECURITY DEFINER function runs with elevated rights, so it must re-apply
-- the org scope itself. Forgetting that here would leak every organisation's
-- calendar to every other one.
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000006', 'otherorg@example.test',
    '2026-09-01', '2026-09-30');
  if n <> 0 then
    raise exception 'FAIL: another org saw % rows through hr_team_availability', n;
  end if;
  raise notice 'ok: cross-org isolation holds through the projection';
end;
$$;

-- ── Overlap, not containment ────────────────────────────────────────────────
-- A request running 7-8 September must appear on a calendar window covering
-- only the 8th. Getting this wrong makes multi-day leave vanish from the middle
-- of a month view.
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-000000000005', 'staff2@example.test',
    '2026-09-08', '2026-09-08');
  if n <> 1 then
    raise exception 'FAIL: a straddling request must appear in a narrow window, saw %', n;
  end if;
  raise notice 'ok: a request straddling the window edge still appears';
end;
$$;

-- ── A non-employee sees nothing ─────────────────────────────────────────────
do $$
declare
  n int;
begin
  select count(*) into n from pg_temp.availability_as(
    'a0000000-0000-4000-8000-00000000ffff', 'nobody@example.test',
    '2026-09-01', '2026-09-30');
  if n <> 0 then
    raise exception 'FAIL: a non-employee saw % rows', n;
  end if;
  raise notice 'ok: a non-employee sees nothing';
end;
$$;

-- ── The working-day override table accepts both directions ─────────────────
do $$
begin
  insert into public.hr_working_day_overrides (org_id, date, is_working_day, note)
  values ('0e5f1a10-0000-4000-8000-000000000001', '2026-09-12', true, 'lam bu for National Day');
  insert into public.hr_working_day_overrides (org_id, date, is_working_day, note)
  values ('0e5f1a10-0000-4000-8000-000000000001', '2026-09-14', false, 'company closure');
  raise notice 'ok: working-day overrides record both worked and closed';

  begin
    insert into public.hr_working_day_overrides (org_id, date, is_working_day)
    values ('0e5f1a10-0000-4000-8000-000000000001', '2026-09-12', false);
    raise exception 'FAIL: two overrides accepted for one date';
  exception
    when unique_violation then
      raise notice 'ok: one override per date';
  end;
end;
$$;

\echo 'ALL HR CALENDAR CHECKS PASSED'
