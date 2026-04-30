-- Add a unique constraint on discovery_sessions.convai_conversation_id so the
-- post-call webhook can upsert idempotently keyed on the ElevenLabs conversation
-- ID. Without this, a re-fired webhook would create duplicate rows.

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'discovery_sessions_convai_conversation_id_unique'
  ) then
    alter table public.discovery_sessions
      add constraint discovery_sessions_convai_conversation_id_unique
      unique (convai_conversation_id);
  end if;
end $$;
