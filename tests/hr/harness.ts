/**
 * Integration harness for the HR module.
 *
 * WHAT PROBLEM THIS SOLVES. The HR authorisation logic — the approval race,
 * cancel-restores-balance, overlap rejection, management-cycle detection —
 * lives in TypeScript and reads through a Supabase client that resolves the
 * caller's session from `next/headers`. That only exists inside a Next request,
 * so none of it is reachable from a test runner. The SQL harness
 * (`scripts/hr-db-verify.sh`) proves the CONSTRAINTS hold; it cannot reach a
 * line of the code that decides who may do what.
 *
 * HOW. `src/lib/hr/deps.ts` is already the module's single seam. It exposes a
 * guarded test hook that swaps in a client built from a real user's access
 * token instead of from cookies. So these tests drive the real functions
 * against a real Supabase, with real JWTs and real RLS — not a mock of any of
 * it. A mock would happily agree with whatever the code believes, which is the
 * opposite of what is wanted here.
 *
 * WHERE IT RUNS. Env-driven, so it works against a local `supabase start` stack
 * or a remote project. Deliberately not pinned to LingoPure's sandbox: the
 * module is built to be handed over, and a harness that needs one specific
 * project's credentials does not travel with it.
 *
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ISOLATION. Every run creates its OWN organisation with a unique id and puts
 * every fixture inside it. Nothing touches existing data, and cross-org
 * isolation is itself one of the things under test. Teardown deletes the org;
 * the cascade takes the rest.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { __setHrTestClients } from "../../src/lib/hr/deps";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function harnessConfigured(): boolean {
  return Boolean(url && anonKey && serviceKey);
}

/**
 * Why this fails loudly rather than skipping.
 *
 * A suite that silently skips when unconfigured is indistinguishable from one
 * that passed, and the whole reason this harness exists is that an untested
 * path looked fine right up until it did not.
 */
export function requireHarnessConfig(): void {
  if (!harnessConfigured()) {
    throw new Error(
      "HR integration harness is not configured. Set SUPABASE_URL (or " +
        "NEXT_PUBLIC_SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
        "SUPABASE_SERVICE_ROLE_KEY. Run via `npm run test:hr:integration`, " +
        "which sources .env.local."
    );
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type TestPerson = {
  employeeId: string;
  authUserId: string;
  email: string;
  password: string;
  accessToken: string;
};

export type TestContext = {
  orgId: string;
  leaveTypes: Record<string, string>;
  superAdmin: TestPerson;
  manager: TestPerson;
  otherManager: TestPerson;
  staff: TestPerson;
  staffPeer: TestPerson;
  /** Someone in a DIFFERENT org, for cross-tenant assertions. */
  outsider: TestPerson;
  outsiderOrgId: string;
};

const PASSWORD = "hr-harness-Passw0rd!";

/**
 * Build a user-scoped client from an access token.
 *
 * The Authorization header is what makes `auth.uid()` resolve inside Postgres,
 * so RLS sees a real user. Constructed with the ANON key, not the service key —
 * the service key would bypass RLS and every policy assertion would pass
 * vacuously, which is the single easiest way to write an RLS test that proves
 * nothing.
 */
function userClientFor(accessToken: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Point the HR module at a given person for the duration of a test. */
export function actAs(person: TestPerson): void {
  __setHrTestClients({
    userClient: async () => userClientFor(person.accessToken) as never,
    serviceClient: () => serviceClient() as never,
  });
}

/** Act as nobody signed in — for asserting that gates actually close. */
export function actAsAnonymous(): void {
  __setHrTestClients({
    userClient: async () =>
      createClient(url, anonKey, { auth: { persistSession: false } }) as never,
    serviceClient: () => serviceClient() as never,
  });
}

export function clearActor(): void {
  __setHrTestClients(null);
}

async function createPerson(
  svc: SupabaseClient,
  orgId: string,
  input: {
    role: "super_admin" | "admin" | "staff";
    managerId?: string | null;
    firstName: string;
  }
): Promise<TestPerson> {
  const email = `hr-harness-${randomUUID()}@example.test`;

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`harness: createUser failed: ${createError?.message}`);
  }

  const { data: employee, error: employeeError } = await svc
    .from("hr_employees")
    .insert({
      org_id: orgId,
      auth_user_id: created.user.id,
      email,
      first_name: input.firstName,
      last_name: "Harness",
      hr_role: input.role,
      manager_id: input.managerId ?? null,
      employment_start_date: "2024-01-01",
      status: "active",
    })
    .select("id")
    .single();
  if (employeeError) {
    throw new Error(`harness: employee insert failed: ${employeeError.message}`);
  }

  // A real sign-in, so the token is a genuine GoTrue JWT rather than something
  // hand-assembled that happens to look like one.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: session, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError || !session.session) {
    throw new Error(`harness: sign-in failed for ${email}: ${signInError?.message}`);
  }

  return {
    employeeId: (employee as { id: string }).id,
    authUserId: created.user.id,
    email,
    password: PASSWORD,
    accessToken: session.session.access_token,
  };
}

/**
 * Stand up an isolated org with a full cast.
 *
 * Reporting line: manager -> staff, staffPeer. otherManager has no reports, so
 * "an Admin sees only THEIR team" has something to be wrong about.
 */
