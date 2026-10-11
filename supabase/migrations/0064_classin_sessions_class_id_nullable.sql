-- 0064_classin_sessions_class_id_nullable.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- classin_class_id was `not null` from the original schema (0001), which only
-- modeled the PULL direction: a session always already existed in ClassIn
-- before LingoPure recorded it, so it always had a real id by the time the
-- row was written (the demo "Schedule a class" button works around this by
-- minting a fake `demo-xxxxxxxx` placeholder — see
-- src/app/api/classin/sessions/route.ts).
--
-- The new auto-scheduler (push direction, classin/scheduling.ts) breaks that
-- assumption on purpose: it decides WHEN a live-tutor slot is needed and
-- writes the local row immediately, independent of whether the ClassIn push
-- succeeds — which today it never does, because ClassIn API credentials
-- aren't configured yet (createClass() unconditionally throws
-- ClassinUnavailableError; see src/lib/classin/api.ts). Writing `null` for
-- "not yet pushed to ClassIn" is the honest value here, not a fake id — a
-- fake-but-plausible string is worse data hygiene than a null, since it
-- could later be mistaken for a real ClassIn id.
--
-- Caught by scripts/synthetic-classin-cron-test.ts: every invocation of the
-- cron would have thrown `null value in column "classin_class_id" violates
-- not-null constraint` for every student, since no ClassIn credentials exist
-- in any environment yet. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.classin_sessions
  alter column classin_class_id drop not null;
