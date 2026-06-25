-- 0021_investor_deep_dive_invited.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Split admin-decided ENTITLEMENT from NDA-gated ACCESS.
--
-- The admin decides, per invite, whether an investor may reach deep dive at all
-- (deep_dive_invited). Actual deep-dive ACCESS (max_tier = 'restricted') is still
-- ONLY unlocked by the investor accepting the online NDA — the admin can never
-- hand out deep-dive content without an NDA (Dan's rule: with NDA → deep dive).
--
--   deep_dive_invited = false  →  dataroom only, no NDA ever offered
--   deep_dive_invited = true   →  may unlock deep dive by accepting the online NDA
--                                 (max_tier stays 'main' until they sign)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.investors
  add column if not exists deep_dive_invited boolean not null default false;

-- Backfill: anyone already at the restricted tier was granted deep dive, so they
-- are (retroactively) deep-dive-invited. Their max_tier is left as-is.
update public.investors
  set deep_dive_invited = true
  where max_tier = 'restricted';
