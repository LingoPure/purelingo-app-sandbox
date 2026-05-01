-- Native-language data flow: employer-configured with employee override.
--
-- Before this migration, students.native_language defaulted to 'vi' for
-- every row regardless of employer or context — the right call for a
-- Vietnam-first cohort, but it stamps English-speaking admins / global
-- rollouts wrong. After this migration:
--
--   1. Each employer carries a default_native_language (still 'vi' so
--      existing Vietnam-based orgs are unchanged).
--   2. New student rows do NOT auto-default; they're set explicitly at
--      invite/import time, falling through to the employer default,
--      and finally to UI language at read time if still empty.
--   3. The /onboarding step lets the employee confirm or change their
--      native language alongside the role-confirm picker — same
--      employer-prep + employee-confirm pattern role and target_level
--      already follow.
--
-- Existing students.native_language values are NOT touched; only the
-- column DEFAULT changes, so already-imported staff stay 'vi'.

alter table public.employers
  add column if not exists default_native_language text default 'vi';

-- Make existing employers explicit so reads never see NULL.
update public.employers
  set default_native_language = 'vi'
  where default_native_language is null;

alter table public.students
  alter column native_language drop default;
