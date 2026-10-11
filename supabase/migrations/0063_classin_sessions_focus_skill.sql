-- 0063_classin_sessions_focus_skill.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- classin_sessions has no notion of WHAT a class is about — fine for the
-- pull side (post-session analytics don't need to know in advance), but the
-- new auto-scheduler (push direction, classin/scheduling.ts) needs it to:
--   1. avoid double-scheduling a live class for a skill that already has an
--      upcoming unscored slot, and
--   2. eventually hand a teacher a lesson brief for what to cover.
-- Nullable + idempotent — the existing manual "Schedule a class" demo button
-- path leaves it null, which is fine; only the auto-scheduler sets it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.classin_sessions
  add column if not exists focus_skill text;

create index if not exists classin_sessions_student_focus_idx
  on public.classin_sessions (student_id, focus_skill, status);
