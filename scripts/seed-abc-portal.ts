import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: org } = await sb
    .from("organisations")
    .select("id")
    .eq("slug", "abc-manufacturer")
    .single();

  // Look up user via student table instead of auth.users
  const { data: student } = await sb
    .from("students")
    .select("id")
    .eq("email", "dennis@factory2key.com.au")
    .single();

  if (!org || !student) {
    console.error("Org or Student not found", { org, student });
    process.exit(1);
  }

  console.log("Adding Membership...");
  
  // 1. Membership (use student.id as user_id)
  await sb.from("organisation_memberships").upsert({
    user_id: student.id,
    organisation_id: org.id,
    role: "owner",
    status: "active"
  }, { onConflict: "user_id,organisation_id" });

  // 2. Subscription
  await sb.from("subscriptions").upsert({
    organisation_id: org.id,
    package: "1:1 Tutoring",
    tier: "standard",
    status: "active",
    price_monthly: 99.00,
    currency: "AUD"
  }, { onConflict: "organisation_id" });

  // 3. Onboarding
  await sb.from("org_onboarding").upsert({
    organisation_id: org.id,
    step: "done",
    completed_at: new Date().toISOString()
  }, { onConflict: "organisation_id" });

  console.log("Org portal setup complete.");
}

main().catch(console.error);
