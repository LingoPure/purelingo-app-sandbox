/**
 * Manual re-score endpoint for the discovery gap scoring engine.
 *
 * The webhook (POST /api/convai/webhook) calls scoreDiscoverySession() in-
 * process the moment a discovery call finishes. This route exists for the
 * cases when:
 *   - the webhook hand-off failed and the student or admin wants to retry
 *   - a coach wants to re-run scoring after the rubric has been tuned
 *   - a demo/QA flow needs to score a transcript on demand
 *
 * Auth: a logged-in student can only re-score their OWN latest complete
 * discovery session. There is no admin override — that's intentional for the
 * demo. If we need cross-student scoring later, gate on a service-role secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  scoreDiscoverySession,
  type TranscriptTurn,
} from "@/lib/scoring/score-discovery";
import { awardXp } from "@/lib/gamification/award";

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function POST(_request: NextRequest) {
  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Latest completed discovery session for this student (single row by design —
  // we score per-student, not per-call).
  const { data: session, error: sessionErr } = await userClient
    .from("discovery_sessions")
    .select("id, convai_conversation_id, transcript_json, status")
    .eq("student_id", user.id)
    .eq("status", "complete")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json(
      { error: "No completed discovery session to score" },
      { status: 404 }
    );
  }
  if (!session.convai_conversation_id) {
    return NextResponse.json(
      { error: "Session has no conversation_id; cannot score" },
      { status: 422 }
    );
  }

  const transcript = session.transcript_json as TranscriptTurn[] | null;
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json(
      { error: "Session transcript is empty" },
      { status: 422 }
    );
  }

  try {
    const admin = adminSupabase();
    const result = await scoreDiscoverySession(admin, {
      studentId: user.id,
      conversationId: session.convai_conversation_id,
      transcript,
    });
    // First-time discovery completion is a big XP moment for the demo.
    await awardXp(user.id, "discoveryComplete", admin);
    return NextResponse.json({
      ok: true,
      overall_cefr: result.scores.overall_cefr,
      target_level: result.scores.target_level,
      summary: result.scores.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
