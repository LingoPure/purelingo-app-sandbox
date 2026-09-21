-- 0059_plan_report_sent_at.sql
-- ISS-064/065: fire the "your sample programme is ready" email exactly once
-- per student, the same guard pattern as students.battery_report_sent_at
-- (migration 0048). The plan itself is never persisted (buildPlan() derives
-- it live from gap_scores on every /plan visit — see plan-delivery.ts), so
-- this column is the only state needed to make the email idempotent.

alter table public.students
  add column if not exists plan_report_sent_at timestamptz;
