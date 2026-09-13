-- 0048: LingoPure - Battery completion report email marker.
--
-- One-time flag on students: set when the Phase 0b battery-complete report
-- email is sent. Guards the report helper (fired per reconciled battery task)
-- so a completed battery sends the report exactly once.

alter table public.students
  add column if not exists battery_report_sent_at timestamptz;