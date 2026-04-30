-- Step 11 — multi-language UI.
-- Persist the student's chosen native UI language so they don't need to
-- re-pick it across sessions. Same value is also passed to Aria as a
-- dynamic variable so the discovery session opens in their language
-- before switching to English. Idempotent.

alter table public.students
  add column if not exists native_language text default 'vi';

-- Defensive: if the column already existed without a default, fill it.
update public.students set native_language = 'vi' where native_language is null;
