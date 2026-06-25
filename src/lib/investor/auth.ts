/**
 * Investor-portal auth (third audience, mirrors src/lib/employer/auth.ts).
 *
 * /investor/* is gated on:
 *   1. A valid Supabase user session (cookie set by /login)
 *   2. An ACTIVE row in public.investors for that user
 *
 * Tier (the NDA gate): an investor's max_tier is 'main' until they accept the
 * NDA, then 'restricted'. allowedTiersFor() maps that to the tiers the
 * retrieval RPC is permitted to search — never trust a tier from the client.
 */

import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Tier = "main" | "restricted";

export type InvestorRow = {
  id: string;
  fullName: string | null;
  firm: string | null;
  email: string;
  maxTier: Tier;
  status: "active" | "revoked";
  ndaAcceptedAt: string | null;
};

/** The tiers an investor of the given max_tier may have retrieved. */
export function allowedTiersFor(maxTier: Tier): Tier[] {
  return maxTier === "restricted" ? ["main", "restricted"] : ["main"];
}

/**
 * Returns the investor row for the given user, or null if they aren't an
 * investor. Uses the service-role client (we pass the user id explicitly; no
 * RLS auth context needed — same rationale as loadEmployerAdmin).
 */
export async function loadInvestor(userId: string): Promise<InvestorRow | null> {
  const svc = createAdminClient();
  const { data, error } = await svc
    .from("investors")
    .select("id, full_name, firm, email, max_tier, status, nda_accepted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[investor-auth] investors lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as {
    id: string;
    full_name: string | null;
    firm: string | null;
    email: string;
    max_tier: Tier;
    status: "active" | "revoked";
    nda_accepted_at: string | null;
  };
  return {
    id: row.id,
    fullName: row.full_name,
    firm: row.firm,
    email: row.email,
    maxTier: row.max_tier,
    status: row.status,
    ndaAcceptedAt: row.nda_accepted_at,
  };
}

/**
 * API-route guard. Returns { investor } on success, or a NextResponse
 * (401 / 403) the caller should return immediately.
 *
 *   const auth = await requireInvestor();
 *   if (auth instanceof NextResponse) return auth;
 *   const { investor } = auth;
 */
export async function requireInvestor(): Promise<
  { investor: InvestorRow } | NextResponse
> {
  const { NextResponse } = await import("next/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const investor = await loadInvestor(user.id);
  if (!investor || investor.status !== "active") {
    return NextResponse.json(
      { error: "Not authorised — investor access only" },
      { status: 403 }
    );
  }
  return { investor };
}
