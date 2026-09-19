#!/usr/bin/env node
// scripts/provision-plan-agent.mjs
//
// One-command provisioning for "Aria" in PLAN-DELIVERY mode - the voice
// consultant who sits down with a student after assessment and walks them
// through their improvement programme + gets commitment.
//
// Idempotent: re-running adopts the existing agent (by stored id) and
// refreshes its config. Uses the workspace ELEVENLABS_API_KEY already in
// .env.local - the operator never has to hand-fetch an agent id or API key.
//
// NOT the discovery agent: a SEPARATE agent id so plan conversations never
// flow into the discovery scoring pipeline (a plan chat must not rewrite
// gap_scores). The shared workspace post-call webhook at /api/convai/webhook
// branches on agent id - the same routing investor-Morgan uses.
//
//   node scripts/provision-plan-agent.mjs
//
// Requires (from .env.local): ELEVENLABS_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Optional: ELEVENLABS_PLAN_AGENT_ID (set after
// the first run for idempotency), NEXT_PUBLIC_SITE_URL, CONVAI_TOOL_SECRET.

import { createClient } from "@supabase/supabase-js";
import {
  provisionVoiceAgent,
  standardAllowlist,
  createConversationTools,
} from "@caistech/elevenlabs-convai";
import {
  PLAN_SYSTEM_PROMPT,
  PLAN_FIRST_MESSAGE,
} from "../src/lib/plan/plan-agent-base.mjs";
import { upsertEnvLocal } from "./update-env-local.mjs";

const AGENT_NAME = "LingoPure Plan Agent";
const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

async function seedConvaiAgent(agentId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("convai_agents").upsert(
    {
      user_id: "00000000-0000-0000-0000-000000000000",
      agent_name: AGENT_NAME,
      elevenlabs_agent_id: agentId,
      system_prompt: PLAN_SYSTEM_PROMPT,
      first_message: PLAN_FIRST_MESSAGE,
      voice_id: RACHEL_VOICE_ID,
      status: "active",
    },
    { onConflict: "elevenlabs_agent_id" }
  );
  if (error) console.error(`! convai_agents seed failed: ${error.message}`);
  else console.log("+ convai_agents row seeded (memory persistence enabled)");
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set in env");

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://purelingo-app-sandbox.vercel.app";
  const host = new URL(site).host;

  console.log(`Provisioning "${AGENT_NAME}" → ${site}/api/convai/webhook …`);
  const result = await provisionVoiceAgent(apiKey, {
    config: { agentName: AGENT_NAME, voiceId: RACHEL_VOICE_ID },
    systemPrompt: PLAN_SYSTEM_PROMPT,
    firstMessage: PLAN_FIRST_MESSAGE,
    language: "en",
    baseUrl: site,
    postCallWebhookPath: "/api/convai/webhook",
    allowedOrigins: standardAllowlist(host),
    tools: createConversationTools(site, "/api/onboarding/discovery/webhooks", {
      secret: process.env.CONVAI_TOOL_SECRET,
    }),
    existingAgentId: process.env.ELEVENLABS_PLAN_AGENT_ID || undefined,
    enableOverrides: true,
  });
  console.log(
    `${result.created ? "+ created" : "= adopted"} agent ${result.agentId} ` +
      `(webhook ${result.webhookId})`
  );

  await seedConvaiAgent(result.agentId);

  upsertEnvLocal([{ key: "ELEVENLABS_PLAN_AGENT_ID", value: result.agentId }]);
  console.log("+ ELEVENLABS_PLAN_AGENT_ID written to .env.local");
  if (result.webhookSecret) {
    upsertEnvLocal([
      { key: "ELEVENLABS_WEBHOOK_SECRET", value: result.webhookSecret },
    ]);
    console.log(
      `\n⚠ A NEW workspace webhook was created. ELEVENLABS_WEBHOOK_SECRET updated in .env.local - push to Vercel.`
    );
  }
  console.log("\nDone. Push env to Vercel, run the migration, redeploy.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});