export async function setupTestContext(): Promise<TestContext> {
  requireHarnessConfig();
  const svc = serviceClient();

  const orgId = randomUUID();
  const outsiderOrgId = randomUUID();

  for (const [id, name] of [
    [orgId, "Harness Co"],
    [outsiderOrgId, "Harness Outsider Co"],
  ] as const) {
    const { error } = await svc
      .from("hr_organisations")
      .insert({ id, name, country: "VN", timezone: "Asia/Ho_Chi_Minh" });
    if (error) throw new Error(`harness: org insert failed: ${error.message}`);
    const { error: policyError } = await svc.from("hr_org_policy").insert({ org_id: id });
    if (policyError) throw new Error(`harness: policy insert failed: ${policyError.message}`);
  }

  const typeRows = [
    { code: "annual", name_en: "Paid Annual Leave", name_vi: "Nghỉ phép năm", deducts_balance: true, default_allowance: 12, sort_order: 1 },
    { code: "sick", name_en: "Sick Leave", name_vi: "Nghỉ ốm", deducts_balance: true, default_allowance: 3, sort_order: 2 },
    { code: "unpaid", name_en: "Unpaid Leave", name_vi: "Nghỉ không lương", deducts_balance: false, default_allowance: null, sort_order: 3 },
  ];
  const { data: insertedTypes, error: typeError } = await svc
    .from("hr_leave_types")
    .insert(typeRows.map((t) => ({ ...t, org_id: orgId })))
    .select("id, code");
  if (typeError) throw new Error(`harness: leave types failed: ${typeError.message}`);

  const leaveTypes: Record<string, string> = {};
  for (const row of insertedTypes as Array<{ id: string; code: string }>) {
    leaveTypes[row.code] = row.id;
  }

  const superAdmin = await createPerson(svc, orgId, { role: "super_admin", firstName: "Sam" });
  const manager = await createPerson(svc, orgId, { role: "admin", firstName: "Ann" });
  const otherManager = await createPerson(svc, orgId, { role: "admin", firstName: "Bao" });
  const staff = await createPerson(svc, orgId, { role: "staff", managerId: manager.employeeId, firstName: "Chi" });
  const staffPeer = await createPerson(svc, orgId, { role: "staff", managerId: manager.employeeId, firstName: "Dung" });
  const outsider = await createPerson(svc, outsiderOrgId, { role: "super_admin", firstName: "Eve" });

  // Give the two staff a full annual entitlement to draw down.
  const currentYear = new Date().getUTCFullYear();
  await svc.from("hr_employee_entitlements").insert(
    [staff, staffPeer].map((p) => ({
      org_id: orgId,
      employee_id: p.employeeId,
      leave_type_id: leaveTypes.annual,
      leave_year: currentYear,
      allowance: 12,
    }))
  );
  await svc.from("hr_leave_ledger").insert(
    [staff, staffPeer].map((p) => ({
      org_id: orgId,
      employee_id: p.employeeId,
      leave_type_id: leaveTypes.annual,
      leave_year: currentYear,
      entry_type: "opening_balance",
      days: 12,
      effective_date: `${currentYear}-01-01`,
    }))
  );

  return { orgId, outsiderOrgId, leaveTypes, superAdmin, manager, otherManager, staff, staffPeer, outsider };
}

/**
 * Remove everything this run created.
 *
 * Ledger rows are ON DELETE RESTRICT against employees — deliberately, so an
 * audit trail cannot vanish with its subject — so they go first, in dependency
 * order, before the org cascade can run.
 */
export async function teardownTestContext(context: TestContext): Promise<void> {
  const svc = serviceClient();
  const orgIds = [context.orgId, context.outsiderOrgId];

  await svc.from("hr_leave_ledger").delete().in("org_id", orgIds);
  await svc.from("hr_leave_requests").delete().in("org_id", orgIds);
  await svc.from("hr_employee_entitlements").delete().in("org_id", orgIds);
  await svc.from("hr_audit_log").delete().in("org_id", orgIds);
  await svc.from("hr_employees").delete().in("org_id", orgIds);
  await svc.from("hr_leave_types").delete().in("org_id", orgIds);
  await svc.from("hr_org_policy").delete().in("org_id", orgIds);
  await svc.from("hr_organisations").delete().in("id", orgIds);

  const people = [
    context.superAdmin,
    context.manager,
    context.otherManager,
    context.staff,
    context.staffPeer,
    context.outsider,
  ];
  for (const person of people) {
    await svc.auth.admin.deleteUser(person.authUserId).catch(() => undefined);
  }

  clearActor();
}

/** Set a policy value for the duration of a test. */
export async function setPolicy(
  orgId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await serviceClient()
    .from("hr_org_policy")
    .update(patch)
    .eq("org_id", orgId);
  if (error) throw new Error(`harness: policy update failed: ${error.message}`);
}

/** Next Monday, so fixtures never accidentally land on a weekend. */
export function nextMonday(weeksAhead = 1): string {
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = new Date(utc).getUTCDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const target = new Date(utc + (daysUntilMonday + (weeksAhead - 1) * 7) * 86_400_000);
  return target.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
