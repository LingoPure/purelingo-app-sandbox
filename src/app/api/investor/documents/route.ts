/**
 * GET /api/investor/documents — the investor's tier-filtered document list.
 *
 * Powers the voice-surface "find a document" finder. Returns only metadata for
 * the tiers the investor is cleared for (the same filter the Documents page
 * uses); the actual file still flows through /documents/[id]/download, which
 * re-checks the tier, watermarks, and audits. No file bytes here — just the list
 * the investor is already entitled to see on the Documents page.
 */

import { NextResponse } from "next/server";
import { requireInvestor, allowedTiersFor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;

  const tiers = allowedTiersFor(investor.maxTier);
  const svc = createAdminClient();
  const { data, error } = await svc
    .from("dataroom_documents")
    .select("id, display_name, category, confidentiality_tier, format")
    .in("confidentiality_tier", tiers)
    .order("display_name");
  if (error) {
    return NextResponse.json({ error: "Could not list documents" }, { status: 502 });
  }
  return NextResponse.json({ documents: data ?? [] });
}
