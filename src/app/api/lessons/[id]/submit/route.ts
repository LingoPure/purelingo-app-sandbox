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

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type Body = { submission?: string };

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

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.submission || !body.submission.trim()) {
    return NextResponse.json(
      { error: "submission required" },
      { status: 400 }
    );
  }

  // Look up the lesson type so we route to the right evaluator.
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

  if ((lesson as { type: string }).type !== "email_sprint") {
    return NextResponse.json(
      {
        error: `Submit handler for lesson type "${(lesson as { type: string }).type}" not yet implemented`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await submitEmailSprint(adminSupabase(), {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
