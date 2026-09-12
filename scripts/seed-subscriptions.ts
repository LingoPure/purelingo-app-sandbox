/**
 * Seed synthetic billing subscriptions for all active organisations.
 *
 * Every organisation that does not yet have a subscriptions row gets a
 * synthetic entry with the package it selected during onboarding (or
 * '1:1 Tutoring' as the default).
 *
 * Usage: npm run billing:seed-subscriptions
 *
 * Idempotent: only inserts where organisation_id is missing.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const PRICE_MAP: Record<string, number> = {
  "1:1 Tutoring": 1500.0,
  "Tutor + AI": 3200.0,
  "Full BPO": 7500.0,
};

async function main() {
  const admin = createAdminClient();

  // 1. Fetch organisations and their onboarding state
  const { data: orgs, error: orgErr } = await admin
    .from("organisations")
    .select("id, slug");

  if (orgErr || !orgs?.length) {
    console.error("[billing:seed] No organisations found or error:", orgErr?.message);
    process.exit(1);
  }

  const { data: onboardings } = await admin
    .from("org_onboarding")
    .select("organisation_id, package");

  const onboardMap = new Map<string, string>();
  for (const o of onboardings ?? []) {
    onboardMap.set(o.organisation_id, o.package ?? "1:1 Tutoring");
  }

  let inserted = 0;
  for (const org of orgs) {
    const pkg = onboardMap.get(org.id) ?? "1:1 Tutoring";
    const price = PRICE_MAP[pkg] ?? 1500.0;

    const { error: insErr } = await admin.from("subscriptions").upsert(
      {
        organisation_id: org.id,
        package: pkg,
        tier: "standard",
        status: "active",
        price_monthly: price,
        currency: "AUD",
        next_billing_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      },
      { onConflict: "organisation_id" }
    );

    if (!insErr) {
      inserted++;
    } else {
      console.error(`[billing:seed] failed for org ${org.slug}:`, insErr.message);
    }
  }

  console.log(`[billing:seed] upserted ${inserted}/${orgs.length} subscriptions`);
}

main();
