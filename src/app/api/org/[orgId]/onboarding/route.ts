/**
 * POST /api/org/[orgId]/onboarding — C3 wizard write path.
 *
 * Actions (owner/hr only):
 *   select-package  { package }                     → seeds departments + subscription
 *   set-departments { keep: string[] }              → archive unselected depts, advance
 *   allocate-staff  { allocations: [... ] }         → staff/teacher memberships
 *   assign-teachers { assignments: [... ] }         → student_teacher_assignments
 *   finish                                           → marks onboarding done
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/org/auth";
import {
  allocateStaff,
  assignTeachers,
  loadOnboarding,
  advanceBaseline,
  advanceCurriculumAndComplete,
  selectPackage,
  setDepartments,
} from "@/lib/org/service";
import { SERVICE_PACKAGES } from "@/lib/org/onboarding";

/**
 * GET /api/org/[orgId]/onboarding — wizard state bundle (any active member).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { orgId } = await ctx.params;
  const gated = await requireOrgRole(supabase, user, orgId);
  if (gated instanceof NextResponse) return gated;

  const bundle = await loadOnboarding(createAdminClient(), orgId);
  if (!bundle) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }
  return NextResponse.json(bundle);
}

type Body =
  | { action: "select-package"; package: string }
  | { action: "set-departments"; keep?: string[] }
  | { action: "allocate-staff"; allocations?: unknown[] }
  | { action: "assign-teachers"; assignments?: unknown[] }
  | { action: "advance-baseline" }
  | { action: "finish" };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { orgId } = await ctx.params;
  const gated = await requireOrgRole(supabase, user, orgId, ["owner", "hr"]);
  if (gated instanceof NextResponse) return gated;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (body.action) {
      case "select-package": {
        if (!SERVICE_PACKAGES.includes(body.package as never)) {
          return NextResponse.json({ error: "Unknown package" }, { status: 400 });
        }
        const step = await selectPackage(admin, orgId, body.package as never);
        return NextResponse.json({ ok: true, step });
      }
      case "set-departments": {
        const step = await setDepartments(admin, orgId, body.keep ?? []);
        return NextResponse.json({ ok: true, step });
      }
      case "allocate-staff": {
        const allocations = (body.allocations ?? []).map((a) => {
          const x = a as { email?: string; role?: string; departmentId?: string };
          return {
            email: String(x.email ?? ""),
            role: x.role === "teacher" ? ("teacher" as const) : ("staff" as const),
            departmentId: x.departmentId ?? null,
          };
        });
        const step = await allocateStaff(admin, orgId, allocations);
        return NextResponse.json({ ok: true, step });
      }
      case "assign-teachers": {
        const assignments = (body.assignments ?? []).map((a) => {
          const x = a as {
            teacherUserId?: string;
            studentUserId?: string;
            assignmentRole?: string;
          };
          return {
            teacherUserId: String(x.teacherUserId ?? ""),
            studentUserId: String(x.studentUserId ?? ""),
            assignmentRole:
              x.assignmentRole === "specialist"
                ? ("specialist" as const)
                : ("primary" as const),
          };
        });
        const step = await assignTeachers(admin, orgId, assignments);
        return NextResponse.json({ ok: true, step });
      }
      case "advance-baseline": {
        const step = await advanceBaseline(admin, orgId);
        return NextResponse.json({ ok: true, step });
      }
      case "finish": {
        await advanceCurriculumAndComplete(admin, orgId);
        return NextResponse.json({ ok: true, step: "done" });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onboarding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}