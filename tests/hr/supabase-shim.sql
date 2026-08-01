-- Minimal Supabase shim for validating HR migrations against a bare Postgres.
--
-- The HR migration depends on exactly three things Supabase provides and plain
-- Postgres does not: the `auth.users` table, `auth.uid()`, and `auth.jwt()`.
-- This file stubs them so the migration can be applied to an EMPTY database in
-- CI or locally, with no Supabase instance and no other LingoPure migration
-- present — which is precisely the portability claim the migration header makes.
--
-- The stubs read session settings so tests can impersonate a user:
--   set local request.jwt.claim.sub   = '<uuid>';
--   set local request.jwt.claim.email = '<email>';
--
-- This is a TEST harness. It is never applied to a real database.

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase's auth.uid() reads the `sub` claim of the request JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase's auth.jwt() returns the whole claim set. The HR functions use only
-- the email claim, so that is all this reconstructs.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'sub',   nullif(current_setting('request.jwt.claim.sub', true), ''),
    'email', nullif(current_setting('request.jwt.claim.email', true), '')
  )
$$;

-- Supabase defines these roles; RLS policies granted `to authenticated` need
-- the role to exist before the policy can be created.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

-- Supabase grants table access to these roles automatically via default
-- privileges on the public schema, and RLS then decides which ROWS they see.
-- Without this, a bare Postgres would reject the query outright with
-- "permission denied" — which looks like RLS working but is not RLS at all,
-- and would make an RLS test pass for entirely the wrong reason.
--
-- Must run BEFORE the migration: default privileges apply only to objects
-- created after they are set.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
