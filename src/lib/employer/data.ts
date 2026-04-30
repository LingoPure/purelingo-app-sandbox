/**
 * Employer-side data aggregation.
 *
 * All queries here run with the SERVICE ROLE Supabase client because RLS on
 * the student-facing tables (gap_scores, micro_lessons, classin_sessions)
 * scopes everything to auth.uid(). The middleware gate at /employer/* is the
 * boundary protecting these queries.
 */

import { createClient } from "@supabase/supabase-js";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

export function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export type CohortStudent = {
  id: string;
  name: string | null;
  email: string | null;
  target_level: string | null;
  discovery_status: string | null;
  scores: Record<SkillKey, number | null>;
  averageScore: number | null;
  totalXp: number;
  lessonsCompleted: number;
  classesCompleted: number;
  lastActivityAt: string | null;
  highestCert: string | null;
  pendingCertLevel: string | null;
};

export type CohortSummary = {
  studentCount: number;
  totalXp: number;
  totalLessonsCompleted: number;
  totalClassesCompleted: number;
  averageBySkill: Record<SkillKey, number | null>;
  pctAtTarget: number;
  certifiedCount: number;
};

export type ActivityEvent = {
  kind: "discovery" | "class" | "lesson_email" | "lesson_speak";
  studentName: string;
  studentId: string;
  occurredAt: string;
  detail: string;
};

type StudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  target_level: string | null;
  discovery_status: string | null;
  created_at: string;
};

type ScoreRow = { student_id: string; skill: string; score: number | null };
type LessonAggRow = {
  student_id: string;
  status: string | null;
  xp_awarded: number | null;
  type: string | null;
  completed_at: string | null;
};
type ClassAggRow = {
  student_id: string;
  status: string | null;
  scheduled_at: string | null;
  teacher_name: string | null;
  transcribed_at: string | null;
};
type DiscoveryRow = {
  student_id: string;
  completed_at: string | null;
  status: string | null;
};

type CertRow = {
  student_id: string;
  level: string;
  status: string;
  issued_at: string | null;
};

const CERT_RANK: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export async function loadCohortStudents(): Promise<CohortStudent[]> {
  const supabase = adminSupabase();
  const [studentsRes, scoresRes, lessonsRes, classesRes, certsRes] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, name, email, target_level, discovery_status, created_at")
        .order("created_at", { ascending: false })
        .returns<StudentRow[]>(),
      supabase
        .from("gap_scores")
        .select("student_id, skill, score")
        .returns<ScoreRow[]>(),
      supabase
        .from("micro_lessons")
        .select("student_id, status, xp_awarded, type, completed_at")
        .returns<LessonAggRow[]>(),
      supabase
        .from("classin_sessions")
        .select("student_id, status, scheduled_at, teacher_name, transcribed_at")
        .returns<ClassAggRow[]>(),
      supabase
        .from("certifications")
        .select("student_id, level, status, issued_at")
        .returns<CertRow[]>(),
    ]);

  const students = studentsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const lessons = lessonsRes.data ?? [];
  const classes = classesRes.data ?? [];
  const certs = certsRes.data ?? [];

  return students.map((s) => {
    const subScores: Record<SkillKey, number | null> = Object.fromEntries(
      SKILL_KEYS.map((k) => [k, null])
    ) as Record<SkillKey, number | null>;

    for (const row of scores) {
      if (row.student_id !== s.id) continue;
      if (SKILL_KEYS.includes(row.skill as SkillKey)) {
        subScores[row.skill as SkillKey] = row.score;
      }
    }

    const studentLessons = lessons.filter((l) => l.student_id === s.id);
    const totalXp = studentLessons.reduce(
      (sum, l) => sum + (l.xp_awarded ?? 0),
      0
    );
    const lessonsCompleted = studentLessons.filter(
      (l) => l.status === "completed"
    ).length;

    const studentClasses = classes.filter((c) => c.student_id === s.id);
    const classesCompleted = studentClasses.filter(
      (c) => c.status === "completed"
    ).length;

    const lastLesson = studentLessons
      .filter((l) => l.completed_at)
      .sort((a, b) =>
        (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
      )[0]?.completed_at;
    const lastClass = studentClasses
      .filter((c) => c.scheduled_at)
      .sort((a, b) =>
        (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "")
      )[0]?.scheduled_at;
    const lastActivityAt =
      [lastLesson, lastClass, s.created_at]
        .filter((v): v is string => Boolean(v))
        .sort((a, b) => b.localeCompare(a))[0] ?? null;

    const present = SKILL_KEYS.map((k) => subScores[k]).filter(
      (n): n is number => typeof n === "number"
    );
    const averageScore =
      present.length > 0
        ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
        : null;

    const studentCerts = certs.filter((c) => c.student_id === s.id);
    const passedLevels = studentCerts
      .filter((c) => c.status === "passed")
      .map((c) => c.level);
    const highestCert =
      passedLevels.length > 0
        ? passedLevels.sort(
            (a, b) => (CERT_RANK[b] ?? 0) - (CERT_RANK[a] ?? 0)
          )[0]
        : null;
    const pendingCert = studentCerts.find(
      (c) => c.status === "scheduled" || c.status === "in_progress"
    );
    const pendingCertLevel = pendingCert?.level ?? null;

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      target_level: s.target_level,
      discovery_status: s.discovery_status,
      scores: subScores,
      averageScore,
      totalXp,
      lessonsCompleted,
      classesCompleted,
      lastActivityAt,
      highestCert,
      pendingCertLevel,
    };
  });
}

