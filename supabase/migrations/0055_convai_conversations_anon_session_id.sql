-- 0055 — align convai_conversations + messages with the canonical convai schema
--
-- The shared @caistech/elevenlabs-convai handlers write columns our 0002 convai
-- spine predates:
--   * handleStartConversation inserts convai_conversations.anon_session_id — its
--     absence made every start_conversation fail with "Failed to create
--     conversation", which in turn silently disabled connect-time continuity.
--   * the mid-call and post-call message paths upsert against a
--     (conversation_id, message_index) unique index for retry-safe dedup.
--
-- Source of truth: node_modules/@caistech/elevenlabs-convai/migration.sql.
-- Idempotent so it is safe to re-run and safe on a DB that already has them.

alter table public.convai_conversations
  add column if not exists anon_session_id uuid
    references public.convai_anon_sessions(id) on delete cascade;

create unique index if not exists uq_convai_messages_conv_idx
  on public.convai_messages (conversation_id, message_index);