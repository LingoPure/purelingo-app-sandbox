/**
 * THE DEPENDENCY SEAM.
 *
 * This is the ONLY file in the HR module permitted to import from outside
 * `src/lib/hr` and `src/app/hr`. Everything else in the module imports from
 * here instead of reaching into the host application directly.
 *
 * Why: the module is built in this repo as a sandbox and is designed to be
 * lifted into LingoPure's own repo later. Handing it over should mean rewriting
 * this one file to point at whatever Supabase helpers the destination has —
 * not auditing forty imports scattered across the module.
 *
 * `scripts/check-hr-portability.mjs` enforces this in CI. If you find yourself
 * wanting to import `@/lib/something` from another HR file, add it here and
 * re-export it instead. That is not a workaround; it is the design.
 *
 * Keep this file free of logic. It is a re-export surface plus the test seam
 * below, nothing more.
 */

import { createClient as createHostServerClient } from "@/lib/supabase/server";
import { createAdminClient as createHostAdminClient } from "@/lib/supabase/admin";

type UserClient = Awaited<ReturnType<typeof createHostServerClient>>;
type ServiceClient = ReturnType<typeof createHostAdminClient>;

/**
 * Test-only client overrides. Null in every normal run.
 *
 * The HR functions read through a client that resolves the caller's session
 * from `next/headers`, which only exists inside a Next request. That makes the
 * authorisation logic — the approval race, cancel-restores-balance, overlap
 * rejection — unreachable from a test runner, which is exactly the logic most
 * worth testing. This hook lets the harness supply a client built from a real
 * user's access token instead of from cookies, so tests exercise the real RLS
 * policies rather than a mock of them.
 */
let testOverrides: {
  userClient?: () => Promise<UserClient>;
  serviceClient?: () => ServiceClient;
} | null = null;

/**
 * Install client overrides. TESTS ONLY.
 *
 * Hard-refuses in production. A reachable runtime hook that can replace the
 * client carrying the caller's identity would let anything able to call it read
 * as any user — a worse hole than the one the module's RLS closes. The guard is
 * a thrown error rather than a silent no-op so a misuse is loud.
 */
export function __setHrTestClients(
  overrides: {
    userClient?: () => Promise<UserClient>;
    serviceClient?: () => ServiceClient;
  } | null
): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "__setHrTestClients is a test seam and must never be called in production"
    );
  }
  if (overrides && process.env.HR_TEST_HARNESS !== "1") {
    throw new Error(
      "__setHrTestClients requires HR_TEST_HARNESS=1 — refusing to swap the auth client"
    );
  }
  testOverrides = overrides;
}

/**
 * User-scoped Supabase client. Carries the caller's session, so RLS applies.
 *
 * This is the client every HR READ path uses. The permission model lives in
 * the database (`hr_can_view_employee`), and reading through this client is
 * what makes that true rather than aspirational.
 */
export async function hrUserClient(): Promise<UserClient> {
  if (testOverrides?.userClient) return testOverrides.userClient();
  return createHostServerClient();
}

/**
 * Service-role Supabase client. Bypasses RLS entirely. SERVER-ONLY.
 *
 * Use ONLY on write paths, and only after an explicit authorisation gate has
 * already run (see `src/lib/hr/auth.ts`). Never use it to serve a read that a
 * user-scoped client could serve — doing so silently discards the whole
 * permission model, which is the mistake `src/lib/employer/auth.ts:41` makes
 * for its own (much lower-stakes) reasons.
 */
export function hrServiceClient(): ServiceClient {
  if (testOverrides?.serviceClient) return testOverrides.serviceClient();
  return createHostAdminClient();
}

/** Supabase client type, re-exported so module files need not import the SDK. */
export type HrSupabaseClient = UserClient;
