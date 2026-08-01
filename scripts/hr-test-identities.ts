/**
 * Three sign-in identities, one per role, so all three perspectives can be
 * seen by eye rather than only asserted in tests.
 *
 *   dennis@corporateaisolutions.com   super_admin   the whole org
 *   mcmdennis+manager@gmail.com       admin         their own reports
 *   mcmdennis@gmail.com               staff         themselves only
 *
 * All three deliver to inboxes the operator controls — the manager address is a
 * Gmail plus-alias, which lands in the same mailbox, so signing in as the
 * manager needs no new account anywhere.
 *
 * ⚠️ THESE LIVE IN THE REAL LINGOPURE ORG, not the demo one.
 *
 * That is deliberate: the point is to exercise the org an operator actually
 * signs into. But it means the org is NOT clean, and the fabricated colleagues
 * below must be removed before Thao's real roster is loaded, or her team list
 * will contain people who do not exist. They carry the surname "Test" and
 * @lingopure.test addresses so they cannot be mistaken for real staff.
 *
 *   npm run hr:test-identities -- --wipe
 *
 * removes the fabricated colleagues and the manager alias, and restores the two
 * operator accounts to super_admin.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const ORG = "0e5f1a10-0000-4000-8000-000000000001";

const SUPER_ADMIN = "dennis@corporateaisolutions.com";
const MANAGER = "mcmdennis+manager@gmail.com";
const STAFF = "mcmdennis@gmail.com";

/** Fabricated colleagues, so the manager's team view is not a list of one. */
const COLLEAGUES = [
  { email: "an.test@lingopure.test", first: "An", last: "Test", title: "English Teacher", dept: "Teaching" },
  { email: "binh.test@lingopure.test", first: "Bình", last: "Test", title: "Student Success Officer", dept: "Student Success" },
];

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the shell */
  }
}

