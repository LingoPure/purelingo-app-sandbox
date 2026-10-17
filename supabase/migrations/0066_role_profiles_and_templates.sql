-- 0066_role_profiles_and_templates.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Role-discovery epic, part 1: schema.
--
-- Two additive capabilities on top of the existing roles/role_baselines
-- (0010), neither of which changes any existing behaviour:
--
-- 1. profile_json — a richer structured role definition (key
--    responsibilities, typical scenarios, tone register, per-skill
--    rationale) beyond the free-text `description` column. Populated by
--    the voice-based admin interview (@caistech/discovery-agent) for new
--    roles, and backfilled for the 9 presets by a one-off script.
--    primeContext + battery-content generation read this to tailor the
--    discovery/battery conversation to the actual role, instead of the
--    generic prompt every role gets today.
--
-- 2. Platform template sharing — an employer can publish a role of
--    theirs as a cross-employer template; a platform admin reviews a
--    SANITIZED copy before it becomes selectable by other employers'
--    invite flows. A role is never read directly across employers — an
--    adopting employer gets their OWN copy (new roles row, own
--    employer_id, own baselines), so each employer can edit their copy
--    without touching the original, and the existing
--    unique(employer_id, name) constraint is never a cross-tenant
--    collision. template_source_role_id is provenance only.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.roles
  add column if not exists profile_json jsonb,
  add column if not exists defined_via text not null default 'manual'
    check (defined_via in ('preset', 'voice_interview', 'manual')),
  add column if not exists template_status text not null default 'private'
    check (template_status in ('private', 'pending_review', 'published')),
  add column if not exists sanitized_description text,
  add column if not exists published_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists template_source_role_id uuid references public.roles(id) on delete set null;

-- Partial index: the platform-admin review queue filters on this constantly;
-- most roles stay 'private' forever, so keep the index to just the ones that
-- matter (mirrors the existing roles_employer_id_idx partial-index pattern).
create index if not exists roles_template_status_idx
  on public.roles (template_status) where template_status <> 'private';

comment on column public.roles.profile_json is
  'Structured role definition beyond name/description: {key_responsibilities: string[], typical_scenarios: string[], tone_register: string, skill_rationale: Record<skill,string>}. Null for roles not yet run through the voice interview or preset backfill.';
comment on column public.roles.defined_via is
  'How this role''s definition was authored — preset (one of the 9 built-ins), voice_interview (the admin role-discovery call), or manual (hand-typed, no structured profile_json yet).';
comment on column public.roles.template_status is
  'private (default, only this employer can use it) -> pending_review (employer published it, awaiting platform-admin approval) -> published (sanitized_description + baselines visible to every employer''s invite flow).';
comment on column public.roles.sanitized_description is
  'The cross-employer-safe description shown to OTHER employers when this role is published as a template. Never the raw description, which may name this employer''s own clients/processes. Null until published.';
comment on column public.roles.template_source_role_id is
  'Provenance only, when this role was created by adopting a published template from another employer — points at the original. Each employer gets its own copy (own row, own baselines); nothing is read cross-employer at runtime.';
