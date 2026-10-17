-- 0067_role_discovery_sessions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Role-discovery epic, part 2: the voice interview's session/binding table.
--
-- Mirrors ai_voice_tutor_sessions' shape (0062) and investor_voice_sessions'
-- role (0022) — a dedicated binding table per voice-agent "type" sharing the
-- one workspace webhook, keyed by whatever that type's real subject is. For
-- the student discovery/plan/voice-tutor agents the subject is a student;
-- here it's the ROLE BEING DEFINED (a draft `roles` row created before the
-- call starts, per employer-admin-triggered voice interview) plus the admin
-- who is actually speaking. Server-derived identity at connect — never a
-- client-asserted role_id (VOICE_MEMORY_STANDARD rule 9) — is wired the same
-- way convai_voice_bindings already does for discovery.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.role_discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  elevenlabs_conversation_id text,
  status text not null check (status in ('pending', 'in_progress', 'complete', 'failed')) default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists role_discovery_sessions_role_idx
  on public.role_discovery_sessions (role_id);
create index if not exists role_discovery_sessions_employer_time_idx
  on public.role_discovery_sessions (employer_id, created_at desc);

alter table public.role_discovery_sessions enable row level security;

-- Read access for an admin of the owning employer only (mirrors the
-- employer_admins-gated posture used by every other employer-facing table).
-- Writes happen through the service-role client (session start + webhook),
-- same posture as ai_voice_tutor_sessions/discovery_sessions.
drop policy if exists "role_discovery_sessions_admin_select" on public.role_discovery_sessions;
create policy "role_discovery_sessions_admin_select"
  on public.role_discovery_sessions for select to authenticated
  using (
    exists (
      select 1 from public.employer_admins ea
      where ea.auth_user_id = auth.uid()
        and ea.employer_id = role_discovery_sessions.employer_id
    )
  );
