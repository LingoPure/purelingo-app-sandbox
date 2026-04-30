/**
 * Employer dashboard auth — single shared password for the demo.
 *
 * NOT a substitute for real per-employer auth in production. For the
 * pitch demo we want a single visible URL the buyer can poke at without
 * a Supabase signup. When this becomes a multi-tenant product, swap this
 * file for an `employer_admins` table + JWT role claim.
 *
 * Cookie scheme:
 *   - name: lp_employer
 *   - value: SHA256(EMPLOYER_DEMO_PASSWORD + EMPLOYER_AUTH_SALT) hex
 * The password itself never leaves the server.
 *
 * Uses Web Crypto API throughout (works in both Node and Edge Runtimes —
 * required because src/middleware.ts runs on Edge).
 */

export const EMPLOYER_COOKIE_NAME = "lp_employer";
const SALT = "lingopure-employer-2026";
const DEFAULT_PASSWORD = "lingopure-demo";

function configuredPassword(): string {
  return process.env.EMPLOYER_DEMO_PASSWORD ?? DEFAULT_PASSWORD;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. Returns false on length mismatch. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function expectedCookieValue(): Promise<string> {
  return sha256Hex(configuredPassword() + SALT);
}

export function passwordMatches(submitted: string): boolean {
  return constantTimeEqual(submitted, configuredPassword());
}

export async function cookieIsValid(
  value: string | undefined
): Promise<boolean> {
  if (!value) return false;
  const expected = await expectedCookieValue();
  return constantTimeEqual(value, expected);
}
