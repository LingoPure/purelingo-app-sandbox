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
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const EMPLOYER_COOKIE_NAME = "lp_employer";
const SALT = "lingopure-employer-2026";
const DEFAULT_PASSWORD = "lingopure-demo";

function configuredPassword(): string {
  return process.env.EMPLOYER_DEMO_PASSWORD ?? DEFAULT_PASSWORD;
}

export function expectedCookieValue(): string {
  return createHash("sha256")
    .update(configuredPassword() + SALT)
    .digest("hex");
}

export function passwordMatches(submitted: string): boolean {
  const expected = configuredPassword();
  if (submitted.length !== expected.length) return false;
  // timingSafeEqual requires equal-length buffers — checked above.
  return timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
}

export function cookieIsValid(value: string | undefined): boolean {
  if (!value) return false;
  const expected = expectedCookieValue();
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
