-- 0046: LingoPure - Demo bookings (corporate proposal intake).
--
-- The Book-a-demo flow is the proposal intake for client companies. A senior
-- decision maker schedules a staff-led walkthrough of the FULL LingoPure
-- service offering and, in the same flow, supplies the organisation details
-- needed to generate a tailored proposal. The self-assessment funnel
-- (signup -> onboarding -> battery) is the "taste"; this table captures the
-- org-side discovery that turns a taste into a proposal.
--
-- Public write path: the server action inserts via the service-role client
-- (validation happens in the action), so NO anon/authenticated insert policy
-- is granted here. Reads: platform admins (admin console) only.
--
-- Additive + idempotent. Safe to re-run.

create table if not exists public.demo_bookings (
  id                    uuid primary key default gen_random_uuid(),

  -- Decision-maker contact (the booker)
  first_name            text not null,
  last_name             text not null,
  job_title             text,
  email                 text not null,
  phone                 text,
  preferred_contact     text,                -- Zalo / WhatsApp / Phone / Email

  -- Organisation discovery -> feeds proposal generation
  company               text not null,
  industry              text,
  company_size          text,                -- 1-49 / 50-199 / 200-499 / 500+
  hq_market             text,                -- Vietnam / South East Asia / Global / Other
  target_learners       integer,
  learner_roles         text,                -- departments / roles to be trained
  english_levels        text[],              -- CEFR baseline estimate (A1-A2 / B1 / B2 / C1-C2 / Not sure)
  current_training      text,                -- None / In-house / External provider / Not sure
  current_provider      text,
  goals                 text[],              -- 1-3 of the learning goals
  why_now               text,                -- the trigger behind the enquiry
  start_timeline        text,                -- ASAP / 1-3 months / 3-6 months / Just exploring
  decision_timeframe    text,                -- weeks until a decision / stakeholder path
  rep_referral_email    text,                -- optional: which colleague's self-assessment preceded this

  -- Scheduling for the staff-led demo
  preferred_date        date,
  preferred_time        text,
  timezone              text not null default 'UTC+7 (ICT)',
  notes                 text,

  status                text not null default 'new',
  source                text not null default 'website',
  raw                   jsonb,               -- full submitted payload, forward-compatible

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists demo_bookings_updated_at on public.demo_bookings;
create trigger demo_bookings_updated_at
  before update on public.demo_bookings
  for each row execute function public.update_updated_at();

alter table public.demo_bookings enable row level security;

-- Platform admins (the /admin console) can list and update requests. No
-- public/authenticated insert policy: writes flow through the service-role
-- server action only.
drop policy if exists "demo_bookings_admin_read" on public.demo_bookings;
create policy "demo_bookings_admin_read"
  on public.demo_bookings for select to authenticated
  using (public.platform_is_admin());

drop policy if exists "demo_bookings_admin_update" on public.demo_bookings;
create policy "demo_bookings_admin_update"
  on public.demo_bookings for update to authenticated
  using (public.platform_is_admin());