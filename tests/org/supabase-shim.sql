-- Minimal Supabase shim for validating the C0/C1 migrations against a bare
-- Postgres (mirrors tests/hr/supabase-shim.sql, extended for LingoPure core).
--
-- The C0/C1 migrations depend on what Supabase provides and plain Postgres
-- does not: the `auth.users` table (with the metadata column 0001's
-- handle_new_user trigger reads), `auth.uid()`, and `auth.jwt()`. This file
-- stubs them so the migrations apply to an EMPTY database with no Supabase
-- instance, so the RLS model is verified by querying AS each role.
--
-- The stubs read session settings so tests can impersonate a user:
--   set local request.jwt.claim.sub   = '<uuid>';
--
-- This is a TEST harness. It is never applied to a real database.

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'
);

-- Supabase's auth.uid() reads the `sub` claim of the request JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase's auth.jwt() returns the whole claim set. Only the sub claim is
-- needed by the C0/C1 functions.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'sub',   nullif(current_setting('request.jwt.claim.sub', true), '')
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
grant usage on schema public to anon, authenticated, service_role;
-- Real Supabase grants usage on schema auth to the built-in roles; without it,
-- the authenticated role cannot call auth.uid() in an RLS qualifier (the HR
-- shim never needed this because HR policies only call SECURITY DEFINER fns).
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;