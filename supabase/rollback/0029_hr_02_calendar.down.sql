-- 0029_hr_02_calendar.down.sql
-- Rollback for 0029_hr_02_calendar.sql.
--
-- Lives in supabase/rollback/ rather than supabase/migrations/ on purpose: the
-- Supabase CLI applies everything it finds in the migrations directory.
--
-- Safe. This migration added only a read projection and two indexes; no table,
-- column or row is touched, so dropping them loses no data. The team calendar
-- stops working until it is re-applied.

drop function if exists public.hr_team_availability(date, date);
drop index if exists public.hr_leave_requests_calendar_idx;
drop index if exists public.hr_public_holidays_pending_notice_idx;
