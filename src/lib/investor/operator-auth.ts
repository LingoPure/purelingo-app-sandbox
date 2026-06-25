/**
 * Operator (admin) auth for the investor dataroom console — PRODUCT_STANDARDS
 * §8.5 / §9.5. Access is gated by the ADMIN_EMAILS allowlist; rejection happens
 * POST-authentication (the login form accepts any creds, the gate rejects
 * non-operators after sign-in), never at the form level.
 *
 * Canonical allowlist (portfolio-manifest admin_users): the two human operators
 * + the admin-AGENT (QA_TEST_ADMIN_EMAIL). The user-agent (QA_TEST_USER_EMAIL,
 * dennis@factory2key.com.au) is deliberately NOT here — it must stay blocked
 * from /admin (VT_B2). Override per-deploy via the ADMIN_EMAILS env var.
 */

import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_OPERATORS = [
  "dennis@corporateaisolutions.com",
  "mcmdennis@gmail.com",
  "dennis+qaadmin@factory2key.com.au", // admin-AGENT (QA_TEST_ADMIN_EMAIL) — §9.5
];

export function operatorEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return env.length ? env : DEFAULT_OPERATORS.map((e) => e.toLowerCase());
}

export function isOperator(email: string | null | undefined): boolean {
  if (!email) return false;
  return operatorEmails().includes(email.toLowerCase());
}

/** Returns the operator's email, or null if the session user isn't an operator. */
export async function getOperator(): Promise<{ email: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isOperator(user.email)) return null;
  return { email: user.email };
}

/** API/action guard. Returns { email } or a 401/403 NextResponse to return. */
export async function requireOperator(): Promise<
  { email: string } | NextResponse
> {
  const { NextResponse } = await import("next/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isOperator(user.email)) {
    return NextResponse.json(
      { error: "Not authorised — operator only" },
      { status: 403 }
    );
  }
  return { email: user.email! };
}
