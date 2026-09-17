-- 0053 — add convai_anon_sessions + convai_memory.anon_session_id
--
-- The shared @caistech/elevenlabs-convai handlers insert anon_session_id on
-- every memory write (handleSaveMemory: anon memory is single-call, authed
-- memory persists). Our 0002 convai spine predates that column, so every
-- save_memory call failed the insert and the handler returned a swallowed
-- success:false behind HTTP 200 — green status, nothing stored.
--
-- Reconcile with the package's canonical migration.sql:
--   * convai_anon_sessions (referenced by the new FK)
--   * convai_memory.anon_session_id UUID -> convai_anon_sessions(id)
--
-- Both statements are idempotent so this is safe to re-run.

create table if not exists public.convai_anon_sessions (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid references public.convai_agents(id) on delete cascade,
  elevenlabs_agent_id text,
  token_hash          text,
  created_at          timestamptz default now(),
  last_seen_at        timestamptz default now(),
  expires_at          timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_convai_anon_sessions_expires
  on public.convai_anon_sessions (expires_at);

alter table public.convai_memory
  add column if not exists anon_session_id uuid
    references public.convai_anon_sessions(id) on delete cascade;