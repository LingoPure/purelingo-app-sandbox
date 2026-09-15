/**
 * LingoPure — Org admin portal data (C5).
 *
 * Reads through the user-scoped client: the org-model RLS policies
 * (0038/0044) grant the viewer access based on their membership role.
 * The service-role client is NOT used for reads — only for writes after the
 * role gate has passed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgDashboardData = {
  org: { id: string; name: string; slug: string };
  subscription: {
    package: string | null;
    tier: string | null;
    status: string | null;
    price_monthly: number | null;
    currency: string | null;
  } | null;
  onboarding: {
    step: string | null;
    completed_at: string | null;
  } | null;
  stats: {
    members: number;
    departments: number;
    students: number;
    teachers: number;
    assessments: number;
  };
};

export type OrgStaffMember = {
  membership_id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  department_id: string | null;
  department_name: string | null;
};

export type OrgStudent = {
  id: string;
  name: string;
  email: string | null;
  target_level: string | null;
  employer_id: string | null;
  assessments: number;
};

export type OrgTeacher = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  employment_type: string;
  assignments: number;
};

/** Dashboard data for the org home page. */
export async function loadOrgDashboard(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgDashboardData | null> {
  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;

  const [{ data: sub }, { data: onb }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("package, tier, status, price_monthly, currency")
      .eq("organisation_id", orgId)
      .maybeSingle(),
    supabase
      .from("org_onboarding")
      .select("step, completed_at")
      .eq("organisation_id", orgId)
      .maybeSingle(),
  ]);

  // Counts via RLS — each query is scoped by the viewer's role.
  const [{ count: members }, { count: departments }] = await Promise.all([
    supabase
      .from("organisation_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId),
    supabase
      .from("organisation_departments")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId),
  ]);

  // Students live under employers linked to this org.
  const { data: employerRows } = await supabase
    .from("employers")
    .select("id")
    .eq("organisation_id", orgId);
  const employerIds = (employerRows ?? []).map((e) => e.id);

  const { count: students } =
    employerIds.length > 0
      ? await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .in("employer_id", employerIds)
      : { count: 0 };

  const { count: teachers } = await supabase
    .from("teachers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: assessments } = await supabase
    .from("assessment_sessions")
    .select("assessment_id", { count: "exact", head: true });

  return {
    org,
    subscription: sub,
    onboarding: onb,
    stats: {
      members: members ?? 0,
      departments: departments ?? 0,
      students: students ?? 0,
      teachers: teachers ?? 0,
      assessments: assessments ?? 0,
    },
  };
}

/** Staff list for the org. */
export async function loadOrgStaff(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgStaffMember[]> {
  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("id, user_id, role, status, department_id")
    .eq("organisation_id", orgId)
    .order("created_at");

  const { data: departments } = await supabase
    .from("organisation_departments")
    .select("id, name")
    .eq("organisation_id", orgId);

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const results = [];

  for (const m of memberships ?? []) {
    let email: string | null = null;
    if (m.user_id) {
      const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
      email = u?.user?.email ?? null;
    }
    results.push({
      membership_id: m.id,
      user_id: m.user_id,
      email,
      role: m.role,
      status: m.status,
      department_id: m.department_id,
      department_name: deptMap.get(m.department_id) ?? null,
    });
  }

  return results;
}

/** Students under this org's employers. */
export async function loadOrgStudents(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgStudent[]> {
  const { data: employerRows } = await supabase
    .from("employers")
    .select("id")
    .eq("organisation_id", orgId);
  const employerIds = (employerRows ?? []).map((e) => e.id);

  if (employerIds.length === 0) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, name, email, target_level, employer_id")
    .in("employer_id", employerIds);

  const results = [];
  for (const s of students ?? []) {
    const { count: assessments } = await supabase
      .from("assessment_sessions")
      .select("assessment_id", { count: "exact", head: true })
      .eq("learner_id", s.id);
    results.push({ ...s, assessments: assessments ?? 0 });
  }
  return results;
}

/** Teachers (all active LingoPure teachers visible to any org). */
export async function loadOrgTeachers(
  supabase: SupabaseClient
): Promise<OrgTeacher[]> {
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, auth_user_id, full_name, email, employment_type")
    .eq("status", "active")
    .order("full_name");

  const results = [];
  for (const t of teachers ?? []) {
    const { count: assignments } = await supabase
      .from("student_teacher_assignments")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", t.id)
      .is("ended_at", null);
    results.push({ ...t, assignments: assignments ?? 0 });
  }
  return results;
}

export type OrgSettings = {
  org: { id: string; name: string; slug: string; created_at: string | null };
  admins: Array<{ membership_id: string; user_id: string | null; email: string | null; role: string; status: string }>;
  subscription: {
    package: string | null;
    tier: string | null;
    status: string | null;
    price_monthly: number | null;
    currency: string | null;
    next_billing_at: string | null;
  } | null;
};

/** Org identity + its admins + subscription, for the org Settings page. */
export async function loadOrgSettings(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgSettings | null> {
  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, slug, created_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;

  const [memberships, sub] = await Promise.all([
    supabase
      .from("organisation_memberships")
      .select("id, user_id, role, status")
      .eq("organisation_id", orgId)
      .order("created_at"),
    supabase
      .from("subscriptions")
      .select("package, tier, status, price_monthly, currency, next_billing_at")
      .eq("organisation_id", orgId)
      .maybeSingle(),
  ]);

  const admins = [];
  for (const m of memberships.data ?? []) {
    let email: string | null = null;
    if (m.user_id) {
      const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
      email = u?.user?.email ?? null;
    }
    admins.push({
      membership_id: m.id,
      user_id: m.user_id,
      email,
      role: m.role,
      status: m.status,
    });
  }

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      created_at: org.created_at as string | null,
    },
    admins,
    subscription: sub.data as OrgSettings["subscription"],
  };
}
