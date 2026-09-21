/**
 * GET /api/plan/delivery — generate the improvement programme for the
 * current student. Returns the structured plan data + compiled voice prompt
 * for the plan delivery session.
 *
 * POST /api/plan/delivery — record the student's commitment to the programme.
 */

import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePlanAgentId } from "@/lib/plan/resolve-plan-agent";
import {
  buildPlan,
  compilePlanPrompt,
  compilePlanFirstMessage,
} from "@/lib/plan/plan-delivery";
import { sendPlanReportEmail } from "@/lib/email/plan-report";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const plan = await buildPlan(supabase, user.id);
    const prompt = compilePlanPrompt(plan);
    const firstMessage = compilePlanFirstMessage(plan);

    // Fire the "your sample programme is ready" email exactly once (ISS-064/065).
    // Best-effort: a failed/duplicate send must never break rendering the plan
    // the student is actively looking at right now.
    void sendPlanReadyEmailOnce(supabase, user.id, plan).catch((err) => {
      console.error("[plan/delivery] plan-report email failed:", err);
    });

    return NextResponse.json({
      plan,
      promptOverride: prompt,
      firstMessage,
      agentId: await resolvePlanAgentId(),
    });
  } catch (err) {
    console.error("[plan/delivery] generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Plan generation failed" },
      { status: 500 }
    );
  }
}

async function sendPlanReadyEmailOnce(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  plan: Awaited<ReturnType<typeof buildPlan>>
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("email, plan_report_sent_at")
    .eq("id", studentId)
    .maybeSingle();
  const row = student as { email?: string | null; plan_report_sent_at?: string | null } | null;
  if (!row?.email || row.plan_report_sent_at) return;

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
      ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
      : `https://${h.get("host") ?? "purelingo-app-sandbox.vercel.app"}`);

  const result = await sendPlanReportEmail({
    to: row.email,
    firstName: plan.firstName,
    role: plan.role,
    currentLevel: plan.currentLevel,
    targetLevel: plan.targetLevel,
    origin,
  });
  if (result.ok) {
    await supabase
      .from("students")
      .update({ plan_report_sent_at: new Date().toISOString() })
      .eq("id", studentId);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    accepted?: boolean;
    notes?: string;
  };

  // Record the commitment in the student record
  const { error: updateErr } = await supabase
    .from("students")
    .update({
      plan_status: body.accepted ? "committed" : "declined",
      plan_committed_at: body.accepted ? new Date().toISOString() : null,
      plan_notes: body.notes ?? null,
    })
    .eq("id", user.id);

  if (updateErr) {
    console.error("[plan/delivery] commitment save failed:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accepted: body.accepted });
}
