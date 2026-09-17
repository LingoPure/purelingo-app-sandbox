-- 0054 - convai connect-time context returns memories first
--
-- Replaces the 0002 get_conversation_context with the canonical one from
-- @caistech/elevenlabs-convai 0.16.0:
--   * memories are gathered FIRST, independent of any conversation row, so a
--     user's saved facts surface even when no prior conversation exists;
--   * the memory filter is (agent_id = p_agent_id OR agent_id IS NULL), because
--     the server-baked uid identity path stores agent_id NULL. The old strict
--     gent_id = p_agent_id hid exactly those rows from the connect-time
--     context while has_history still reported true - "recall works mid-call,
--     the next session knows nothing".
--
-- Source of truth: node_modules/@caistech/elevenlabs-convai/migration.sql
-- (function get_conversation_context). Keep in sync on package upgrades.
CREATE OR REPLACE FUNCTION public.get_conversation_context(
  p_agent_id UUID,
  p_user_id UUID,
  p_message_limit INTEGER DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  last_conv RECORD;
  time_gap INTERVAL;
  memories_json JSON;
BEGIN
  -- Memories first — always, regardless of any conversation's status.
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', mem.id,
      'type', mem.memory_type,
      'content', mem.content,
      'importance', mem.importance
    ) ORDER BY mem.importance DESC
  ), '[]'::json)
  INTO memories_json
  FROM (
    SELECT * FROM convai_memory
    -- agent_id IS NULL is INCLUDED on purpose, and it is the fix for the failure users actually
    -- report: recall works mid-call, and the next session knows nothing.
    --
    -- The server-baked identity path (`resolveToolIdentity`) documents agentId as OPTIONAL — omit it
    -- and recall spans the whole user, which is the correct choice for one-agent-per-user. So
    -- handleSaveMemory inserts agent_id NULL for every fact the agent saves through its tools. A
    -- strict `agent_id = p_agent_id` then hides exactly those rows from the connect-time context,
    -- while `has_history` still reports true off the conversation row — the agent is told it has met
    -- you and handed nothing to say about it.
    WHERE (agent_id = p_agent_id OR agent_id IS NULL)
      AND user_id = p_user_id
      AND active = true
    ORDER BY importance DESC, created_at DESC
    LIMIT 10
  ) mem;

  -- Most recent conversation across ANY status (active OR completed OR abandoned).
  SELECT
    c.id,
    c.last_message_at,
    c.last_topic,
    c.summary,
    c.message_count,
    c.title
  INTO last_conv
  FROM convai_conversations c
  WHERE c.agent_id = p_agent_id
    AND c.user_id = p_user_id
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 1;

  IF last_conv.id IS NULL THEN
    RETURN json_build_object(
      'has_history', false,
      'recent_messages', '[]'::json,
      'memories', memories_json
    );
  END IF;

  time_gap := NOW() - last_conv.last_message_at;

  SELECT json_build_object(
    'has_history', true,
    'conversation_id', last_conv.id,
    'last_message_at', last_conv.last_message_at,
    'time_gap_seconds', EXTRACT(EPOCH FROM time_gap)::INTEGER,
    'time_gap_category',
      CASE
        WHEN last_conv.last_message_at IS NULL THEN 'new'
        WHEN time_gap < INTERVAL '1 hour' THEN 'recent'
        WHEN time_gap < INTERVAL '1 day' THEN 'today'
        WHEN time_gap < INTERVAL '7 days' THEN 'this_week'
        ELSE 'older'
      END,
    'last_topic', last_conv.last_topic,
    'summary', last_conv.summary,
    'message_count', last_conv.message_count,
    'title', last_conv.title,
    'recent_messages', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'role', m.role,
          'content', m.content,
          'timestamp', m.timestamp
        ) ORDER BY m.timestamp DESC
      ), '[]'::json)
      FROM (
        SELECT * FROM convai_messages
        WHERE conversation_id = last_conv.id
        ORDER BY timestamp DESC
        LIMIT p_message_limit
      ) m
    ),
    'memories', memories_json
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;