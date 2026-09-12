/**
 * Organisation authorisation (C1/C5).
 *
 * The permission model lives in the DATABASE — `current_org_role(org_id)`,
 * `org_is_owner_or_hr(org_id)` in 0038, membership rows in
 * `organisation_memberships`. This module is the thin server-side reader,
 * following the HR auth pattern (src/lib/hr/auth.ts): reads go through the
 * user-scoped client so RLS applies; the helpers never re-derive the rules
 * in TypeScript.
 *
 * TWO RULES THAT MATTER (mirrored from HR):
 *
 * 1. Reads go through the USER-SCOPED client so RLS applies. Do NOT reach
 *    for the service-role client to sidestep a cookie-timing race — that
 *    bypasses RLS wholesale and quietly deletes "an Admin sees only their
 *    team" which IS the product here.
 *
 * 2. Gate on what the database says, not on a local copy of the rule.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type OrgRole =
  | "owner"
  | "hr"
  | "viewer"
  | "teacher"
  | "staff"
  | "student"
  | null;

const ORG_ROLES: OrgRole[] = ["owner", "hr", "viewer", "teacher", "staff", "student"];

export type OrgIdentity = {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: OrgRole;
  isOwnerOrHr: boolean;
};

/**
 * The signed-in user's membership in one organisation, or null.
 * Resolves via `current_org_role(org_id)`.
 */
export async function getOrgIdentity(
  supabase: SupabaseClient,
  user: User,
  orgId: string
): Promise<OrgIdentity | null> {
  const { data: role, error } = await supabase.rpc("current_org_role", {
    target_org_id: orgId,
  });
  if (error || !role) return null;

  // Legit roles only — "none"/null means no membership.
  if (!ORG_ROLES.includes(role as OrgRole)) return null;

  const { data: org } = await supabase
    .from("organisations")
    .select("id, slug, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;

  const isOwnerOrHr = role === "owner" || role === "hr";

  return {
    userId: user.id,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    role: role as OrgRole,
    isOwnerOrHr,
  };
}

/**
 * API-route guard for a specific org. Returns the identity on success, or a
 * NextResponse (401 / 403) the caller should return immediately. When
 * `roles` is provided the caller must hold one of them, otherwise any active
 * membership role passes.
 *
 *   const auth = await requireOrgRole(supabase, user, orgId);
 *   if (auth instanceof NextResponse) return auth;
 *   const { identity } = auth;
 */
export async function requireOrgRole(
  supabase: SupabaseClient,
  user: User,
  orgId: string,
  roles?: OrgRole[]
): Promise<
  { identity: OrgIdentity } | import("next/server").NextResponse
> {
  const { NextResponse } = await import("next/server");

  const identity = await getOrgIdentity(supabase, user, orgId);
  if (!identity) {
    return NextResponse.json(
      { error: "Not a member of this organisation" },
      { status: 403 }
    );
  }

  if (roles && identity.role !== null && !roles.includes(identity.role)) {
    return NextResponse.json(
      { error: `Requires role: ${roles.join(" / ")}` },
      { status: 403 }
    );
  }

  return { identity };
}