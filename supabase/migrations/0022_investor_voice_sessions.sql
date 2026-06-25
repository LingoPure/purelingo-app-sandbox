-- Investor voice (Morgan) — server-trusted conversation→investor binding.
--
-- The VoiceWidget connects directly to ElevenLabs with the public agent id (no
-- per-session server token), so the post-call webhook cannot trust the
-- client-supplied `user_id` dynamic variable to label whose memory a call
-- belongs to. On connect, the authenticated browser POSTs the ElevenLabs
-- conversation id to /api/investor/voice/bind, which writes a row here under the
-- session-derived investor id. The post-call webhook then resolves the investor
-- from THIS table (server-trusted) rather than the LLM/client channel — the
-- blessed identity pattern from @caistech/elevenlabs-convai's VoiceWidget note.
--
-- This binds memory only (Morgan is a clarifier with no tier-gated data egress),
-- but we keep identity server-owned regardless, so a tampered client can never
-- write into another investor's voice memory.

create table if not exists public.investor_voice_sessions (
  elevenlabs_conversation_id text primary key,
  investor_id uuid not null references public.investors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists investor_voice_sessions_investor_idx
  on public.investor_voice_sessions(investor_id);

-- RLS on, no anon/authenticated policies: every read/write is server-mediated
-- via the service-role client (bind route + post-call webhook). Same posture as
-- the rest of the dataroom tables.
alter table public.investor_voice_sessions enable row level security;
