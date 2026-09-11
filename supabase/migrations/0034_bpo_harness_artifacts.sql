-- 0034: BPO Harness — workplace artifacts (BH-001).
-- Stores simulated/actual workplace communication artifacts (emails, calls, 
-- chats) before they are analysed by the Edge engine.
-- 
-- Rules:
--   - workplace_artifacts is append-only (no update/delete).
--   - pseudonymous_id matches the BPO's internal ID for the employee.
--   - source_type: EMAIL | CALL_TRANSCRIPT | CHAT (Phase 5 Proof of Concept).
--   - analysis_status: PENDING | ANALYSED | FAILED.

create table if not exists public.workplace_artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  pseudonymous_id text not null,                     -- BPO's internal ID
  source_type text not null check (
    source_type in ('EMAIL', 'CALL_TRANSCRIPT', 'CHAT')
  ),
  content text not null,                            -- the raw text or transcript
  metadata jsonb not null default '{}',             -- source-specific (e.g. subject, duration, role)
  analysis_status text not null default 'PENDING' check (
    analysis_status in ('PENDING', 'ANALYSED', 'FAILED')
  ),
  created_at timestamptz not null default now()
);

-- Index for the Edge engine to find unprocessed artifacts.
create index if not exists workplace_artifacts_pending_idx 
  on public.workplace_artifacts (employer_id, analysis_status) 
  where analysis_status = 'PENDING';

-- Index for pseudonym-based rollups.
create index if not exists workplace_artifacts_lookup_idx
  on public.workplace_artifacts (employer_id, pseudonymous_id);

-- Unique constraint for idempotent upserts.
create unique index if not exists workplace_artifacts_dedup_idx
  on public.workplace_artifacts (employer_id, pseudonymous_id, source_type, content);

-- RLS: Service role only (harness is a backend-to-backend simulation).
alter table public.workplace_artifacts enable row level security;
