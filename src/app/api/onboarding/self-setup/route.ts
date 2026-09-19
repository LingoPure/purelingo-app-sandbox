import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runSelfSetup } from "@/lib/org/self-setup";

const BaselineScoresSchema = z
  .object({
    speaking_fluency: z.number().min(0).max(1000),
    presentation_delivery: z.number().min(0).max(1000),
    writing_formal: z.number().min(0).max(1000),
    business_vocabulary: z.number().min(0).max(1000),
    listening_comprehension: z.number().min(0).max(1000),
    reading_intent: z.number().min(0).max(1000),
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

  const admin = createAdminClient();
  const result = await runSelfSetup(admin, {
    userId: user.id,
    orgName: body.data.orgName,
    role: body.data.role,
    nativeLanguage: body.data.nativeLanguage,
    baselines: body.data.baselines,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}