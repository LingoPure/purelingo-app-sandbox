/**
 * GET /api/plan/delivery — generate the improvement programme for the
 * current student. Returns the structured plan data + compiled voice prompt
 * for the plan delivery session.
 *
 * POST /api/plan/delivery — record the student's commitment to the programme.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlan,
  compilePlanPrompt,
  compilePlanFirstMessage,
} from "@/lib/plan/plan-delivery";

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

    return NextResponse.json({
      plan,
      promptOverride: prompt,
      firstMessage,
      agentId: process.env.ELEVENLABS_AGENT_ID,
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
