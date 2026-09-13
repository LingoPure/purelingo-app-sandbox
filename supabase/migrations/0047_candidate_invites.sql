-- 0047: LingoPure - Candidate screening (recruitment filter).
--
-- Thin MVP of the recruitment use of the self-assessment: an employer
-- invents a candidate by email + target role, the candidate takes the same
-- voice discovery + battery via a zero-form magic-link account, and the
-- employer sees the candidate with a role-fit view (LP-18 vs the role
-- baseline) in their console.
--
-- Write path: service-role server actions (invite issue, claim). Reads:
-- employer admins of the owning employer only. No anon/authenticated insert.

create table if not exists public.candidate_invites (
  id               uuid primary key default gen_random_uuid(),
  employer_id      uuid not null references public.employers(id) on delete cascade,
  role_id          uuid references public.roles(id) on delete set null,
  candidate_email  text not null,
  candidate_name   text,
  token            text not null unique,
  status           text not null default 'invited', -- invited / started / completed / expired
  student_id       uuid references public.students(id) on delete set null,
  invited_by       uuid references auth.users(id) on delete set null,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists candidate_invites_updated_at on public.candidate_invites;
create trigger candidate_invites_updated_at
  before update on public.candidate_invites
  for each row execute function public.update_updated_at();

-- Employer-admin → employer_id resolver so RLS policies do not carry the
-- join in every frame. Mirrors current_org_role (pinned search_path,
-- stable, security definer).
create or replace function public.current_employer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employer_id
  from public.employer_admins
  where auth_user_id = auth.uid()
  order by (auth_user_id = auth.uid()) desc
  limit 1
$$;

alter table public.candidate_invites enable row level security;

-- Employer admins see only their own org's candidate invites; the candidate
-- claim/session writes flow through service-role server actions.
drop policy if exists "candidate_invites_admin_select" on public.candidate_invites;
create policy "candidate_invites_admin_select"
  on public.candidate_invites for select to authenticated
  using (employer_id = public.current_employer_id());

drop policy if exists "candidate_invites_admin_update" on public.candidate_invites;
create policy "candidate_invites_admin_update"
  on public.candidate_invites for update to authenticated
  using (employer_id = public.current_employer_id());