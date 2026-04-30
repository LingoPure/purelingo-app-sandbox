-- LingoPure MVP — initial schema
-- Idempotent: safe to re-run. RLS enabled on every table.
-- Source: briefing §03 "Database Schema — Key Tables" (April 2026).

-- ── Helper: updated_at trigger ──
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- employers
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  default_target_level text check (default_target_level in ('A1','A2','B1','B2','C1','C2')),
  contract_start date,
  contract_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists employers_updated_at on public.employers;
create trigger employers_updated_at before update on public.employers
  for each row execute function public.update_updated_at();

alter table public.employers enable row level security;
drop policy if exists "employers_authenticated_read" on public.employers;
create policy "employers_authenticated_read"
  on public.employers for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- students  (id == auth.users.id)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  classin_user_id text unique,
  employer_id uuid references public.employers(id) on delete set null,
  name text,
  email text,
  target_level text check (target_level in ('A1','A2','B1','B2','C1','C2')) default 'B2',
  discovery_status text check (discovery_status in ('pending','in_progress','complete')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students
  for each row execute function public.update_updated_at();

alter table public.students enable row level security;
drop policy if exists "students_self_select" on public.students;
create policy "students_self_select" on public.students
  for select to authenticated using (id = auth.uid());
drop policy if exists "students_self_update" on public.students;
create policy "students_self_update" on public.students
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "students_self_insert" on public.students;
create policy "students_self_insert" on public.students
  for insert to authenticated with check (id = auth.uid());

-- Auto-create students row whenever an auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.students (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- gap_scores
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.gap_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill text not null check (skill in (
    'speaking_fluency','listening_comprehension','writing_formal',
    'reading_intent','business_vocabulary','presentation_delivery'
  )),
  score integer check (score between 0 and 100),
  target integer check (target between 0 and 100) default 80,
  source text check (source in ('discovery','lesson','session','exam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, skill)
);

drop trigger if exists gap_scores_updated_at on public.gap_scores;
create trigger gap_scores_updated_at before update on public.gap_scores
  for each row execute function public.update_updated_at();

alter table public.gap_scores enable row level security;
drop policy if exists "gap_scores_self_select" on public.gap_scores;
create policy "gap_scores_self_select" on public.gap_scores
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- discovery_sessions
-- (briefing names this column vapi_call_id; we use ElevenLabs ConvAI instead,
--  so the column is named convai_conversation_id.)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  convai_conversation_id text,
  transcript_json jsonb,
  profile_json jsonb,
  status text check (status in ('pending','in_progress','complete','failed')) default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists discovery_sessions_updated_at on public.discovery_sessions;
create trigger discovery_sessions_updated_at before update on public.discovery_sessions
  for each row execute function public.update_updated_at();

alter table public.discovery_sessions enable row level security;
drop policy if exists "discovery_sessions_self_select" on public.discovery_sessions;
create policy "discovery_sessions_self_select" on public.discovery_sessions
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- classin_sessions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.classin_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  classin_class_id text not null,
  attended boolean default false,
  duration_mins integer,
  participation_data_json jsonb,
  recording_url text,
  transcribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists classin_sessions_updated_at on public.classin_sessions;
create trigger classin_sessions_updated_at before update on public.classin_sessions
  for each row execute function public.update_updated_at();

alter table public.classin_sessions enable row level security;
drop policy if exists "classin_sessions_self_select" on public.classin_sessions;
create policy "classin_sessions_self_select" on public.classin_sessions
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- micro_lessons (Phase 2 — schema present so the engine drops in cleanly)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.micro_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type text check (type in (
    'email_sprint','speak_score','listen_decode','vocab_challenge',
    'role_simulation','peer_duel','report_rewrite','word_web'
  )),
  skill_focus text,
  content_json jsonb,
  xp_awarded integer default 0,
  score_before integer,
  score_after integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists micro_lessons_updated_at on public.micro_lessons;
create trigger micro_lessons_updated_at before update on public.micro_lessons
  for each row execute function public.update_updated_at();

alter table public.micro_lessons enable row level security;
drop policy if exists "micro_lessons_self_select" on public.micro_lessons;
create policy "micro_lessons_self_select" on public.micro_lessons
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- certifications (Phase 2 — TrackTest)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  tracktest_exam_id text,
  status text check (status in ('scheduled','in_progress','passed','failed','expired')) default 'scheduled',
  result_json jsonb,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists certifications_updated_at on public.certifications;
create trigger certifications_updated_at before update on public.certifications
  for each row execute function public.update_updated_at();

alter table public.certifications enable row level security;
drop policy if exists "certifications_self_select" on public.certifications;
create policy "certifications_self_select" on public.certifications
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- nudges (Phase 2 — Twilio/SendGrid)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  channel text check (channel in ('whatsapp','email','sms','push')),
  type text,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists nudges_updated_at on public.nudges;
create trigger nudges_updated_at before update on public.nudges
  for each row execute function public.update_updated_at();

alter table public.nudges enable row level security;
drop policy if exists "nudges_self_select" on public.nudges;
create policy "nudges_self_select" on public.nudges
  for select to authenticated using (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists gap_scores_student_idx on public.gap_scores(student_id);
create index if not exists discovery_sessions_student_idx on public.discovery_sessions(student_id);
create index if not exists classin_sessions_student_idx on public.classin_sessions(student_id);
create index if not exists classin_sessions_class_idx on public.classin_sessions(classin_class_id);
create index if not exists micro_lessons_student_idx on public.micro_lessons(student_id);
create index if not exists certifications_student_idx on public.certifications(student_id);
create index if not exists nudges_student_idx on public.nudges(student_id);
