import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const BASELINE_SKILLS = [
  "speaking_fluency",
  "presentation_delivery",
  "writing_formal",
  "business_vocabulary",
  "listening_comprehension",
  "reading_intent",
] as const;

const BaselineScoresSchema = z
  .object({
    speaking_fluency: z.number().min(0).max(100),
    presentation_delivery: z.number().min(0).max(100),
    writing_formal: z.number().min(0).max(100),
    business_vocabulary: z.number().min(0).max(100),
    listening_comprehension: z.number().min(0).max(100),
    reading_intent: z.number().min(0).max(100),
  })
  .strict();

const BodySchema = z
  .object({
    orgName: z.string().trim().min(2).max(120),
    role: z.string().trim().min(2).max(120),
    nativeLanguage: z.string().trim().min(2).max(8),
    baselines: BaselineScoresSchema,
  })
  .strict();

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reject if the student already has an employer — self-setup is only for
  // users with no org. Admin-invited users use RoleConfirmAndStart instead.
  const { data: existing } = await supabase
    .from("students")
    .select("employer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing?.employer_id) {
    return NextResponse.json(
      { error: "You are already part of an organisation." },
      { status: 409 }
    );
  }

  const body = BodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid request data" },
      { status: 400 }
    );
  }
  const { orgName, role, nativeLanguage, baselines } = body.data;

  const admin = createAdminClient();

  // 1. Create the organisation (self-created, no owner membership — the
  //    student is linked as a student only, never an org owner).
  const slugBase = orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({ name: orgName, slug: slugBase || "org" })
    .select("id")
    .single();
  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  // 2. Create the employer linked to the organisation.
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
    return NextResponse.json({ error: employerError.message }, { status: 500 });
  }

  // 3. Create the role with the selected name.
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
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  // 4. Seed the six baseline skills for the role — the target the gap
  //    analysis measures against (floors = expected competency).
  const { error: baselineError } = await admin
    .from("role_baselines")
    .insert(
      BASELINE_SKILLS.map((skill) => ({
        role_id: roleRow.id,
        skill,
        min_score: baselines[skill],
      }))
    );
  if (baselineError) {
    return NextResponse.json({ error: baselineError.message }, { status: 500 });
  }

  // 5. Link the student to employer + role, stamp native language.
  const { error: studentError } = await admin
    .from("students")
    .update({
      employer_id: employer.id,
      role_id: roleRow.id,
      native_language: nativeLanguage,
    })
    .eq("id", user.id);
  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  // 6. Membership as student only — never owner. Self-created orgs show in
  //    the platform admin directory but the creating user holds no admin role.
  const { error: membershipError } = await admin
    .from("organisation_memberships")
    .insert({
      user_id: user.id,
      organisation_id: org.id,
      role: "student",
      status: "active",
    });
  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}