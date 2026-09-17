/**
 * POST /api/convai/bind — bind an ElevenLabs voice conversation to the
 * authenticated user (server-trusted identity for the memory-loop tool routes).
 *
 * The VoiceWidget calls this from onConnect(conversationId) in the user's
 * already-authenticated browser. We resolve the user from the SESSION (never
 * the client-supplied dynamic variable) and store the binding, so the
 * memory-loop tool routes and post-call webhook label the call's memory
 * against the right user even if a tampered client lies about user_id.
 *
 * Body: { conversationId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Use admin client for the upsert (RLS is on but no user policies — same
  // posture as investor_voice_sessions).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const svc = createAdminClient();
  const { error } = await svc.from("convai_voice_bindings").upsert(
    {
      elevenlabs_conversation_id: conversationId,
      user_id: user.id,
    },
    { onConflict: "elevenlabs_conversation_id" }
  );
  if (error) {
    console.error(`[convai/bind] upsert failed: ${error.message}`);
    return NextResponse.json({ error: "Could not bind session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
