/**
 * POST /api/lessons — start a new micro-lesson.
 *
 * Body: { type: "email_sprint" }
 *
 * For now only email_sprint is implemented. As we add more lesson types
 * (vocab_challenge, role_simulation, etc.) we'll route on `type` to the
 * right generator.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createEmailSprintLesson } from "@/lib/lessons/email-sprint-generate";

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type Body = { type?: string };

export async function POST(request: NextRequest) {
  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const type = body.type ?? "email_sprint";

  if (type !== "email_sprint") {
    return NextResponse.json(
      { error: `Lesson type "${type}" not yet implemented` },
      { status: 400 }
    );
  }

  try {
    const result = await createEmailSprintLesson(adminSupabase(), {
      studentId: user.id,
    });
    return NextResponse.json({ ok: true, id: result.id, prompt: result.prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lesson creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
