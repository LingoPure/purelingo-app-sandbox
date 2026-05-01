-- 0013_role_profile_json.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Add roles.profile_json — the rich, structured output from the AI
-- role-discovery interview.
--
-- Holds: responsibilities, vocabulary domain, per-skill rationale +
-- examples, notes for the lesson planner. Mirrors the discovery_sessions
-- .profile_json approach on the student side: roles.description stays
-- the human-readable one-liner; profile_json is what the lesson
-- generator + dashboard rationale tooltips read.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.roles
  add column if not exists profile_json jsonb;
