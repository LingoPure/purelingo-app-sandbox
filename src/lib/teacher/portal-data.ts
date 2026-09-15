/**
 * LingoPure — Teacher portal data (C6).
 *
 * Reads through the user-scoped client; every assessment read is gated by
 * `org_can_view_student` via the shared journey-data loaders, so the teacher
 * portal cannot drift from the report pages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listCompletedAssessments, loadLatestPipeline } from "@/lib/2k/journey-data";

export type TeacherStudent = {
  studentId: string;
  name: string;
  email: string | null;
  targetLevel: string | null;
  assignmentRole: string;
  assessments: number;
  latestScore: number | null;
  latestBand: string | null;
};

export type StudentDetail = TeacherStudent & {
  nativeLanguage: string | null;
  employerName: string | null;
};

/**
 * The teacher's currently-assigned students with their latest LP1000 result.
 */
export async function loadTeacherStudents(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherStudent[]> {
  const { data: assignments } = await supabase
    .from("student_teacher_assignments")
    .select(
      "student_id, assignment_role, students(id, name, email, target_level)"
    )
    .eq("teacher_id", teacherId)
    .is("ended_at", null)
    .order("assignment_role");

  if (!assignments) return [];

  const results: TeacherStudent[] = [];
  for (const a of assignments) {
    const student = a.students as unknown as {
      id: string;
      name: string;
      email: string | null;
      target_level: string | null;
    } | null;
    if (!student) continue;

    const { count: assessmentCount } = await supabase
      .from("assessment_sessions")
      .select("assessment_id", { count: "exact", head: true })
      .eq("learner_id", student.id)
      .eq("status", "COMPLETE");

    let latestScore: number | null = null;
    let latestBand: string | null = null;
    const latest = await loadLatestPipeline(supabase, student.id);
    if (latest) {
      latestScore = latest.result.lp1000.score;
      latestBand = latest.result.lp1000.band;
    }

    results.push({
      studentId: student.id,
      name: student.name,
      email: student.email,
      targetLevel: student.target_level,
      assignmentRole: a.assignment_role,
      assessments: assessmentCount ?? 0,
      latestScore,
      latestBand,
    });
  }

  return results;
}

/**
 * Full context for one of the teacher's own students (assignment verified).
 */
export async function loadStudentDetail(
  supabase: SupabaseClient,
  teacherId: string,
  studentId: string
): Promise<StudentDetail | null> {
  const { data: assignment } = await supabase
    .from("student_teacher_assignments")
    .select(
      "assignment_role, students(id, name, email, target_level, native_language, employer_id, employers(name))"
    )
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .is("ended_at", null)
    .maybeSingle();

  if (!assignment) return null;

  const student = assignment.students as unknown as {
    id: string;
    name: string;
    email: string | null;
    target_level: string | null;
    native_language: string | null;
    employer_id: string | null;
    employers: { name: string } | null;
  } | null;
  if (!student) return null;

  const { count: assessmentCount } = await supabase
    .from("assessment_sessions")
    .select("assessment_id", { count: "exact", head: true })
    .eq("learner_id", student.id)
    .eq("status", "COMPLETE");

  let latestScore: number | null = null;
  let latestBand: string | null = null;
  const latest = await loadLatestPipeline(supabase, student.id);
  if (latest) {
    latestScore = latest.result.lp1000.score;
    latestBand = latest.result.lp1000.band;
  }

  return {
    studentId: student.id,
    name: student.name,
    email: student.email,
    targetLevel: student.target_level,
    assignmentRole: assignment.assignment_role,
    assessments: assessmentCount ?? 0,
    latestScore,
    latestBand,
    nativeLanguage: student.native_language,
    employerName: student.employers?.name ?? null,
  };
}

export type ClassSession = {
  scheduleId: string;
  studentId: string;
  studentName: string | null;
  scheduledAt: string | null;
  status: string | null;
  durationMins: number | null;
  teacherName: string | null;
  recordingUrl: string | null;
};

/** A student's ClassIn sessions (org/teacher read via 0049 RLS). */
export async function loadStudentClasses(
  supabase: SupabaseClient,
  studentId: string
): Promise<ClassSession[]> {
  const { data, error } = await supabase
    .from("classin_sessions")
    .select(
      `id, scheduled_at, status, duration_mins, teacher_name, recording_url,
       students(name)`
    )
    .eq("student_id", studentId)
    .order("scheduled_at", { ascending: false });

  if (error) return [];
  if (!data) return [];

  return data.map((row) => ({
    scheduleId: row.id,
    studentId,
    studentName: (row.students as unknown as { name: string } | null)?.name ?? null,
    scheduledAt: row.scheduled_at as string | null,
    status: row.status as string | null,
    durationMins: row.duration_mins as number | null,
    teacherName: row.teacher_name as string | null,
    recordingUrl: row.recording_url as string | null,
  }));
}

/** Upcoming (and recent) classes across the teacher's assigned students. */
export async function loadTeacherClasses(
  supabase: SupabaseClient,
  teacherId: string
): Promise<ClassSession[]> {
  const { data: assignments } = await supabase
    .from("student_teacher_assignments")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .is("ended_at", null);

  const studentIds = (assignments ?? []).map((a) => a.student_id);
  if (studentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("classin_sessions")
    .select(
      `id, student_id, scheduled_at, status, duration_mins, teacher_name, recording_url,
       students(name)`
    )
    .in("student_id", studentIds)
    .order("scheduled_at", { ascending: false });

  if (error) return [];
  if (!data) return [];

  return data.map((row) => ({
    scheduleId: row.id,
    studentId: row.student_id,
    studentName: (row.students as unknown as { name: string } | null)?.name ?? null,
    scheduledAt: row.scheduled_at as string | null,
    status: row.status as string | null,
    durationMins: row.duration_mins as number | null,
    teacherName: row.teacher_name as string | null,
    recordingUrl: row.recording_url as string | null,
  }));
}

export { listCompletedAssessments };

export type { AssessmentSummary } from "@/lib/2k/journey-data";