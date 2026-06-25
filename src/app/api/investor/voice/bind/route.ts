/**
 * POST /api/investor/voice/bind — bind an ElevenLabs voice conversation to the
 * authenticated investor (server-trusted identity for the post-call webhook).
 *
 * The VoiceWidget calls this from onConnect(conversationId) in the investor's
 * already-authenticated browser. We resolve the investor from the SESSION (never
 * the client-supplied dynamic variable) and store the binding, so the post-call
 * webhook labels the call's memory against the right investor even if a tampered
 * client lies about user_id. The blessed identity pattern from the VoiceWidget.
 *
 * Body: { conversationId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;

  let conversationId: string;
  try {
    const body = await req.json();
    conversationId = String(body?.conversationId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const svc = createAdminClient();
  const { error } = await svc.from("investor_voice_sessions").upsert(
    {
      elevenlabs_conversation_id: conversationId,
      investor_id: investor.id,
    },
    { onConflict: "elevenlabs_conversation_id" }
  );
  if (error) {
    console.error(`[investor/voice/bind] upsert failed: ${error.message}`);
    return NextResponse.json({ error: "Could not bind session" }, { status: 500 });
  }

  // Best-effort audit so the operator console's access log shows voice usage too.
  await svc
    .from("dataroom_audit")
    .insert({
      investor_id: investor.id,
      action: "voice_session",
      detail: { conversation_id: conversationId },
    })
    .then(
      () => {},
      () => {}
    );

  return NextResponse.json({ ok: true });
}
