import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import { createTeacherNote } from "@/lib/teacher/notes";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) {
    return NextResponse.json({ error: "Not a teacher" }, { status: 403 });
  }

  let payload: { studentId?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { studentId, body } = payload;
  if (!studentId || typeof body !== "string") {
    return NextResponse.json({ error: "studentId and body required" }, { status: 400 });
  }

  try {
    await createTeacherNote(createAdminClient(), teacher.teacherId, studentId, body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save note" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}