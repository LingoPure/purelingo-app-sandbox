-- 0029_hr_02_calendar.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- HR & Leave module — team calendar. Issue #7 of EPIC #10.
--
-- THE PROBLEM THIS SOLVES.
--
-- The requirement asks for two things that pull in opposite directions:
--
--   "The calendar should show ... who is unavailable"
--   "Staff ... should not see private leave reasons or confidential information"
--
-- The RLS policy from 0027 (`hr_leave_requests_read` → hr_can_view_employee)
-- correctly limits a Staff member to their OWN requests, because a request row
-- carries `reason` — which for sick leave is health information. So a team
-- calendar built on that policy shows a Staff member an empty page.
--
-- The wrong fixes, and why:
--   • Loosen the RLS policy → exposes `reason`, `decision_note` and
--     `cancellation_reason` org-wide. Fails the second requirement outright.
--   • Query with the service-role client and drop columns in TypeScript →
--     the sensitive data crosses the boundary and is removed by remembering to.
--     One `select('*')` later it is on the wire again.
--
-- The fix: a SECURITY DEFINER function whose RETURN TYPE simply has no reason
-- column. The sensitive fields are structurally unreachable through it — not
-- filtered, not omitted by convention, absent. This is the "enforced by the
-- backend and not only hidden in the UI" requirement applied to a read.
--
-- WHAT IT RETURNS. Request-level rows, not one row per date. Expanding a range
-- into days needs the working-day rules (weekly pattern, holidays, `làm bù`
-- overrides), and those already live in `src/lib/hr/leave-days.ts`.
-- Reimplementing them in SQL would create a second copy that drifts from the
-- first, and the first is the one with 27 tests against it.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- hr_team_availability — who is away, without saying why.
--
-- APPROVED leave is visible org-wide: that is the point of a shared calendar,
-- and "Chi is off on Thursday" is information the team needs to function.
--
-- PENDING requests are visible only to someone who could act on them, per the
-- requirement ("Pending leave requests for Admin and Super Admin only") and
-- scoped further by hr_can_view_employee — a Manager sees their own team's
-- pending requests, not another team's. A pending request is a plan, not a
-- fact, and broadcasting one before a decision invites exactly the pressure
-- the approval step exists to avoid.
--
-- DECLINED and CANCELLED never appear. They hold no claim on the calendar.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.hr_team_availability(
  p_from date,
  p_to   date
)
returns table (
  request_id      uuid,
  employee_id     uuid,
  first_name      text,
  last_name       text,
  department      text,
  leave_type_id   uuid,
  leave_type_code text,
  start_date      date,
  end_date        date,
  start_half      text,
  end_half        text,
  status          text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    e.id,
    e.first_name,
    e.last_name,
    e.department,
    t.id,
    t.code,
    r.start_date,
    r.end_date,
    r.start_half,
    r.end_half,
    r.status
  from public.hr_leave_requests r
  join public.hr_employees   e on e.id = r.employee_id
  join public.hr_leave_types t on t.id = r.leave_type_id
  where e.org_id = public.hr_current_org()
    -- Overlap, not containment: a request running Monday to Friday must appear
    -- on a calendar showing only Wednesday.
    and r.start_date <= p_to
    and r.end_date   >= p_from
    and (
      r.status = 'approved'
      or (
        r.status = 'pending'
        and public.hr_current_role() in ('admin', 'super_admin')
        and public.hr_can_view_employee(e.id)
      )
    )
  order by r.start_date, e.first_name
$$;

-- Callable by any signed-in employee. hr_current_org() returns null for anyone
-- who is not one, so the org predicate matches nothing and they get an empty
-- set rather than an error.
grant execute on function public.hr_team_availability(date, date) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Supporting index for the calendar's month-range scan. The existing
-- hr_leave_requests_range_idx covers approved rows only; pending rows are read
-- by approvers on the same screen.
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists hr_leave_requests_calendar_idx
  on public.hr_leave_requests (org_id, start_date, end_date)
  where status in ('approved', 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- Holiday notification bookkeeping.
--
-- `notified_at` already exists on hr_public_holidays. This index makes the
-- cron's "which holidays are due a reminder and have not had one" query cheap,
-- and it is that `notified_at is null` predicate — not a timestamp comparison —
-- that stops a reminder going out twice when the job runs more than once a day.
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists hr_public_holidays_pending_notice_idx
  on public.hr_public_holidays (org_id, date)
  where notified_at is null;
