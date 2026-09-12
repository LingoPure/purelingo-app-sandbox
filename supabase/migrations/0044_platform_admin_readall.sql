-- 0044: LingoPure — Platform admin read-all (C4).
--
-- The platform admin console (/admin) gates on the `platform_admins` table
-- (canonical, 0038). This migration completes the policy story: a platform
-- admin can read every organisation's org-model rows THROUGH THE USER-SCOPED
-- client — the RLS grants it, the database enforces it, the UI never reaches
-- around via service-role.
--
--   organisations / organisation_memberships / organisation_departments
--     → extend select to platform admins (subscriptions + org_onboarding
--       already grant platform_admins from 0041/0042 — unchanged here).
--
-- Additive (new policies + one helper). Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. HELPER ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the policy need not carry the membership join in every
-- frame. Mirrors current_org_role (pinned search_path, stable).

create or replace function public.platform_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
  )
$$;

-- ─── 2. POLICIES ──────────────────────────────────────────────────────────────

-- Organisations: members see their own org; platform admins see all.
drop policy if exists "organisations_self_select" on public.organisations;
create policy "organisations_self_select"
  on public.organisations for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = organisations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or public.platform_is_admin()
  );

-- Memberships: self + owner/hr see org members; platform admins see all.
drop policy if exists "org_memberships_self_select" on public.organisation_memberships;
create policy "org_memberships_self_select"
  on public.organisation_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.org_is_owner_or_hr(organisation_id)
    or public.platform_is_admin()
  );

-- Departments: org members; platform admins see all.
drop policy if exists "org_departments_self_select" on public.organisation_departments;
create policy "org_departments_self_select"
  on public.organisation_departments for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = organisation_departments.organisation_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or public.platform_is_admin()
  );

-- Platform admins table itself: self-select + admins see the roster.
drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select"
  on public.platform_admins for select to authenticated
  using (
    user_id = auth.uid()
    or public.platform_is_admin()
  );