async function findEmployee(s: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await s.from("hr_employees").select("id").eq("org_id", ORG).ilike("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function ensureAuthUser(s: SupabaseClient, email: string): Promise<string | null> {
  const { data: list } = await s.auth.admin.listUsers({ page: 1, perPage: 200 });
  const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (hit) return hit.id;
  const { data, error } = await s.auth.admin.createUser({ email, email_confirm: true });
  if (error) {
    console.error(`  could not create auth user for ${email}: ${error.message}`);
    return null;
  }
  return data.user?.id ?? null;
}

/** Full entitlement plus an opening balance, so a staff view has real numbers. */
async function giveBalances(s: SupabaseClient, employeeId: string): Promise<void> {
  const year = new Date().getUTCFullYear();
  const { data: types } = await s.from("hr_leave_types").select("id, code").eq("org_id", ORG).in("code", ["annual", "sick"]);
  for (const t of (types ?? []) as Array<{ id: string; code: string }>) {
    const allowance = t.code === "annual" ? 12 : 3;
    await s.from("hr_employee_entitlements").upsert(
      { org_id: ORG, employee_id: employeeId, leave_type_id: t.id, leave_year: year, allowance },
      { onConflict: "org_id,employee_id,leave_type_id,leave_year" }
    );
    const { data: existing } = await s.from("hr_leave_ledger").select("id")
      .eq("employee_id", employeeId).eq("leave_type_id", t.id)
      .eq("leave_year", year).eq("entry_type", "opening_balance").maybeSingle();
    if (!existing) {
      await s.from("hr_leave_ledger").insert({
        org_id: ORG, employee_id: employeeId, leave_type_id: t.id, leave_year: year,
        entry_type: "opening_balance", days: allowance, effective_date: `${year}-01-01`,
      });
    }
  }
}

async function wipe(s: SupabaseClient): Promise<void> {
  console.log("Removing fabricated identities…");

  for (const c of COLLEAGUES) {
    const id = await findEmployee(s, c.email);
    if (!id) continue;
    // Ledger first: its foreign keys are ON DELETE RESTRICT so an audit trail
    // cannot vanish with its subject.
    await s.from("hr_leave_ledger").delete().eq("employee_id", id);
    await s.from("hr_leave_requests").delete().eq("employee_id", id);
    await s.from("hr_employee_entitlements").delete().eq("employee_id", id);
    await s.from("hr_employees").delete().eq("id", id);
    console.log(`  removed ${c.email}`);
  }

  const managerId = await findEmployee(s, MANAGER);
  if (managerId) {
    await s.from("hr_employees").update({ manager_id: null }).eq("manager_id", managerId);
    await s.from("hr_leave_ledger").delete().eq("employee_id", managerId);
    await s.from("hr_leave_requests").delete().eq("employee_id", managerId);
    await s.from("hr_employee_entitlements").delete().eq("employee_id", managerId);
    await s.from("hr_employees").delete().eq("id", managerId);
    console.log(`  removed ${MANAGER}`);
  }

  // Operators go back to super_admin so nobody is locked out of administration.
  await s.from("hr_employees")
    .update({ hr_role: "super_admin", manager_id: null, job_title: "Operator" })
    .eq("org_id", ORG).ilike("email", STAFF);
  console.log(`  ${STAFF} restored to super_admin`);
  console.log("Done. The org holds only the two operator accounts.");
}

async function main(): Promise<void> {
  loadEnvLocal();
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  if (process.argv.includes("--wipe")) return wipe(s);

  const superAdminId = await findEmployee(s, SUPER_ADMIN);
  if (!superAdminId) throw new Error(`${SUPER_ADMIN} is not an HR employee — run the access setup first.`);

  // ── Manager ───────────────────────────────────────────────────────────────
  const managerAuthId = await ensureAuthUser(s, MANAGER);
  let managerId = await findEmployee(s, MANAGER);
  if (!managerId) {
    const { data, error } = await s.from("hr_employees").insert({
      org_id: ORG, auth_user_id: managerAuthId, email: MANAGER,
      first_name: "Dennis", last_name: "McMahon (Manager)", job_title: "Head of Teaching",
      department: "Teaching", hr_role: "admin", manager_id: superAdminId,
      employment_start_date: "2026-01-01", status: "active", locale: "en",
    }).select("id").single();
    if (error) throw new Error(`manager: ${error.message}`);
    managerId = (data as { id: string }).id;
  } else {
    await s.from("hr_employees")
      .update({ hr_role: "admin", manager_id: superAdminId, auth_user_id: managerAuthId })
      .eq("id", managerId);
  }
  await giveBalances(s, managerId);
  console.log(`manager  ${MANAGER}  (admin, reports to super admin)`);

  // ── Staff: the operator's own personal address, reporting to the manager ──
  const staffId = await findEmployee(s, STAFF);
  if (staffId) {
    await s.from("hr_employees")
      .update({ hr_role: "staff", manager_id: managerId, job_title: "English Teacher", department: "Teaching" })
      .eq("id", staffId);
    await giveBalances(s, staffId);
    console.log(`staff    ${STAFF}  (staff, reports to the manager)`);
  }

  // ── Fabricated colleagues, so the manager's team is not a list of one ─────
  for (const c of COLLEAGUES) {
    let id = await findEmployee(s, c.email);
    if (!id) {
      const { data, error } = await s.from("hr_employees").insert({
        org_id: ORG, email: c.email, first_name: c.first, last_name: c.last,
        job_title: c.title, department: c.dept, hr_role: "staff",
        manager_id: managerId, employment_start_date: "2025-06-01",
        status: "active", locale: "vi",
      }).select("id").single();
      if (error) throw new Error(`${c.email}: ${error.message}`);
      id = (data as { id: string }).id;
    } else {
      await s.from("hr_employees").update({ manager_id: managerId }).eq("id", id);
    }
    await giveBalances(s, id);
    console.log(`colleague ${c.email}`);
  }

  // ── One pending request, so the approvals queue has something in it ───────
  const anId = await findEmployee(s, COLLEAGUES[0].email);
  const { data: annual } = await s.from("hr_leave_types").select("id").eq("org_id", ORG).eq("code", "annual").maybeSingle();
  if (anId && annual) {
    const { data: already } = await s.from("hr_leave_requests")
      .select("id").eq("employee_id", anId).eq("status", "pending").maybeSingle();
    if (!already) {
      // A Monday three weeks out, so it never lands on a weekend.
      const d = new Date();
      const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dow = new Date(utc).getUTCDay();
      const start = new Date(utc + (((8 - dow) % 7 || 7) + 14) * 86_400_000).toISOString().slice(0, 10);
      const end = new Date(Date.parse(start) + 86_400_000).toISOString().slice(0, 10);
      await s.from("hr_leave_requests").insert({
        org_id: ORG, employee_id: anId, leave_type_id: (annual as { id: string }).id,
        start_date: start, end_date: end, requested_days: 2,
        reason: "Family appointment", status: "pending",
      });
      console.log(`pending request from ${COLLEAGUES[0].first} — ${start} to ${end}`);
    }
  }

  console.log("");
  console.log("Sign in as each to see the three perspectives:");
  console.log(`  ${SUPER_ADMIN}  everyone, plus holidays and balance adjustment`);
  console.log(`  ${MANAGER}  own reports and their approvals only`);
  console.log(`  ${STAFF}  themselves only`);
  console.log("");
  console.log("⚠️  An/Bình are FABRICATED and sit in the real LingoPure org.");
  console.log("    Remove them before loading the real roster:");
  console.log("    npm run hr:test-identities -- --wipe");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
