-- 0009: extend nudges for the rule-based engine.
--
-- Adds the columns the rules engine + email sender need: rule, subject,
-- body, delivery_status. Existing rows keep working (channel/type still
-- there). RLS policy unchanged — students see their own nudges only.

alter table public.nudges
  add column if not exists rule text,
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists delivery_status text
    not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'failed', 'skipped'));

-- Idempotency: never raise the same rule for the same student more than
-- once per UTC day. The cron runs daily — if it re-fires (manual trigger,
-- retry) we don't want to spam the student. Using a generated date column
-- because Postgres needs IMMUTABLE expressions for unique-index keys and
-- `timestamptz::date` is only STABLE (depends on session TZ).
alter table public.nudges
  add column if not exists created_on date
  generated always as (((created_at at time zone 'UTC'))::date) stored;

create unique index if not exists nudges_dedup_idx
  on public.nudges (student_id, rule, created_on);

create index if not exists nudges_delivery_idx
  on public.nudges (delivery_status, created_at);
