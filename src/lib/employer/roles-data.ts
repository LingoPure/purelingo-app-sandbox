/**
 * Role-management data layer (employer admin side).
 *
 * Two read shapes:
 *   - loadRolesIndex()  → list view (id, name, description, baselines, student count)
 *   - loadRoleDetail()  → edit view (full + assigned students)
 *
 * All reads use the service-role client. The /employer/* gate handles auth.
 */

import { adminSupabase } from "./data";
import { SKILL_KEYS, type SkillKey } from "@/lib/scoring/rubric";

export type RoleBaselines = Record<SkillKey, number>;

export type RoleIndexRow = {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  studentCount: number;
  baselines: RoleBaselines;
};

export type AssignedStudent = {
  id: string;
  name: string | null;
  email: string | null;
};

export type RoleDetail = {
  id: string;
  employerId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  baselines: RoleBaselines;
  assignedStudents: AssignedStudent[];
};

const DEFAULT_BASELINE = 700;

export function emptyBaselines(): RoleBaselines {
  return Object.fromEntries(
    SKILL_KEYS.map((k) => [k, DEFAULT_BASELINE])
  ) as RoleBaselines;
}

/**
 * Resolve the active employer ID for the demo. Single-tenant for now —
 * picks the first employer row. When multi-tenant lands this comes from
 * the auth claim, and every helper here gets an `employerId` arg.
 */
export async function resolveActiveEmployerId(): Promise<string | null> {
  const supabase = adminSupabase();
  const { data, error } = await supabase
    .from("employers")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`employers lookup failed: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function loadRolesIndex(
  includeArchived = false
): Promise<RoleIndexRow[]> {
  const supabase = adminSupabase();

  let rolesQuery = supabase
    .from("roles")
    .select("id, name, description, is_archived")
    .order("is_archived", { ascending: true })
    .order("name", { ascending: true });
  if (!includeArchived) rolesQuery = rolesQuery.eq("is_archived", false);

  const [rolesRes, baselinesRes, studentsRes] = await Promise.all([
    rolesQuery.returns<
      { id: string; name: string; description: string | null; is_archived: boolean }[]
    >(),
    supabase
      .from("role_baselines")
      .select("role_id, skill, min_score")
      .returns<{ role_id: string; skill: string; min_score: number }[]>(),
    supabase
      .from("students")
      .select("role_id")
      .not("role_id", "is", null)
      .returns<{ role_id: string }[]>(),
  ]);

  if (rolesRes.error) throw new Error(rolesRes.error.message);

  const countByRole = new Map<string, number>();
  for (const s of studentsRes.data ?? []) {
    countByRole.set(s.role_id, (countByRole.get(s.role_id) ?? 0) + 1);
  }

  const baselinesByRole = new Map<string, RoleBaselines>();
  for (const b of baselinesRes.data ?? []) {
    if (!SKILL_KEYS.includes(b.skill as SkillKey)) continue;
    let bucket = baselinesByRole.get(b.role_id);
    if (!bucket) {
      bucket = emptyBaselines();
      baselinesByRole.set(b.role_id, bucket);
    }
    bucket[b.skill as SkillKey] = b.min_score;
  }

  return (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isArchived: r.is_archived,
    studentCount: countByRole.get(r.id) ?? 0,
    baselines: baselinesByRole.get(r.id) ?? emptyBaselines(),
  }));
}

export async function loadRoleDetail(
  roleId: string
): Promise<RoleDetail | null> {
  const supabase = adminSupabase();

  const [roleRes, baselinesRes, studentsRes] = await Promise.all([
    supabase
      .from("roles")
      .select("id, employer_id, name, description, is_archived")
      .eq("id", roleId)
      .maybeSingle(),
    supabase
      .from("role_baselines")
      .select("skill, min_score")
      .eq("role_id", roleId)
      .returns<{ skill: string; min_score: number }[]>(),
    supabase
      .from("students")
      .select("id, name, email")
      .eq("role_id", roleId)
      .order("name", { ascending: true })
      .returns<{ id: string; name: string | null; email: string | null }[]>(),
  ]);

  if (roleRes.error) throw new Error(roleRes.error.message);
  const role = roleRes.data as
    | {
        id: string;
        employer_id: string;
        name: string;
        description: string | null;
        is_archived: boolean;
      }
    | null;
  if (!role) return null;

  const baselines = emptyBaselines();
  for (const b of baselinesRes.data ?? []) {
    if (SKILL_KEYS.includes(b.skill as SkillKey)) {
      baselines[b.skill as SkillKey] = b.min_score;
    }
  }

  return {
    id: role.id,
    employerId: role.employer_id,
    name: role.name,
    description: role.description,
    isArchived: role.is_archived,
    baselines,
    assignedStudents: studentsRes.data ?? [],
  };
}
