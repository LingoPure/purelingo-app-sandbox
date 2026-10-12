/**
 * GET /api/plan/delivery — generate the improvement programme for the
 * current student. Returns the structured plan data + compiled voice prompt
 * for the plan delivery session.
 *
 * POST /api/plan/delivery — record the student's commitment to the programme.
 */

import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { resolvePlanAgentId } from "@/lib/plan/resolve-plan-agent";
import {
  buildPlan,
  compilePlanPrompt,
  compilePlanFirstMessage,
} from "@/lib/plan/plan-delivery";
import { sendPlanReadyEmailOnce } from "@/lib/email/plan-report";

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
    //
    // NOTE: this GET route isn't actually called by the real student path —
    // the /plan page calls buildPlan() directly and the voice session uses
    // POST /api/plan/session — so the email send is ALSO wired directly into
    // plan/page.tsx (the path that's actually hit). Kept here too in case a
    // future consumer calls this route as documented.
    const h = await headers();
    const origin =
      h.get("origin") ??
      (h.get("x-forwarded-proto") && h.get("x-forwarded-host")
        ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
        : `https://${h.get("host") ?? "purelingo-app-sandbox.vercel.app"}`);
    waitUntil(
      sendPlanReadyEmailOnce(supabase, user.id, plan, origin).catch((err) => {
        console.error("[plan/delivery] plan-report email failed:", err);
      })
    );

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
