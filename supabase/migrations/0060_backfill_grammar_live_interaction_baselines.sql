-- 0060_backfill_grammar_live_interaction_baselines.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ISS-048 follow-up (Tier 2 gap, found 2026-09-22): grammar/live_interaction
-- are genuinely NEW dimensions (not renamed from anything — see 0057/0058),
-- so there was never any prior data to backfill for them. Every one of the
-- 19 roles created before this migration has role_baselines rows for
-- speaking/listening/writing/reading/business_vocabulary/presentation_delivery
-- and ZERO rows for grammar/live_interaction (confirmed live via REST query,
-- 108 rows / 6 skills across 19 roles).
--
-- This is not silently broken — loadBaselinesForRole() (src/lib/scoring/
-- baselines.ts) already falls back to a flat 800 for any missing skill row,
-- so scoring/gap-display keeps working. But it means every existing role is
-- running on a generic default for the two new dimensions instead of a
-- role-tuned one, and the /employer roles admin UI shows a blank row instead
-- of a real number when editing an old role.
--
-- Values for the 6 role NAMES that match a self-setup.tsx preset are taken
-- directly from that file's ROLES array (SelfSetup component) — the same
-- judgment-call rationale already documented there (grammar tracks written-
-- precision demand, live_interaction tracks how real-time/reactive the role
-- is). Roles with no matching preset name (ad-hoc roles created via
-- /employer/roles/new) get the flat 800 default explicitly, rather than
-- silently inheriting it at read time — so every role has real data.
--
-- Idempotent: ON CONFLICT (role_id, skill) DO NOTHING — safe to re-run, and
-- never overwrites a baseline an admin may have already set by hand.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.role_baselines (role_id, skill, min_score)
select r.id, v.skill, v.min_score
from public.roles r
join (
  values
    ('Back Office Operations',        'grammar',          700),
    ('Back Office Operations',        'live_interaction',  300),
    ('Inbound Customer Service',      'grammar',          500),
    ('Inbound Customer Service',      'live_interaction',  750),
    ('Inbound Sales',                 'grammar',          450),
    ('Inbound Sales',                 'live_interaction',  650),
    ('Inbound Tech Support',          'grammar',          600),
    ('Inbound Tech Support',          'live_interaction',  700),
    ('Outbound Sales',                'grammar',          500),
    ('Outbound Sales',                'live_interaction',  700),
    ('Recruitment / HR',              'grammar',          600),
    ('Recruitment / HR',              'live_interaction',  600)
) as v(role_name, skill, min_score)
  on v.role_name = r.name
on conflict (role_id, skill) do nothing;

-- Every other role (no matching preset name — ad-hoc roles created via
-- /employer/roles/new) gets the same flat 800 default the runtime fallback
-- already uses, made explicit rather than implicit.
insert into public.role_baselines (role_id, skill, min_score)
select r.id, s.skill, 800
from public.roles r
cross join (values ('grammar'), ('live_interaction')) as s(skill)
on conflict (role_id, skill) do nothing;
