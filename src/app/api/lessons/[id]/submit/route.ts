/**
 * POST /api/lessons/[id]/submit — submit a response to a micro-lesson.
 *
 * Body: { submission: string }
 *
 * Routes on the lesson's type to the right evaluator. Today only
 * email_sprint is implemented.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { submitEmailSprint } from "@/lib/lessons/email-sprint-evaluate";
import { submitSpeakScore } from "@/lib/lessons/speak-score-evaluate";

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: lesson, error: lookupErr } = await userClient
    .from("micro_lessons")
    .select("type, status")
    .eq("id", id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lessonType = (lesson as { type: string }).type;

  try {
    const admin = adminSupabase();

    if (lessonType === "email_sprint") {
      const body = (await request.json().catch(() => ({}))) as {
        submission?: string;
      };
      if (!body.submission || !body.submission.trim()) {
        return NextResponse.json(
          { error: "submission required" },
          { status: 400 }
        );
      }
      const result = await submitEmailSprint(admin, {
        lessonId: id,
        studentId: user.id,
        submission: body.submission,
      });
      return NextResponse.json({
        ok: true,
        xp_awarded: result.xpAwarded,
        score_after: result.scoreAfter,
        evaluation: result.evaluation,
      });
    }

    if (lessonType === "speak_score") {
      // Audio upload comes as multipart/form-data with a file field "audio".
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof Blob)) {
        return NextResponse.json(
          { error: "audio file required (multipart/form-data, field name 'audio')" },
          { status: 400 }
        );
      }
      const result = await submitSpeakScore(admin, {
        lessonId: id,
        studentId: user.id,
        audio,
      });
      return NextResponse.json({
        ok: true,
        xp_awarded: result.xpAwarded,
        score_after: result.scoreAfter,
        transcript: result.transcript,
        evaluation: result.evaluation,
      });
    }

    return NextResponse.json(
      { error: `Submit handler for lesson type "${lessonType}" not yet implemented` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
