-- 0043: LingoPure — Org onboarding staff allocation (C3).
--
-- Adds `department_id` to organisation_memberships so org admins can
-- allocate staff to a department during the onboarding wizard (§6, step 3).
-- Additive column only — the table, roles and RLS already exist (0038).
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter table public.organisation_memberships
    add column if not exists department_id uuid
    references public.organisation_departments(id) on delete set null;
exception when duplicate_column then null;
end $$;

create index if not exists org_memberships_department_idx
  on public.organisation_memberships (department_id)
  where department_id is not null;