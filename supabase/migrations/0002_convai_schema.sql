-- ConvAI schema for ElevenLabs voice agents.
-- Adapted from @caistech/elevenlabs-convai/migration.sql v0.1.4 with
-- idempotent policies (DROP POLICY IF EXISTS).
--
-- Tables: convai_agents, convai_conversations, convai_messages, convai_memory.
-- Used by the LingoPure discovery session (briefing §07.1) — the discovery
-- agent + conversation are stored here; the post-call webhook then writes
-- a structured profile_json into public.discovery_sessions for gap scoring.

create extension if not exists "pgcrypto";

-- ─── HELPER: updated_at trigger function ──────────────────────────────────────
-- Note: this is a separate function from public.update_updated_at() in 0001 —
-- both coexist; the convai package expects this exact name.
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── 1. AGENTS ────────────────────────────────────────────────────────────────
create table if not exists public.convai_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_name text not null,
  elevenlabs_agent_id text unique not null,
  system_prompt text,
  first_message text,
  voice_id text,
  status text default 'active' check (status in ('active','inactive','paused','deleted')),
  total_conversations int default 0,
  total_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_conversation_at timestamptz
);

drop trigger if exists trg_convai_agents_updated on public.convai_agents;
create trigger trg_convai_agents_updated before update on public.convai_agents
  for each row execute function public.update_updated_at_column();

-- ─── 2. CONVERSATIONS ─────────────────────────────────────────────────────────
create table if not exists public.convai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null references public.convai_agents(id) on delete cascade,
  elevenlabs_conversation_id text unique,
  title text,
  status text default 'active' check (status in ('active','completed','abandoned')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int,
  transcript_text text,
  transcript_json jsonb,
  topics text[] default '{}',
  last_topic text,
  last_message_at timestamptz,
  message_count integer default 0,
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_convai_conversations_updated on public.convai_conversations;
create trigger trg_convai_conversations_updated before update on public.convai_conversations
  for each row execute function public.update_updated_at_column();

-- ─── 3. MESSAGES ──────────────────────────────────────────────────────────────
create table if not exists public.convai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.convai_conversations(id) on delete cascade,
  user_id uuid not null,
  agent_id uuid not null references public.convai_agents(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  audio_url text,
  duration_ms integer,
  message_index integer,
  timestamp timestamptz default now(),
  created_at timestamptz default now()
);

-- ─── 4. MEMORY ────────────────────────────────────────────────────────────────
create table if not exists public.convai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null references public.convai_agents(id) on delete cascade,
  memory_type text not null check (memory_type in (
    'preference','context','goal','decision','followup','correction','insight'
  )),
  content text not null,
  source_conversation_id uuid references public.convai_conversations(id) on delete set null,
  importance int default 5 check (importance >= 1 and importance <= 10),
  tags text[] default '{}',
  active boolean default true,
  superseded_by uuid references public.convai_memory(id),
  recall_count int default 0,
  last_recalled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_convai_memory_updated on public.convai_memory;
create trigger trg_convai_memory_updated before update on public.convai_memory
  for each row execute function public.update_updated_at_column();

-- ─── 5. MESSAGE INSERT TRIGGER (auto-bump conversation stats) ─────────────────
create or replace function public.update_conversation_on_message()
returns trigger as $$
begin
  update public.convai_conversations
     set message_count = coalesce(message_count, 0) + 1,
         last_message_at = new.timestamp,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_conversation_on_message on public.convai_messages;
create trigger trigger_update_conversation_on_message
  after insert on public.convai_messages
  for each row execute function public.update_conversation_on_message();

-- ─── 6. CONVERSATION CONTEXT RPC ──────────────────────────────────────────────
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
     and c.status = 'active'
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

-- ─── 7. ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table public.convai_agents enable row level security;
alter table public.convai_conversations enable row level security;
alter table public.convai_messages enable row level security;
alter table public.convai_memory enable row level security;

drop policy if exists "convai_agents_self_select" on public.convai_agents;
create policy "convai_agents_self_select" on public.convai_agents
  for select using (user_id = auth.uid());

drop policy if exists "convai_conversations_self_select" on public.convai_conversations;
create policy "convai_conversations_self_select" on public.convai_conversations
  for select using (user_id = auth.uid());

drop policy if exists "convai_messages_self_select" on public.convai_messages;
create policy "convai_messages_self_select" on public.convai_messages
  for select using (user_id = auth.uid());

drop policy if exists "convai_memory_self_select" on public.convai_memory;
create policy "convai_memory_self_select" on public.convai_memory
  for select using (user_id = auth.uid());

-- ─── 8. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists convai_agents_user_idx on public.convai_agents(user_id);
create index if not exists convai_conversations_user_idx on public.convai_conversations(user_id);
create index if not exists convai_conversations_agent_idx on public.convai_conversations(agent_id);
create index if not exists convai_messages_conversation_idx on public.convai_messages(conversation_id);
create index if not exists convai_messages_user_idx on public.convai_messages(user_id);
create index if not exists convai_memory_user_idx on public.convai_memory(user_id);
create index if not exists convai_memory_agent_idx on public.convai_memory(agent_id);
