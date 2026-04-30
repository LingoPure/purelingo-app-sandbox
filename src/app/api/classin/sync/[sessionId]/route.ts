/**
 * Post-session sync pipeline for a single ClassIn session.
 *
 * Pipeline (briefing §07.2):
 *   1. Fetch ClassIn analytics → store participation_data_json
 *   2. If recording_url: download recording → Whisper → transcript text
 *   3. Score transcript via Claude rubric → upsert gap_scores source='session'
 *   4. Stamp transcribed_at = now()
 *
 * Auth: signed-in student, scoped to their own classin_sessions row.
 *
 * Demo path: POST body { transcript_text: "..." } skips steps 1+2 and runs
 * straight into step 3. This is the only way to exercise scoring end-to-end
 * before EEO ships SDK credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  fetchSessionAnalytics,
  downloadRecording,
  ClassinUnavailableError,
} from "@/lib/classin/api";
import { transcribeAudio } from "@/lib/transcription/whisper";
import { scoreSession } from "@/lib/scoring/score-session";

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type SyncBody = { transcript_text?: string };

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;

  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Confirm the session belongs to this user (RLS would prevent the read
  // anyway, but a clean 404 is friendlier than an empty result).
  const { data: session, error: sessErr } = await userClient
    .from("classin_sessions")
    .select("id, student_id, classin_class_id, recording_url, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as SyncBody;

  // ── Pipeline branch A: demo path with pasted transcript ────────────────
  if (body.transcript_text && body.transcript_text.trim()) {
    return runScoring(sessionId, user.id, body.transcript_text);
  }

  // ── Pipeline branch B: full ClassIn-driven path ────────────────────────
  try {
    const admin = adminSupabase();
    const analytics = await fetchSessionAnalytics(session.classin_class_id);

    await admin
      .from("classin_sessions")
      .update({
        attended: analytics.attended,
        duration_mins: Math.round(analytics.durationSecs / 60),
        recording_url: analytics.recordingUrl,
        participation_data_json: analytics.participation,
      })
      .eq("id", sessionId);

    if (!analytics.recordingUrl) {
      return NextResponse.json({
        ok: true,
        scored: false,
        reason: "No recording — analytics persisted but no transcript to score",
      });
    }

    const audio = await downloadRecording(analytics.recordingUrl);
    const transcript = await transcribeAudio(audio);
    return runScoring(sessionId, user.id, transcript);
  } catch (err) {
    if (err instanceof ClassinUnavailableError) {
      return NextResponse.json(
        {
          error: err.message,
          hint:
            "Pass { transcript_text } in the request body to score using a manually-supplied transcript while EEO credentials are pending.",
        },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runScoring(
  sessionId: string,
  studentId: string,
  transcript: string
) {
  try {
    const result = await scoreSession(adminSupabase(), {
      sessionId,
      studentId,
      transcript,
    });
    return NextResponse.json({
      ok: true,
      scored: true,
      skills_updated: result.skillsUpdated,
      overall_cefr: result.scores.overall_cefr,
      participation_summary: result.scores.participation_summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
