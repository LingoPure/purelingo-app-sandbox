/**
 * POST /api/investor/nda/accept — the NDA click-through gate (Phase 3).
 *
 * Dan's rule: no NDA → main dataroom only; accepting the NDA → deep dive.
 * Accepting writes the durable acceptance ledger, flips the investor's
 * max_tier main→restricted (service-role; the client can never self-elevate),
 * and audits it. Idempotent if already accepted.
 *
 * Body: { signerName: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NDA_VERSION } from "@/lib/investor/nda-text";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;

  let signerName: string;
  try {
    const body = await req.json();
    signerName = String(body?.signerName ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (signerName.length < 2) {
    return NextResponse.json(
      { error: "Type your full legal name to accept." },
      { status: 400 }
    );
  }

  if (investor.maxTier === "restricted" && investor.ndaAcceptedAt) {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  const svc = createAdminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const acceptedAt = new Date().toISOString();

  // 1. Durable ledger row (survives a later grant revoke).
  const led = await svc.from("investor_nda_acceptances").insert({
    investor_id: investor.id,
    nda_version: NDA_VERSION,
    signer_name: signerName,
    ip_address: ip,
    user_agent: ua,
  });
  if (led.error) {
    return NextResponse.json(
      { error: `Could not record acceptance: ${led.error.message}` },
      { status: 500 }
    );
  }

  // 2. Flip the tier (the unlock).
  const upd = await svc
    .from("investors")
    .update({
      max_tier: "restricted",
      nda_accepted_at: acceptedAt,
      nda_version: NDA_VERSION,
      nda_signer_name: signerName,
    })
    .eq("id", investor.id);
  if (upd.error) {
    return NextResponse.json(
      { error: `Could not unlock deep dive: ${upd.error.message}` },
      { status: 500 }
    );
  }

  // 3. Audit (best-effort — never mask the success).
  await svc
    .from("dataroom_audit")
    .insert({
      investor_id: investor.id,
      action: "nda_accept",
      detail: { nda_version: NDA_VERSION, signer_name: signerName },
    })
    .then(
      () => {},
      () => {}
    );

  return NextResponse.json({ ok: true });
}
