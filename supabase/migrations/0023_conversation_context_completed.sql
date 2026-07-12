-- Fix voice recall: get_conversation_context only ever saw 'active' conversations.
--
-- The post-call webhook (@caistech/elevenlabs-convai webhook-handlers) writes a
-- finished call as status 'completed' (or 'abandoned'), and — for the investor
-- Morgan flow — that upsert is the ONLY write, so a Morgan conversation is never
-- 'active'. The original RPC (0002) filtered `c.status = 'active'`, so it found
-- nothing for a returning investor and returned has_history=false: the welcome-
-- back greeting AND the distilled memories (thesis/concerns/follow-ups) never
-- surfaced, even though they were being stored correctly.
--
-- Widen the "most recent conversation" lookup to include 'completed' (the normal
-- finished state). 'abandoned' is deliberately excluded — a dropped call is a
-- poor basis for "last time we were getting into X". Memory rows are unchanged
-- (they are gated on convai_memory.active, not conversation status).
--
-- Redefines the function verbatim from 0002 except the single status predicate.

create or replace function public.get_conversation_context(
  p_agent_id uuid,
  p_user_id uuid,
  p_message_limit integer default 20
)
returns json as $$
declare
  result json;
  last_conv record;
  time_gap interval;
begin
  select c.id, c.last_message_at, c.last_topic, c.summary, c.message_count, c.title
    into last_conv
    from public.convai_conversations c
   where c.agent_id = p_agent_id
     and c.user_id = p_user_id
     and c.status in ('active', 'completed')
   order by c.last_message_at desc nulls last
   limit 1;

  if last_conv.id is null then
    return json_build_object(
      'has_history', false,
      'recent_messages', '[]'::json,
      'memories', '[]'::json
    );
  end if;

  time_gap := now() - last_conv.last_message_at;

  select json_build_object(
    'has_history', true,
    'conversation_id', last_conv.id,
    'last_message_at', last_conv.last_message_at,
    'time_gap_seconds', extract(epoch from time_gap)::integer,
    'time_gap_category',
      case
        when time_gap < interval '1 hour' then 'recent'
        when time_gap < interval '1 day' then 'today'
        when time_gap < interval '7 days' then 'this_week'
        else 'older'
      end,
    'last_topic', last_conv.last_topic,
    'summary', last_conv.summary,
    'message_count', last_conv.message_count,
    'title', last_conv.title,
    'recent_messages', (
      select coalesce(json_agg(
        json_build_object(
          'id', m.id,
          'role', m.role,
          'content', m.content,
          'timestamp', m.timestamp
        ) order by m.timestamp desc
      ), '[]'::json)
      from (
        select * from public.convai_messages
         where conversation_id = last_conv.id
         order by timestamp desc
         limit p_message_limit
      ) m
    ),
    'memories', (
      select coalesce(json_agg(
        json_build_object(
          'id', mem.id,
          'type', mem.memory_type,
          'content', mem.content,
          'importance', mem.importance
        ) order by mem.importance desc
      ), '[]'::json)
      from (
        select * from public.convai_memory
         where agent_id = p_agent_id
           and user_id = p_user_id
           and active = true
         order by importance desc, created_at desc
         limit 10
      ) mem
    )
  ) into result;

  return result;
end;
$$ language plpgsql;
