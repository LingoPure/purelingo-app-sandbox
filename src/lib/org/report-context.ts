/**
 * LingoPure — Teacher report context (§7 org wiring, C2 A3).
 *
 * Resolves the DB-side `teacher_report_context(student_id)` payload into a
 * typed viewer context for the teacher intelligence report page. The RPC is
 * SECURITY DEFINER (0038 pattern) so teacher/org visibility and the
 * teacher→student assignment link are decided by the database, not by which
 * table the page happens to read first.
 *
 * `relationshipFor` is the pure label mapping — kept separate so the
 * relationship vocabulary is unit-testable without a Supabase connection.
 */

export type ReportContext = {
  can_view: boolean;
  viewer_user_id: string | null;
  viewer_org_role: string | null;
  viewer_teacher_id: string | null;
  viewer_assignment_role: "primary" | "specialist" | null;
  student_name: string | null;
  target_level: string | null;
  native_language: string | null;
  employer_id: string | null;
  organisation_id: string | null;
  organisation_name: string | null;
  primary_teacher: { id: string; full_name: string; email: string } | null;
};

const isPrimary = (role: string | null) => role === "primary";
const isSpecialist = (role: string | null) => role === "specialist";
const isSelf = (ctx: ReportContext, studentId: string) =>
  ctx.viewer_user_id !== null && ctx.viewer_user_id === studentId;

/**
 * How does the viewer relate to the student? Ordered: self > assigned coach
 * (primary before specialist) > owner/hr > teacher-bystander > other.
 */
export function relationshipFor(ctx: ReportContext, studentId: string): {
  kind:
    | "self"
    | "primary-coach"
    | "specialist-coach"
    | "owner"
    | "hr"
    | "teacher"
    | "other";
  label: string;
  description: string;
} {
  if (isSelf(ctx, studentId)) {
    return {
      kind: "self",
      label: "Learner's own view",
      description: "You are viewing your own report.",
    };
  }

  const role = ctx.viewer_org_role;
  const assignmentRole = ctx.viewer_assignment_role;

  if (isPrimary(assignmentRole)) {
    return {
      kind: "primary-coach",
      label: "Primary coach",
      description:
        "You are this student's assigned primary teacher — this coach link is what unlocks the report.",
    };
  }
  if (isSpecialist(assignmentRole)) {
    return {
      kind: "specialist-coach",
      label: "Specialist coach",
      description:
        "You are an assigned specialist teacher for this student.",
    };
  }

  switch (role) {
    case "owner":
      return {
        kind: "owner",
        label: "Org owner",
        description:
          "Organisation owner — full visibility of every student under your employer.",
      };
    case "hr":
      return {
        kind: "hr",
        label: "HR admin",
        description:
          "HR admin — full visibility of every student under your employer.",
      };
    case "teacher":
      return {
        kind: "teacher",
        label: "Teacher",
        description:
          "Teacher with no direct assignment link to this student.",
      };
    default:
      return {
        kind: "other",
        label: "Unknown role",
        description: "No org membership or assignment link resolves.",
      };
  }
}

export const EMPTY_REPORT_CONTEXT: ReportContext = {
  can_view: false,
  viewer_user_id: null,
  viewer_org_role: null,
  viewer_teacher_id: null,
  viewer_assignment_role: null,
  student_name: null,
  target_level: null,
  native_language: null,
  employer_id: null,
  organisation_id: null,
  organisation_name: null,
  primary_teacher: null,
};

/** Cast a raw `teacher_report_context` RPC row into the typed shape. */
function normalize(raw: unknown): ReportContext {
  if (!raw || typeof raw !== "object") return EMPTY_REPORT_CONTEXT;
  const r = raw as Record<string, unknown>;
  const primaryTeacher =
    r.primary_teacher && typeof r.primary_teacher === "object"
      ? (r.primary_teacher as {
          id?: unknown;
          full_name?: unknown;
          email?: unknown;
        })
      : null;

  return {
    can_view: Boolean(r.can_view),
    viewer_user_id:
      typeof r.viewer_user_id === "string" ? r.viewer_user_id : null,
    viewer_org_role:
      typeof r.viewer_org_role === "string" ? r.viewer_org_role : null,
    viewer_teacher_id:
      typeof r.viewer_teacher_id === "string" ? r.viewer_teacher_id : null,
    viewer_assignment_role:
      r.viewer_assignment_role === "primary" ||
      r.viewer_assignment_role === "specialist"
        ? r.viewer_assignment_role
        : null,
    student_name: typeof r.student_name === "string" ? r.student_name : null,
    target_level: typeof r.target_level === "string" ? r.target_level : null,
    native_language:
      typeof r.native_language === "string" ? r.native_language : null,
    employer_id: typeof r.employer_id === "string" ? r.employer_id : null,
    organisation_id:
      typeof r.organisation_id === "string" ? r.organisation_id : null,
    organisation_name:
      typeof r.organisation_name === "string" ? r.organisation_name : null,
    primary_teacher: primaryTeacher
      ? {
          id: String(primaryTeacher.id ?? ""),
          full_name: String(primaryTeacher.full_name ?? ""),
          email: String(primaryTeacher.email ?? ""),
        }
      : null,
  };
}

/**
 * Resolve the viewer context for a student. Returns the typed context, or null
 * only when the RPC itself fails / the student row does not exist.
 */
export async function resolveTeacherReportContext(
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  },
  studentId: string
): Promise<ReportContext | null> {
  const { data, error } = await supabase.rpc("teacher_report_context", {
    target_student_id: studentId,
  });
  if (error) return null;
  return normalize(data);
}