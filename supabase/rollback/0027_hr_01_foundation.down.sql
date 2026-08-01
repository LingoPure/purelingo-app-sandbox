-- 0027_hr_01_foundation.down.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback for 0027_hr_01_foundation.sql.
--
-- Lives in supabase/rollback/ rather than supabase/migrations/ on purpose: the
-- Supabase CLI applies everything it finds in the migrations directory, so a
-- down script sitting there would drop the schema it had just created.
--
-- Run manually:
--   psql "$DATABASE_URL" -f supabase/rollback/0027_hr_01_foundation.down.sql
--
-- ⚠️  DESTRUCTIVE. Drops every HR table and all data in them, including the
-- leave ledger — which is the audit trail for every balance movement. On a
-- sandbox holding fabricated seed data that costs nothing. Against an
-- environment holding real employee records it is unrecoverable without a
-- backup. Take one first.
--
-- The module is purely additive: it creates nothing outside the hr_ namespace
-- and alters no existing LingoPure table. So this file restores the database
-- exactly to its prior state, which is also what makes the module liftable.
-- ─────────────────────────────────────────────────────────────────────────────

-- Functions first: policies depend on them, and dropping a function a policy
-- still references would fail.
drop function if exists public.hr_can_approve_for(uuid);
drop function if exists public.hr_can_view_employee(uuid);
drop function if exists public.hr_current_org();
drop function if exists public.hr_current_role();
drop function if exists public.hr_current_employee();

-- Tables in reverse dependency order. CASCADE clears the policies, triggers,
-- indexes and foreign keys along with them.
drop table if exists public.hr_audit_log               cascade;
drop table if exists public.hr_working_day_overrides   cascade;
drop table if exists public.hr_public_holidays         cascade;
drop table if exists public.hr_leave_ledger            cascade;
drop table if exists public.hr_leave_requests          cascade;
drop table if exists public.hr_employee_entitlements   cascade;
drop table if exists public.hr_leave_types             cascade;
drop table if exists public.hr_employees               cascade;
drop table if exists public.hr_org_policy              cascade;
drop table if exists public.hr_organisations           cascade;

-- Last, since every table's trigger referenced it.
drop function if exists public.hr_touch_updated_at();
