-- 0012_employer_admins.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Replace the cookie-password gate on /employer/* with real Supabase auth.
--
-- Model:
--   - auth.users is the source of truth for identity (one row per real
--     person, same auth that students use)
--   - employer_admins links auth_user_id ↔ employer_id, optionally with a
--     role label (owner / hr / viewer — for now everyone is "owner")
--
-- The middleware no longer cares about cookies — it just gates /employer/*
-- on a Supabase session, and the layout component checks employer_admins
-- before rendering anything sensitive.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.employer_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employer_id  uuid not null references public.employers(id) on delete cascade,
  -- "owner" today; "hr"/"viewer" reserved for when role-based access lands.
  admin_role   text not null default 'owner'
                check (admin_role in ('owner','hr','viewer')),
  created_at   timestamptz not null default now()
);

create index if not exists employer_admins_employer_id_idx
  on public.employer_admins (employer_id);

alter table public.employer_admins enable row level security;

-- An authenticated user can read their OWN admin row(s) — that's how the
-- /employer layout decides whether to render. They cannot read anyone
-- else's. Writes are service-role only (admins are provisioned through
-- the seed or a future "invite admin" flow, not self-service).
drop policy if exists "employer_admins_self_select" on public.employer_admins;
create policy "employer_admins_self_select"
  on public.employer_admins for select to authenticated
  using (auth_user_id = auth.uid());
