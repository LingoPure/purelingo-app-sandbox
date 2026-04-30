/**
 * Schedule a ClassIn session for the signed-in student.
 *
 * Real production use will receive scheduling events from the LingoPure
 * coordinator UI (Phase 2) or from a ClassIn LTI scheduling call. For the
 * demo / test flow we let the student schedule their own session via the
 * dashboard — sufficient to exercise the embed page end-to-end.
 *
 * RLS policy `classin_sessions_self_insert` (migration 0004) gates the
 * insert to student_id = auth.uid().
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateSessionBody = {
  scheduled_at?: string;
  teacher_name?: string;
  classin_class_id?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateSessionBody;

  // Defaults are demo-friendly: a class 24h from now with a fictional teacher
  // name. The classin_class_id is opaque to LingoPure — it's whatever ClassIn
  // hands back when a real class is created via LTI.
  const scheduledAt =
    body.scheduled_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const teacherName = body.teacher_name ?? "Coach Linh";
  const classinClassId =
    body.classin_class_id ?? `demo-${Math.random().toString(36).slice(2, 10)}`;

  const { data, error } = await supabase
    .from("classin_sessions")
    .insert({
      student_id: user.id,
      classin_class_id: classinClassId,
      scheduled_at: scheduledAt,
      teacher_name: teacherName,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
