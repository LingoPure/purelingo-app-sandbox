/**
 * Teacher + department aggregation queries for the employer dashboard.
 *
 * All reads use the service-role client. The /employer/* layout already
 * gates on employer-admin status; data-layer reads are server-side only.
 */

import { adminSupabase } from "./data";

export type DepartmentRow = {
  id: string;
  name: string;
  focus: string | null;
  teacherCount: number;
  headTeacherName: string | null;
};

export type TeacherListRow = {
  id: string;
  fullName: string;
  email: string;
  employmentType: "in_house" | "contractor" | "ai_tutor";
  status: "active" | "on_leave" | "departed";
  classinAccountId: string | null;
  bio: string | null;
  departments: { id: string; name: string; isHead: boolean }[];
  studentCount: number;
};

export type TeacherDetail = TeacherListRow & {
  assignedStudents: {
    id: string;
    name: string | null;
    email: string | null;
    role: "primary" | "specialist";
    assignedAt: string;
  }[];
};

export async function loadDepartments(): Promise<DepartmentRow[]> {
  const supabase = adminSupabase();

  const [deptsRes, mapRes, teachersRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, focus")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_departments")
      .select("teacher_id, department_id, is_head_of_department"),
    supabase.from("teachers").select("id, full_name"),
  ]);

  const depts = (deptsRes.data ?? []) as {
    id: string;
    name: string;
    focus: string | null;
  }[];
  const map = (mapRes.data ?? []) as {
    teacher_id: string;
    department_id: string;
    is_head_of_department: boolean;
  }[];
  const teachers = (teachersRes.data ?? []) as {
    id: string;
    full_name: string;
  }[];
  const nameById = new Map(teachers.map((t) => [t.id, t.full_name]));

  return depts.map((d) => {
    const memberRows = map.filter((m) => m.department_id === d.id);
    const head = memberRows.find((m) => m.is_head_of_department);
    return {
      id: d.id,
      name: d.name,
      focus: d.focus,
      teacherCount: memberRows.length,
      headTeacherName: head ? (nameById.get(head.teacher_id) ?? null) : null,
    };
  });
}

export async function loadTeachers(): Promise<TeacherListRow[]> {
  const supabase = adminSupabase();

  const [teachersRes, deptsRes, mapRes, asnRes] = await Promise.all([
    supabase
      .from("teachers")
      .select(
        "id, full_name, email, employment_type, status, classin_account_id, bio"
      )
      .order("full_name", { ascending: true }),
    supabase.from("departments").select("id, name"),
    supabase
      .from("teacher_departments")
      .select("teacher_id, department_id, is_head_of_department"),
    supabase
      .from("student_teacher_assignments")
      .select("teacher_id, ended_at"),
  ]);

  const teachers = (teachersRes.data ?? []) as {
    id: string;
    full_name: string;
    email: string;
    employment_type: TeacherListRow["employmentType"];
    status: TeacherListRow["status"];
    classin_account_id: string | null;
    bio: string | null;
  }[];
  const depts = (deptsRes.data ?? []) as { id: string; name: string }[];
  const deptNameById = new Map(depts.map((d) => [d.id, d.name]));
  const map = (mapRes.data ?? []) as {
    teacher_id: string;
    department_id: string;
    is_head_of_department: boolean;
  }[];
  const asn = (asnRes.data ?? []) as {
    teacher_id: string;
    ended_at: string | null;
  }[];

  const activeAssignmentsByTeacher = new Map<string, number>();
  for (const a of asn) {
    if (a.ended_at) continue;
    activeAssignmentsByTeacher.set(
      a.teacher_id,
      (activeAssignmentsByTeacher.get(a.teacher_id) ?? 0) + 1
    );
  }

  return teachers.map((t) => {
    const memberships = map.filter((m) => m.teacher_id === t.id);
    return {
      id: t.id,
      fullName: t.full_name,
      email: t.email,
      employmentType: t.employment_type,
      status: t.status,
      classinAccountId: t.classin_account_id,
      bio: t.bio,
      departments: memberships
        .map((m) => ({
          id: m.department_id,
          name: deptNameById.get(m.department_id) ?? "—",
          isHead: m.is_head_of_department,
        }))
        .sort((a, b) => Number(b.isHead) - Number(a.isHead)),
      studentCount: activeAssignmentsByTeacher.get(t.id) ?? 0,
    };
  });
}

export async function loadTeacherDetail(
  teacherId: string
): Promise<TeacherDetail | null> {
  const supabase = adminSupabase();

  const [teacherRes, deptsRes, mapRes, asnRes] = await Promise.all([
    supabase
      .from("teachers")
      .select(
        "id, full_name, email, employment_type, status, classin_account_id, bio"
      )
      .eq("id", teacherId)
      .maybeSingle(),
    supabase.from("departments").select("id, name"),
    supabase
      .from("teacher_departments")
      .select("teacher_id, department_id, is_head_of_department")
      .eq("teacher_id", teacherId),
    supabase
      .from("student_teacher_assignments")
      .select(
        "teacher_id, student_id, assignment_role, assigned_at, ended_at"
      )
      .eq("teacher_id", teacherId)
      .is("ended_at", null),
  ]);

  const teacher = teacherRes.data as
    | {
        id: string;
        full_name: string;
        email: string;
        employment_type: TeacherListRow["employmentType"];
        status: TeacherListRow["status"];
        classin_account_id: string | null;
        bio: string | null;
      }
    | null;
  if (!teacher) return null;

  const depts = (deptsRes.data ?? []) as { id: string; name: string }[];
  const deptNameById = new Map(depts.map((d) => [d.id, d.name]));
  const memberships = (mapRes.data ?? []) as {
    department_id: string;
    is_head_of_department: boolean;
  }[];
  const asn = (asnRes.data ?? []) as {
    student_id: string;
    assignment_role: "primary" | "specialist";
    assigned_at: string;
  }[];

  const studentIds = asn.map((a) => a.student_id);
  let studentRows: { id: string; name: string | null; email: string | null }[] =
    [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, name, email")
      .in("id", studentIds);
    studentRows = (data ?? []) as typeof studentRows;
  }
  const byId = new Map(studentRows.map((s) => [s.id, s]));

  return {
    id: teacher.id,
    fullName: teacher.full_name,
    email: teacher.email,
    employmentType: teacher.employment_type,
    status: teacher.status,
    classinAccountId: teacher.classin_account_id,
    bio: teacher.bio,
    departments: memberships
      .map((m) => ({
        id: m.department_id,
        name: deptNameById.get(m.department_id) ?? "—",
        isHead: m.is_head_of_department,
      }))
      .sort((a, b) => Number(b.isHead) - Number(a.isHead)),
    studentCount: asn.length,
    assignedStudents: asn.map((a) => {
      const s = byId.get(a.student_id);
      return {
        id: a.student_id,
        name: s?.name ?? null,
        email: s?.email ?? null,
        role: a.assignment_role,
        assignedAt: a.assigned_at,
      };
    }),
  };
}
