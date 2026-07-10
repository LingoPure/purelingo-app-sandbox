-- 0023_content_editors.sql
-- Global (NOT employer-scoped) content-editor roles for the marketing-content
-- admin. Deliberately SEPARATE from employer_admins (tenant-scoped, learner
-- data) and investor operators: marketing content is one global site, not a
-- per-employer resource. These roles touch CONTENT only. The "touch content,
-- not the instrument" boundary holds by construction — the learner/telemetry
-- tables are RLS-scoped to student_id = auth.uid(), so a content editor (who is
-- not a student) reads nothing there.
--
-- Idempotent. Roles: admin | marketing | readonly.

create table if not exists public.content_editors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'readonly'
                check (role in ('admin', 'marketing', 'readonly')),
  invited_by  uuid references auth.users(id) on delete set null,
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (email)
);

create index if not exists content_editors_user_id_idx
  on public.content_editors (user_id);

drop trigger if exists content_editors_updated_at on public.content_editors;
create trigger content_editors_updated_at
  before update on public.content_editors
  for each row execute function public.update_updated_at();

-- Resolve the CURRENT authenticated user's content role, by user_id OR email.
-- The email fallback means a seed-by-email admin is recognised on first login,
-- before user_id is linked. security definer so RLS policies can call it.
create or replace function public.current_content_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.content_editors
  where user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by (user_id = auth.uid()) desc
  limit 1
$$;

alter table public.content_editors enable row level security;

-- An editor may read their OWN row (to learn their role); an admin reads all.
drop policy if exists "content_editors_read" on public.content_editors;
create policy "content_editors_read" on public.content_editors
  for select to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.current_content_role() = 'admin'
  );

-- Writes (invite / role change / revoke) are SERVICE-ROLE ONLY, performed by the
-- API after a requireContentAdmin() gate. No authenticated write policy → deny.

-- Seed the operator admins as the first content admins (bootstraps the invite
-- chain — the first admin can't be invited by an existing one). Linked by
-- auth.users email where the account already exists; otherwise a user_id-null
-- row that current_content_role() still resolves by email on login.
insert into public.content_editors (user_id, email, role, accepted_at)
select u.id, e.email, 'admin', now()
from (values
  ('dennis@corporateaisolutions.com'),
  ('mcmdennis@gmail.com')
) as e(email)
left join auth.users u on lower(u.email) = lower(e.email)
on conflict (email) do nothing;
