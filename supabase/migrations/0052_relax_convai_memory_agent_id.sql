-- 0052 — relax convai_memory.agent_id for server-baked uid identity
--
-- The memory-loop tool routes (save_memory / recall_memory) resolve identity
-- two ways:
--   1. conversation binding -> a convai_conversations row with a real agent
--   2. server-baked uid (the provisioning layer appends ?uid=) -> NO agent
--
-- The uid path is legitimate (the route is behind requireToolSecret), but
-- convai_memory.agent_id was NOT NULL, so an identity-only save failed with a
-- constraint violation while recall silently scoped to the user (it already
-- handles a null agent by spanning the user's whole memory). Relax the column
-- so the two paths behave consistently. agent_id stays FK'd when present.

alter table public.convai_memory
  alter column agent_id drop not null;