export function summariseCohort(students: CohortStudent[]): CohortSummary {
  const studentCount = students.length;
  const totalXp = students.reduce((sum, s) => sum + s.totalXp, 0);
  const totalLessonsCompleted = students.reduce(
    (sum, s) => sum + s.lessonsCompleted,
    0
  );
  const totalClassesCompleted = students.reduce(
    (sum, s) => sum + s.classesCompleted,
    0
  );

  const averageBySkill: Record<SkillKey, number | null> = Object.fromEntries(
    SKILL_KEYS.map((k) => [k, null])
  ) as Record<SkillKey, number | null>;

  for (const skill of SKILL_KEYS) {
    const present = students
      .map((s) => s.scores[skill])
      .filter((n): n is number => typeof n === "number");
    averageBySkill[skill] =
      present.length > 0
        ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
        : null;
  }

  const studentsWithAverage = students.filter((s) => s.averageScore !== null);
  const atTarget = studentsWithAverage.filter(
    (s) => (s.averageScore ?? 0) >= 80
  ).length;
  const pctAtTarget =
    studentsWithAverage.length > 0
      ? Math.round((atTarget / studentsWithAverage.length) * 100)
      : 0;

  const certifiedCount = students.filter((s) => s.highestCert !== null).length;

  return {
    studentCount,
    totalXp,
    totalLessonsCompleted,
    totalClassesCompleted,
    averageBySkill,
    pctAtTarget,
    certifiedCount,
  };
}

export async function loadActivityFeed(limit = 12): Promise<ActivityEvent[]> {
  const supabase = adminSupabase();
  const [discoveryRes, classRes, lessonRes, studentsRes] = await Promise.all([
    supabase
      .from("discovery_sessions")
      .select("student_id, completed_at, status")
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(20)
      .returns<DiscoveryRow[]>(),
    supabase
      .from("classin_sessions")
      .select("student_id, status, scheduled_at, teacher_name, transcribed_at")
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(20)
      .returns<ClassAggRow[]>(),
    supabase
      .from("micro_lessons")
      .select("student_id, status, xp_awarded, type, completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(20)
      .returns<LessonAggRow[]>(),
    supabase
      .from("students")
      .select("id, name")
      .returns<{ id: string; name: string | null }[]>(),
  ]);

  const nameById = new Map(
    (studentsRes.data ?? []).map((s) => [s.id, s.name ?? "Student"])
  );

  const events: ActivityEvent[] = [];

  for (const d of discoveryRes.data ?? []) {
    if (!d.completed_at) continue;
    events.push({
      kind: "discovery",
      studentName: nameById.get(d.student_id) ?? "Student",
      studentId: d.student_id,
      occurredAt: d.completed_at,
      detail: "completed discovery session",
    });
  }
  for (const c of classRes.data ?? []) {
    if (!c.scheduled_at) continue;
    events.push({
      kind: "class",
      studentName: nameById.get(c.student_id) ?? "Student",
      studentId: c.student_id,
      occurredAt: c.scheduled_at,
      detail: c.teacher_name
        ? `attended class with ${c.teacher_name}`
        : "attended a class",
    });
  }
  for (const l of lessonRes.data ?? []) {
    if (!l.completed_at) continue;
    events.push({
      kind: l.type === "speak_score" ? "lesson_speak" : "lesson_email",
      studentName: nameById.get(l.student_id) ?? "Student",
      studentId: l.student_id,
      occurredAt: l.completed_at,
      detail: `+${l.xp_awarded ?? 0} XP — ${
        l.type === "speak_score" ? "speak & score" : "email sprint"
      }`,
    });
  }

  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return events.slice(0, limit);
}

export type StudentDetail = {
  student: CohortStudent;
  profile: {
    summary?: string;
    target_why?: string;
    learning_style_notes?: string;
    overall_cefr?: string;
  } | null;
  recentLessons: {
    id: string;
    type: string;
    completed_at: string | null;
    xp_awarded: number | null;
    score_after: number | null;
  }[];
  recentClasses: {
    id: string;
    teacher_name: string | null;
    scheduled_at: string | null;
    transcribed_at: string | null;
  }[];
  certifications: {
    id: string;
    level: string;
    status: string;
    issued_at: string | null;
    created_at: string;
  }[];
};

export async function loadStudentDetail(
  studentId: string
): Promise<StudentDetail | null> {
  const supabase = adminSupabase();

  const cohort = await loadCohortStudents();
  const student = cohort.find((s) => s.id === studentId);
  if (!student) return null;

  const [profileRes, lessonsRes, classesRes, certsRes] = await Promise.all([
    supabase
      .from("discovery_sessions")
      .select("profile_json")
      .eq("student_id", studentId)
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("micro_lessons")
      .select("id, type, completed_at, xp_awarded, score_after")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("classin_sessions")
      .select("id, teacher_name, scheduled_at, transcribed_at")
      .eq("student_id", studentId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("certifications")
      .select("id, level, status, issued_at, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    student,
    profile: (profileRes.data?.profile_json ?? null) as
      | StudentDetail["profile"]
      | null,
    recentLessons: (lessonsRes.data ?? []) as StudentDetail["recentLessons"],
    recentClasses: (classesRes.data ?? []) as StudentDetail["recentClasses"],
    certifications: (certsRes.data ?? []) as StudentDetail["certifications"],
  };
}
