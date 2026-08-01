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
 * Keep this file free of logic. It is a re-export surface, nothing more.
 */

import { createClient as createHostServerClient } from "@/lib/supabase/server";
import { createAdminClient as createHostAdminClient } from "@/lib/supabase/admin";

/**
 * User-scoped Supabase client. Carries the caller's session, so RLS applies.
 *
 * This is the client every HR READ path uses. The permission model lives in
 * the database (`hr_can_view_employee`), and reading through this client is
 * what makes that true rather than aspirational.
 */
export async function hrUserClient() {
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
export function hrServiceClient() {
  return createHostAdminClient();
}

/** Supabase client type, re-exported so module files need not import the SDK. */
export type HrSupabaseClient = Awaited<ReturnType<typeof hrUserClient>>;
