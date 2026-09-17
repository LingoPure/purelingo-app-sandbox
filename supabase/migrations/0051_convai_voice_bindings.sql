-- ConvAI voice bindings — server-trusted conversation→user identity for memory-loop tool routes.
--
-- The canonical memory-loop pattern (VOICE_MEMORY_STANDARD rule 9): identity is
-- established server-side at connect, never supplied by the client. On connect,
-- the authenticated browser POSTs the ElevenLabs conversation id to
-- /api/convai/bind, which writes a row here. The memory-loop tool routes
-- (start_conversation, recall_memory, save_memory) then resolve the user from
-- THIS table rather than trusting a client-supplied dynamic variable.
--
-- Generalized from investor_voice_sessions (0022) so any voice agent (discovery,
-- Morgan, future agents) uses the same bind pattern.

create table if not exists public.convai_voice_bindings (
  elevenlabs_conversation_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists convai_voice_bindings_user_idx
  on public.convai_voice_bindings(user_id);

-- RLS on, no anon/authenticated policies: every read/write is server-mediated
-- via the service-role client (bind route + webhook routes). Same posture as
-- investor_voice_sessions.
alter table public.convai_voice_bindings enable row level security;
