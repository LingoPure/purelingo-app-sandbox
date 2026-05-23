-- 0018: upgrade convai_* schema for @caistech/elevenlabs-convai 0.3.x
--
-- 0.3.x handlePostCallWebhook (a) claims a once-only processed_at flag before running
-- side-effects, and (b) upserts transcript messages with
-- onConflict (conversation_id, message_index) for retry-safe dedup. LingoPure's 0002
-- schema has neither. This migration adds them.
--
-- Additive + safe on the live DB: no rows are touched. The unique index tolerates the
-- existing NULL message_index values (NULLs are distinct in Postgres); new 0.3.x rows
-- carry a non-null per-conversation ordinal. LingoPure's integration is post-call-only,
-- so the anon-session tables, RPC change, and pg_trgm/composite indexes from the full
-- hub template are intentionally omitted (unused by this code path).

-- Once-only post-call side-effect gate.
alter table public.convai_conversations
  add column if not exists processed_at timestamptz;

-- Dedup index for the 0.3.x retry-safe message upsert.
create unique index if not exists uq_convai_messages_conv_idx
  on public.convai_messages (conversation_id, message_index);
