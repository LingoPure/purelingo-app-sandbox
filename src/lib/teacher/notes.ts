/**
 * LingoPure — Teacher notes (C6 §7 / 0045).
 *
 * Reads go through the USER-scoped client gated by `org_can_view_student`
 * (0045 SELECT policy). Writes go through the admin client after the
 * getTeacherIdentity route gate — service-role, no RLS insert policy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherNote = {
  id: string;
  teacher_id: string;
  student_id: string;
  body: string;
  created_at: string;
  student_name: string | null;
};

/** Notes visible to the caller (own/org via RLS), newest first. */
export async function loadTeacherNotes(
  supabase: SupabaseClient,
  limit = 100
): Promise<TeacherNote[]> {
  const { data, error } = await supabase
    .from("teacher_notes")
    .select("id, teacher_id, student_id, body, created_at, students(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`teacher_notes read failed: ${error.message}`);
  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    student_id: row.student_id,
    body: row.body,
    created_at: row.created_at,
    student_name:
      (row.students as unknown as { name: string } | null)?.name ?? null,
  }));
}

/** Create a note for one student (service-role); teacherId from the gate. */
export async function createTeacherNote(
  admin: SupabaseClient,
  teacherId: string,
  studentId: string,
  body: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note body cannot be empty");

  const { error } = await admin.from("teacher_notes").insert({
    teacher_id: teacherId,
    student_id: studentId,
    body: trimmed,
  });
  if (error) throw new Error(`teacher_notes insert failed: ${error.message}`);
}