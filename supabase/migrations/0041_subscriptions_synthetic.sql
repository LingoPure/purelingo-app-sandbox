-- 0041: LingoPure — Synthetic billing subscriptions (display-only, §5).
--
-- Display-only billing surface. No Stripe integration this phase — each
-- org gets a seeded `subscriptions` row with synthetic tier / price / status
-- so the platform admin console and org portal billing pages have real
-- data to render.
--
-- The table is additive (no existing tables touched). RLS: org members see
-- their own org's subscription; platform admins see all.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. SUBSCRIPTIONS ────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  package         text not null default '1:1 Tutoring'
                    check (package in ('1:1 Tutoring', 'Tutor + AI', 'Full BPO')),
  tier            text not null default 'standard'
                    check (tier in ('trial', 'standard', 'premium')),
  status          text not null default 'active'
                    check (status in ('active', 'past_due', 'cancelled', 'trialing')),
  price_monthly   numeric(10,2) not null default 0.00,
  currency        text not null default 'AUD',
  next_billing_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.update_updated_at();

create index if not exists subscriptions_org_idx
  on public.subscriptions (organisation_id);

-- ─── 2. ROW LEVEL SECURITY ────────────────────────────────────────────────────

alter table public.subscriptions enable row level security;

-- Org members see their own org's subscription.
drop policy if exists "subscriptions_org_select" on public.subscriptions;
create policy "subscriptions_org_select"
  on public.subscriptions for select to authenticated
  using (
    exists (
      select 1 from public.organisation_memberships m
      where m.organisation_id = subscriptions.organisation_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — writes are service-role only.