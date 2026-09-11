-- 0030: LingoPure 2K — assessment session, response and processing-event tables.
-- Phase 0 contracts C01 (AssessmentSession), C02 (ResponseObject) + ISS-009
-- processing-event ledger (backs CommunicationAnalysisObject.event_id / /status).
--
-- Pipeline stage/status legality is enforced at the boundary by the TS state
-- machine (src/lib/2k/api-contract.ts assertTransition) — single source of
-- truth; SQL below constrains enum membership, referential integrity and
-- idempotency anchors only, so the two cannot drift on transition rules.
-- Rows are append-only for responses; transcripts/results freeze in later phases.

create extension if not exists "pgcrypto";

-- ─── 1. ASSESSMENT SESSIONS (C01) ─────────────────────────────────────────────
create table if not exists public.assessment_sessions (
  assessment_id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.students(id) on delete cascade,
  lead_id uuid,                                   -- pre-signup learners; no FK (leads table not guaranteed)
  session_id text not null,                       -- browser/device session
  language text not null default 'vi-VN',
  question_bank_version text not null,
  context jsonb not null default '{}',
  consent jsonb not null default '{}',
  status text not null default 'CREATED' check (status in (
    'CREATED','IN_PROGRESS','RESPONSES_COMPLETE','TRANSCRIBING','ANALYSING',
    'ADJUDICATING','RESOLVING_STATE','DIAGNOSING','RECOMMENDING','FREEZING',
    'COMPLETE','FAILED','RETRYING'
  )),
  processing_stage text check (processing_stage in (
    'INGESTION','TRANSCRIPTION','AUDIO_SIGNALS','COMMUNICATION_ANALYSIS',
    'EVIDENCE_GOVERNANCE','ADJUDICATION','STATE_RESOLUTION','TELEMETRY',
    'LP1000','DIAGNOSIS','RECOMMENDATION','FREEZE','COMPLETE'
  )),
  processing_error text,
  processing_retries integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

drop trigger if exists trg_assessment_sessions_updated on public.assessment_sessions;
create trigger trg_assessment_sessions_updated before update on public.assessment_sessions
  for each row execute function public.update_updated_at();

-- ─── 2. RESPONSES (C02) ───────────────────────────────────────────────────────
create table if not exists public.assessment_responses (
  response_id uuid primary key,                   -- client-generated — idempotency key
  assessment_id uuid not null references public.assessment_sessions(assessment_id) on delete cascade,
  question_id text not null,
  stage text not null check (stage in ('LOCATE','BOUND','RESOLVE','PERTURB','CONFIRM')),
  task text not null,
  receiver text,
  context text,
  audio_id text,
  client_transcript text,
  timing jsonb not null default '{}',
  device jsonb not null default '{}',
  assistance_status text not null default 'none' check (assistance_status in ('none','partial','full')),
  upload_status text not null default 'pending' check (upload_status in ('pending','uploaded','failed')),
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','complete','failed')),
  created_at timestamptz not null default now(),
  unique (assessment_id, question_id)
);

-- append-only: responses are immutable after ingest (re-submits carry a new
-- response_id or are idempotently ignored on the same id).
-- (Transcript/result immutability arrives with their own freeze migrations.)

-- ─── 3. PROCESSING EVENTS (ISS-009 ledger / C22) ─────────────────────────────
create table if not exists public.assessment_processing_events (
  event_id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_sessions(assessment_id) on delete cascade,
  from_status text,
  to_status text not null,
  from_stage text,
  to_stage text,
  action text not null,
  detail jsonb not null default '{}',
  terminal boolean not null default false,
  occurred_at timestamptz not null default now()
);

-- ─── 4. ROW LEVEL SECURITY ───────────────────────────────────────────────────
alter table public.assessment_sessions enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_processing_events enable row level security;

-- Sessions: owner reads + creates. Updates are pipeline-driven (service role).
drop policy if exists "assessment_sessions_self_select" on public.assessment_sessions;
create policy "assessment_sessions_self_select" on public.assessment_sessions
  for select to authenticated using (learner_id = auth.uid());
drop policy if exists "assessment_sessions_self_insert" on public.assessment_sessions;
create policy "assessment_sessions_self_insert" on public.assessment_sessions
  for insert to authenticated with check (learner_id = auth.uid());

-- Responses: owner read/create/update once the session is theirs.
drop policy if exists "assessment_responses_self_select" on public.assessment_responses;
create policy "assessment_responses_self_select" on public.assessment_responses
  for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_responses.assessment_id
       and s.learner_id = auth.uid()
  ));
drop policy if exists "assessment_responses_self_insert" on public.assessment_responses;
create policy "assessment_responses_self_insert" on public.assessment_responses
  for insert to authenticated
  with check (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_responses.assessment_id
       and s.learner_id = auth.uid()
  ));
drop policy if exists "assessment_responses_self_update" on public.assessment_responses;
create policy "assessment_responses_self_update" on public.assessment_responses
  for update to authenticated
  using (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_responses.assessment_id
       and s.learner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_responses.assessment_id
       and s.learner_id = auth.uid()
  ));

-- Events: owner reads only; writes come from the pipeline (service role).
drop policy if exists "assessment_processing_events_self_select" on public.assessment_processing_events;
create policy "assessment_processing_events_self_select" on public.assessment_processing_events
  for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_processing_events.assessment_id
       and s.learner_id = auth.uid()
  ));

-- ─── 5. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists assessment_sessions_learner_idx on public.assessment_sessions(learner_id);
create index if not exists assessment_sessions_learner_status_idx on public.assessment_sessions(learner_id, status);
create index if not exists assessment_sessions_language_idx on public.assessment_sessions(language);
create index if not exists assessment_responses_assessment_idx on public.assessment_responses(assessment_id);
create index if not exists assessment_processing_events_assessment_idx on public.assessment_processing_events(assessment_id);
create index if not exists assessment_processing_events_order_idx on public.assessment_processing_events(assessment_id, occurred_at);