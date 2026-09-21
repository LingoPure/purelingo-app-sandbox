import type { SupabaseClient } from "@supabase/supabase-js";

/** Short random alnum suffix for de-duplicating a colliding organisation slug. */
function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

// Canonical skill set every self-setup role seeds — the SIX PRIMARY
// dimensions only (ISS-048). The two supporting measures
// (business_vocabulary, presentation_delivery) use the flat 800 default
// and are never role-customised.
export const SELF_SETUP_SKILLS = [
  "speaking",
  "listening",
  "writing",
  "reading",
  "grammar",
  "live_interaction",
] as const;

export type SelfSetupSkill = (typeof SELF_SETUP_SKILLS)[number];

export type SelfSetupBaselines = Record<SelfSetupSkill, number>;

export type SelfSetupInput = {
  userId: string;
  orgName: string;
  role: string;
  nativeLanguage: string;
  baselines: SelfSetupBaselines;
};

export type SelfSetupStep =
  | "organisation"
  | "employer"
  | "role"
  | "baselines"
  | "student"
  | "membership";

type SelfSetupFailure = {
  ok: false;
  step: SelfSetupStep;
  error: string;
};

type SelfSetupSuccess = {
  ok: true;
  organisationId: string;
  employerId: string;
  roleId: string;
};

export type SelfSetupResult = SelfSetupFailure | SelfSetupSuccess;

/**
 * Execute the self-setup write path (steps 1–6).
 *
 * Called by the POST handler after auth + zod validation are done.
 * Returns a discriminated result so the route can map the step to the
 * right HTTP status without duplicating the write logic.
 */
export async function runSelfSetup(
  admin: SupabaseClient,
  input: SelfSetupInput,
): Promise<SelfSetupResult> {
  const { userId, orgName, role, nativeLanguage, baselines } = input;

  const slugBase = orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "org";

  // 1. Organisation (self-created — no owner membership).
  //
  // `organisations.slug` is a URL-safe internal identifier, not something
  // the user ever sees or chooses directly — so a slug collision (e.g. two
  // people at "Prelabz" both self-setting-up, or a repeat test run) should
  // never surface as a raw Postgres error (ISS-049). Retry with a short
  // random suffix instead of failing; only give up if that keeps colliding,
  // which given the suffix space is effectively unreachable in practice.
  let org: { id: string } | null = null;
  let orgError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${randomSlugSuffix()}`;
    const { data, error } = await admin
      .from("organisations")
      .insert({ name: orgName, slug })
      .select("id")
      .single();
    if (!error) {
      org = data;
      orgError = null;
      break;
    }
    orgError = error;
    if (error.code !== "23505") break; // not a unique-violation — don't retry blindly
  }
  if (!org) {
    const friendly =
      orgError?.code === "23505"
        ? "Couldn't create your organisation right now — please try again."
        : (orgError?.message ?? "Failed to create organisation.");
    return { ok: false, step: "organisation", error: friendly };
  }

  // 2. Employer linked to the organisation.
  const { data: employer, error: employerError } = await admin
    .from("employers")
    .insert({
      name: orgName,
      organisation_id: org.id,
      default_native_language: nativeLanguage,
    })
    .select("id, organisation_id")
    .single();
  if (employerError) {
    return { ok: false, step: "employer", error: employerError.message };
  }

  // 3. Role with the user-selected name.
  const { data: roleRow, error: roleError } = await admin
    .from("roles")
    .insert({
      name: role,
      employer_id: employer.id,
      description: `Baseline for ${role} in ${orgName}`,
    })
    .select("id")
    .single();
  if (roleError) {
    return { ok: false, step: "role", error: roleError.message };
  }

  // 4. Six baseline skill floors (the gap-analysis calibration targets).
  const { error: baselineError } = await admin
    .from("role_baselines")
    .insert(
      SELF_SETUP_SKILLS.map((skill) => ({
        role_id: roleRow.id,
        skill,
        min_score: baselines[skill],
      })),
    );
  if (baselineError) {
    return { ok: false, step: "baselines", error: baselineError.message };
  }

  // 5. Link student → employer + role, stamp native language.
  const { error: studentError } = await admin
    .from("students")
    .update({
      employer_id: employer.id,
      role_id: roleRow.id,
      native_language: nativeLanguage,
    })
    .eq("id", userId);
  if (studentError) {
    return { ok: false, step: "student", error: studentError.message };
  }

  // 6. Organisation membership as student only (never owner).
  const { error: membershipError } = await admin
    .from("organisation_memberships")
    .insert({
      user_id: userId,
      organisation_id: org.id,
      role: "student",
      status: "active",
    });
  if (membershipError) {
    return { ok: false, step: "membership", error: membershipError.message };
  }

  return {
    ok: true,
    organisationId: org.id,
    employerId: employer.id,
    roleId: roleRow.id,
  };
}
