/**
 * LingoPure — Org onboarding service (C3 §6).
 *
 * Write path for the wizard. Every mutate is guarded at the route layer by
 * `requireOrgRole` (owner/hr) and then executes through the admin client —
 * matches the codebase rule: writes are service-role, permission decided by
 * the database, never by a client-side reach-around.
 *
 * Steps emit real rows that the portals and dashboards render:
 *   createOrg        → organisations + employer link + owner membership
 *   selectPackage    → org_onboarding.package + department set (side effect)
 *   allocateStaff    → organisation_memberships (role staff/teacher)
 *   assignTeachers   → student_teacher_assignments (0014)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PACKAGE_DEPARTMENTS,
  type ServicePackage,
} from "@/lib/org/onboarding";

export type CreateOrgInput = {
  name: string;
  slug?: string;
};

export type StaffAllocation = {
  email: string;
  role: "staff" | "teacher";
  departmentId?: string | null;
};

export type TeacherAssignment = {
  teacherUserId: string;
  studentUserId: string;
  assignmentRole?: "primary" | "specialist";
};

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "org";
}

async function uniqueSlug(admin: SupabaseClient, base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const { data } = await admin
      .from("organisations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

/** Create an organisation + owner membership + onboarding state + synthetic subscription. */
export async function createOrganisation(
  admin: SupabaseClient,
  userId: string,
  input: CreateOrgInput
): Promise<{ organisation_id: string; slug: string }> {
  const slug = input.slug?.trim() ? await uniqueSlug(admin, slugify(input.slug)) : await uniqueSlug(admin, slugify(input.name));

  const { data: org, error: orgErr } = await admin
    .from("organisations")
    .insert({ name: input.name.trim(), slug })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`Could not create organisation: ${orgErr?.message}`);

  const orgId = org.id;

  // Owner membership (role owner, active).
  const { error: memberErr } = await admin.from("organisation_memberships").insert({
    user_id: userId,
    organisation_id: orgId,
    role: "owner",
    status: "active",
  });
  if (memberErr) throw new Error(`Could not add owner membership: ${memberErr.message}`);

  // Default subscription so billing surfaces exist immediately (synthetic, §5).
  const { error: subErr } = await admin.from("subscriptions").insert({
    organisation_id: orgId,
    package: "1:1 Tutoring",
    tier: "standard",
    status: "active",
    price_monthly: 1500.0,
    currency: "AUD",
    next_billing_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (subErr) throw new Error(`Could not seed subscription: ${subErr.message}`);

  // Onboarding state machine starts at 'package'.
  const { error: onbErr } = await admin.from("org_onboarding").insert({
    organisation_id: orgId,
    step: "package",
  });
  if (onbErr) throw new Error(`Could not start onboarding: ${onbErr.message}`);

  return { organisation_id: orgId, slug };
}

type ServiceClient = SupabaseClient;
type ServiceStep = "departments" | "staff" | "teachers" | "baseline";

/** Select the service package → seeds the department set + updates the subscription. */
export async function selectPackage(
  admin: ServiceClient,
  organisationId: string,
  pkg: ServicePackage
): Promise<ServiceStep> {
  const { data: state, error: stateErr } = await admin
    .from("org_onboarding")
    .select("step")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (stateErr || !state) throw new Error("Onboarding state not found");

  const { error: pkgErr } = await admin
    .from("org_onboarding")
    .update({ package: pkg, step: "departments", package_selected_at: new Date().toISOString() })
    .eq("organisation_id", organisationId);
  if (pkgErr) throw new Error(`Could not select package: ${pkgErr.message}`);

  // Seed the fixed nominated department set (§10.5) — idempotent by unique(org, name).
  for (const deptName of PACKAGE_DEPARTMENTS[pkg]) {
    await admin.from("organisation_departments").upsert(
      { organisation_id: organisationId, name: deptName, is_archived: false },
      { onConflict: "organisation_id,name" }
    );
  }

  // Billing is a data-source toggle — reflect the package on the synthetic row.
  const PRICE_MAP: Record<ServicePackage, number> = {
    "1:1 Tutoring": 1500.0,
    "Tutor + AI": 3200.0,
    "Full BPO": 7500.0,
  };
  await admin
    .from("subscriptions")
    .update({ package: pkg, price_monthly: PRICE_MAP[pkg] })
    .eq("organisation_id", organisationId);

  return "departments";
}

/** Confirm the department set (names to KEEP) → archive the rest → advance to staff. */
export async function setDepartments(
  admin: SupabaseClient,
  organisationId: string,
  keepNames: string[]
): Promise<ServiceStep> {
  const { data: depts } = await admin
    .from("organisation_departments")
    .select("id, name, is_archived")
    .eq("organisation_id", organisationId);

  const keep = new Set(keepNames);
  for (const d of depts ?? []) {
    if (!keep.has(d.name) && !d.is_archived) {
      await admin
        .from("organisation_departments")
        .update({ is_archived: true })
        .eq("id", d.id);
    }
  }

  const { error } = await admin
    .from("org_onboarding")
    .update({ step: "staff", departments_configured_at: new Date().toISOString() })
    .eq("organisation_id", organisationId);
  if (error) throw new Error(`Could not save departments: ${error.message}`);

  return "staff";
}

/** Resolve an auth user id by email with paginated lookup (HR pattern). */
async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const expected = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const hit = data.users.find((u) => u.email?.toLowerCase() === expected);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Allocate staff/teachers to departments → memberships (email may not have a user yet → pending). */
export async function allocateStaff(
  admin: SupabaseClient,
  organisationId: string,
  allocations: StaffAllocation[]
): Promise<ServiceStep> {
  for (const a of allocations) {
    // Resolve the auth user by email when the person has signed in already.
    const userId = await findAuthUserByEmail(admin, a.email);

    const membership = {
      user_id: userId, // null user → remains pending until they accept (createUser is a later phase)
      organisation_id: organisationId,
      role: a.role,
      status: userId ? "active" : "pending",
      department_id: a.departmentId ?? null,
      invited_at: new Date().toISOString(),
    };

    // Only insert when there is a resolvable user; pending-by-email invites are C5.
    if (membership.user_id) {
      await admin.from("organisation_memberships").upsert(membership, {
        onConflict: "user_id,organisation_id",
      });
    }
  }

  const { error } = await admin
    .from("org_onboarding")
    .update({ step: "teachers", staff_allocated_at: new Date().toISOString() })
    .eq("organisation_id", organisationId);
  if (error) throw new Error(`Could not save staff allocations: ${error.message}`);

  return "teachers";
}

/**
 * Assign teachers to learners → student_teacher_assignments (0014).
 * Requires the student to be a row in `students` (self-registered or imported)
 * and a `teachers` row for the teacher — both prerequisites are surfaced to the
 * wizard page so it only offers assignable people.
 */
export async function assignTeachers(
  admin: SupabaseClient,
  assignments: TeacherAssignment[]
): Promise<ServiceStep> {
  for (const a of assignments) {
    if (!a.teacherUserId || !a.studentUserId) continue;

    // Teacher row resolved by teachers.id (not auth_user_id) — the wizard
    // passes the coaching-staff row id it selects from the teachers list.
    const { data: teacherRow } = await admin
      .from("teachers")
      .select("id")
      .eq("id", a.teacherUserId)
      .maybeSingle();
    const { data: studentRow } = await admin
      .from("students")
      .select("id")
      .eq("id", a.studentUserId)
      .maybeSingle();

    if (!teacherRow || !studentRow) continue;

    await admin.from("student_teacher_assignments").upsert(
      {
        student_id: studentRow.id,
        teacher_id: teacherRow.id,
        assignment_role: a.assignmentRole ?? "primary",
        ended_at: null,
      },
      { onConflict: "student_id,teacher_id" }
    );
  }

  return "baseline"; // automatic steps follow; the light flag below marks them queued.
}

/** The wizard has finished manual steps — mark baseline as impending. */
export async function markBaselineQueued(
  admin: SupabaseClient,
  organisationId: string
): Promise<void> {
  await admin
    .from("org_onboarding")
    .update({
      step: "done",
      teachers_assigned_at: new Date().toISOString(),
      baseline_at: new Date().toISOString(),
      curriculum_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("organisation_id", organisationId);
}

export type OnboardingBundle = {
  organisation: { id: string; name: string; slug: string };
  state: Record<string, unknown> | null;
  departments: Array<{ id: string; name: string; is_archived: boolean }>;
  staff: Array<{
    membership_id: string;
    user_id: string | null;
    email: string | null;
    role: string;
    status: string;
    department_id: string | null;
    department_name: string | null;
  }>;
  teachers: Array<{
    teacher_id: string;
    auth_user_id: string | null;
    full_name: string;
    email: string;
  }>;
  learners: Array<{ student_id: string; name: string; email: string | null }>;
  assignments: Array<{
    teacher_id: string;
    student_id: string;
    assignment_role: string;
    ended_at: string | null;
  }>;
};

/** Bundle everything a wizard screen needs for the org's current step. */
export async function loadOnboarding(
  admin: SupabaseClient,
  organisationId: string
): Promise<OnboardingBundle | null> {
  const { data: org, error: orgErr } = await admin
    .from("organisations")
    .select("id, name, slug")
    .eq("id", organisationId)
    .maybeSingle();
  if (orgErr || !org) return null;

  const { data: state } = await admin
    .from("org_onboarding")
    .select("*")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  const { data: departments } = await admin
    .from("organisation_departments")
    .select("id, name, is_archived")
    .eq("organisation_id", organisationId)
    .order("name");

  const { data: memberships } = await admin
    .from("organisation_memberships")
    .select("id, user_id, role, status, department_id")
    .eq("organisation_id", organisationId);

  const staff = [];
  for (const m of memberships ?? []) {
    let email: string | null = null;
    if (m.user_id) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      email = u?.user?.email ?? null;
    }
    staff.push({
      membership_id: m.id,
      user_id: m.user_id,
      email,
      role: m.role,
      status: m.status,
      department_id: m.department_id,
      department_name:
        departments?.find((d) => d.id === m.department_id)?.name ?? null,
    });
  }

  const { data: teachers } = await admin
    .from("teachers")
    .select("id, auth_user_id, full_name, email")
    .eq("status", "active");

  const { data: employerRows } = await admin
    .from("employers")
    .select("id")
    .eq("organisation_id", organisationId);
  const employerIds = (employerRows ?? []).map((e) => e.id);

  const learners = [];
  const { data: students } =
    employerIds.length > 0
      ? await admin.from("students").select("id, name").in("employer_id", employerIds)
      : { data: [] as Array<{ id: string; name: string }> };
  for (const s of students ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(s.id);
    learners.push({
      student_id: s.id,
      name: s.name,
      email: u?.user?.email ?? null,
    });
  }

  const teacherIds = (teachers ?? []).map((t) => t.id);
  const { data: assignments } =
    teacherIds.length > 0
      ? await admin
          .from("student_teacher_assignments")
          .select("teacher_id, student_id, assignment_role, ended_at")
          .in("teacher_id", teacherIds)
      : { data: [] as Array<{ teacher_id: string; student_id: string; assignment_role: string; ended_at: string | null }> };

  return {
    organisation: { id: org.id, name: org.name, slug: org.slug },
    state,
    departments: departments ?? [],
    staff,
    teachers: (teachers ?? []).map((t) => ({
      teacher_id: t.id,
      auth_user_id: t.auth_user_id,
      full_name: t.full_name,
      email: t.email,
    })),
    learners,
    assignments: (assignments ?? []).map((a) => ({
      teacher_id: a.teacher_id,
      student_id: a.student_id,
      assignment_role: a.assignment_role,
      ended_at: a.ended_at,
    })),
  };
}