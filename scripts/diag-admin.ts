/**
 * Diagnostic: check whether dennis@factory2key.com.au is correctly
 * provisioned as an employer_admin.
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/diag-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const TARGET_EMAIL = "dennis@factory2key.com.au";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE URL + SERVICE_ROLE_KEY required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Find the auth user
  let userId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase()
    );
    if (match) {
      userId = match.id;
      console.log(`✓ auth.users: ${TARGET_EMAIL} → ${userId}`);
      console.log(`  email_confirmed_at: ${match.email_confirmed_at}`);
      console.log(`  created_at: ${match.created_at}`);
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  if (!userId) {
    console.log(`✗ NO auth.users row for ${TARGET_EMAIL}`);
    process.exit(1);
  }

  // 2. Check employer_admins
  const { data: adminRow, error: adminErr } = await supabase
    .from("employer_admins")
    .select("auth_user_id, employer_id, admin_role")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (adminErr) {
    console.log(`✗ employer_admins query error: ${adminErr.message}`);
    process.exit(1);
  }
  if (!adminRow) {
    console.log(`✗ NO employer_admins row for user_id ${userId}`);
    console.log(`  → This is why /login routes to /dashboard.`);

    // Also list any orphan admin rows (different user_id)
    const { data: allAdmins } = await supabase
      .from("employer_admins")
      .select("auth_user_id, employer_id, admin_role");
    console.log(`\nAll employer_admins rows in DB:`);
    for (const a of allAdmins ?? []) {
      console.log(`  ${a.auth_user_id} → employer ${a.employer_id} (${a.admin_role})`);
    }
    process.exit(1);
  }
  console.log(`✓ employer_admins: user_id ${userId} → employer ${adminRow.employer_id} (${adminRow.admin_role})`);

  // 3. Check the employer name
  const { data: emp } = await supabase
    .from("employers")
    .select("id, name")
    .eq("id", adminRow.employer_id)
    .maybeSingle();
  console.log(`✓ employer: ${(emp as { name?: string } | null)?.name}`);

  console.log("\nAll three rows present. /login → /employer should work.");
  console.log("If it doesn't, the issue is in the redirect logic, not the data.");
}

main().catch((err) => {
  console.error("\n✗ Diagnostic failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
