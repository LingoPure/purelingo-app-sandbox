/**
 * Employer-dashboard auth.
 *
 * Real auth, finally. /employer/* is gated on:
 *   1. A valid Supabase user session (cookie set by /login)
 *   2. A row in public.employer_admins linking that user to an employer
 *
 * The old shared-password cookie scheme has been removed — historic
 * exports kept here as no-op stubs so existing imports don't fail
 * during the cutover, but they're unused. Delete them once the next
 * migration sweep has confirmed nothing references them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type EmployerAdminRow = {
  authUserId: string;
  employerId: string;
  adminRole: "owner" | "hr" | "viewer";
};

/**
 * Returns the admin row for the given user, or null if they're not an
 * employer admin. Uses an authenticated client (RLS enforces that a user
 * can only read their own employer_admins row), so safe to call from any
 * server context that has a user-scoped supabase client.
 */
export async function loadEmployerAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<EmployerAdminRow | null> {
  const { data, error } = await supabase
    .from("employer_admins")
    .select("auth_user_id, employer_id, admin_role")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[employer-auth] employer_admins lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as {
    auth_user_id: string;
    employer_id: string;
    admin_role: "owner" | "hr" | "viewer";
  };
  return {
    authUserId: row.auth_user_id,
    employerId: row.employer_id,
    adminRole: row.admin_role,
  };
}

/**
 * API-route guard. Returns the admin row on success, or a NextResponse
 * (401 / 403) on failure that the caller should return immediately.
 *
 *   const auth = await requireEmployerAdmin();
 *   if (auth instanceof NextResponse) return auth;
 *   const { admin } = auth; // safe to use admin.employerId
 */
export async function requireEmployerAdmin(): Promise<
  { admin: EmployerAdminRow } | import("next/server").NextResponse
> {
  const { NextResponse } = await import("next/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const admin = await loadEmployerAdmin(supabase, user.id);
  if (!admin) {
    return NextResponse.json(
      { error: "Not authorised — employer admin only" },
      { status: 403 }
    );
  }
  return { admin };
}

/* ─── Legacy cookie helpers — DEPRECATED ─────────────────────────────────────
 * Kept as no-op stubs so any imports still on disk don't break the build
 * during the cutover. The middleware + layout no longer call these. Remove
 * in the next sweep after confirming all callers are gone.
 */
export const EMPLOYER_COOKIE_NAME = "lp_employer";

export async function cookieIsValid(
  _value: string | undefined
): Promise<boolean> {
  return false;
}

export function passwordMatches(_submitted: string): boolean {
  return false;
}

export async function expectedCookieValue(): Promise<string> {
  return "";
}
