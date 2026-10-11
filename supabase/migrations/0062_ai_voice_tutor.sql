-- 0062_ai_voice_tutor.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- AI voice tutor — infill/repetition/reinforcement practice with Aria,
-- sitting between self-paced micro-lessons and a live ClassIn class in the
-- curriculum's modality ladder (live tutors = new material + personalised
-- coaching; AI voice = drilling/reinforcement, scheduled AND on-demand;
-- self-paced lessons = everything else).
--
-- 1. Widen gap_scores.source to accept 'ai_voice_tutor' — the same additive
--    enum-expansion pattern as 0016 (battery) and 0057 (taxonomy widen).
-- 2. New table: one row per voice-tutor session (mirrors discovery_sessions/
--    classin_sessions' shape), so /practice can show session history and the
--    usage cap can count recent sessions without scanning gap_score_history.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. gap_scores.source: add 'ai_voice_tutor' ─────────────────────────────
alter table public.gap_scores
  drop constraint if exists gap_scores_source_check;
alter table public.gap_scores
  add constraint gap_scores_source_check
  check (source in (
    'discovery',
    'lesson',
    'session',
    'exam',
    'voice_transcript',
    'battery_task',
    'ai_voice_tutor'
  ));

-- ─── 2. ai_voice_tutor_sessions ──────────────────────────────────────────────
create table if not exists public.ai_voice_tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  -- Any of the 8 scored dimensions — primary or supporting (see rubric.ts
  -- AnySkillKey) — but ai_voice recommendations only ever target the 4
  -- voice-native skills (speaking/listening/grammar/live_interaction); the
  -- column itself stays unconstrained to that subset so a future on-demand
  -- session targeting any skill isn't blocked by a CHECK.
  target_skill text not null,
  trigger text not null check (trigger in ('scheduled', 'on_demand')),
  elevenlabs_conversation_id text,
  status text not null check (status in ('pending', 'in_progress', 'complete', 'failed')) default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_voice_tutor_sessions_student_time_idx
  on public.ai_voice_tutor_sessions (student_id, created_at desc);

alter table public.ai_voice_tutor_sessions enable row level security;

drop policy if exists "ai_voice_tutor_sessions_self_select" on public.ai_voice_tutor_sessions;
create policy "ai_voice_tutor_sessions_self_select"
  on public.ai_voice_tutor_sessions for select to authenticated
  using (student_id = auth.uid());

-- Writes happen through the service-role client (session start + webhook),
-- same posture as discovery_sessions/gap_score_history.
