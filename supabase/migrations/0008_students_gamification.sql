-- 0008: gamification columns on students.
--
-- xp + streak_days + last_active_date drive the dashboard "wow" tile and the
-- employer roster "engagement" column. They're plain integer/date columns —
-- no separate activity-log table for the demo. Real product would log every
-- event in a table; here we recompute streak on the fly when activity lands.

alter table students
  add column if not exists xp integer not null default 0,
  add column if not exists streak_days integer not null default 0,
  add column if not exists last_active_date date;

create index if not exists students_xp_idx on students (xp desc);
