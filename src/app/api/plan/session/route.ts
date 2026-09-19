/**
 * POST /api/plan/session — start a plan-delivery voice session.
 *
 * Mirrors /api/onboarding/discovery/session but for the PLAN agent:
 *   1. Loads the student's scores + role → builds the improvement programme.
 *   2. Compiles the plan system prompt + first message from real data.
 *   3. Mints a signed session token (identity carried server-side).
 *
 * Returns everything the VoiceWidget needs: token, agentId, promptOverride,
 * firstMessage. The plan agent is a SEPARATE ElevenLabs agent so plan chats
 * never flow through the discovery scoring pipeline.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mintAnonSessionToken } from "@caistech/elevenlabs-convai";
import { resolvePlanAgentId } from "@/lib/plan/resolve-plan-agent";
import {
  buildPlan,
  compilePlanPrompt,
  compilePlanFirstMessage,
} from "@/lib/plan/plan-delivery";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = await resolvePlanAgentId();
  if (!agentId) {
    return NextResponse.json(
      { error: "Plan agent not configured (ELEVENLABS_PLAN_AGENT_ID missing)" },
      { status: 500 }
    );
  }

  try {
    const plan = await buildPlan(supabase, user.id);
    const promptOverride = compilePlanPrompt(plan);
    const firstMessage = compilePlanFirstMessage(plan);

    const { token } = mintAnonSessionToken(
      process.env.DISCOVERY_SESSION_SECRET || "temp-secret",
      { agentId, sid: user.id }
    );

    return NextResponse.json({ token, agentId, promptOverride, firstMessage });
  } catch (err) {
    console.error("[plan/session] start failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start plan session" },
      { status: 500 }
    );
  }
}