/**
 * ClassIn session-end webhook.
 *
 * Fires when the ClassIn SDK detects the live classroom has ended. The
 * client-side handler on /classroom/[sessionId] (Step 7b — not yet wired)
 * POSTs here with sessionId. Today this just stamps the row as completed
 * and queues the post-session sync job (Step 7b).
 *
 * Briefing §07.2 quote:
 *   "1. ClassIn SDK fires postMessage event on session end
 *    2. Client-side handler on classroom page calls /api/classin/session-end
 *       with sessionId
 *    3. API route queues background job: fetch ClassIn analytics for the
 *       session"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";

type Body = {
  session_id?: string;
  duration_secs?: number;
};

export async function POST(request: NextRequest) {
  const supabase = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.session_id) {
    return NextResponse.json(
      { error: "session_id required" },
      { status: 400 }
    );
  }

  // RLS prevents updating someone else's row — we don't need an extra check.
  const { error } = await supabase
    .from("classin_sessions")
    .update({
      status: "completed",
      attended: true,
      duration_mins: body.duration_secs
        ? Math.round(body.duration_secs / 60)
        : null,
    })
    .eq("id", body.session_id)
    .eq("student_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO(step 7b): trigger post-session sync
  //   - fetch ClassIn analytics → classin_sessions.participation_data_json
  //   - download recording → Whisper transcription
  //   - LLM evaluation → upsert gap_scores with source='session'

  return NextResponse.json({ ok: true });
}
