#!/usr/bin/env node
// scripts/provision-voice-tutor-agent.mjs
//
// One-command provisioning for "Aria" in VOICE-TUTOR / drill-coach mode —
// the third separate ElevenLabs agent (alongside discovery and the plan
// agent), so drill sessions never flow into either of those pipelines.
//
// Idempotent: re-running adopts the existing agent (by stored id) and
// refreshes its config.
//
//   node scripts/provision-voice-tutor-agent.mjs
//
// Requires (from .env.local): ELEVENLABS_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Optional: ELEVENLABS_VOICE_TUTOR_AGENT_ID (set
// after the first run for idempotency), NEXT_PUBLIC_SITE_URL, CONVAI_TOOL_SECRET.
//
// NOT run automatically as part of this build — standing up a new live
// ElevenLabs agent is a real external, costed action. Run this by hand once
// ELEVENLABS_API_KEY is confirmed available, then push
// ELEVENLABS_VOICE_TUTOR_AGENT_ID to Vercel.

import { createClient } from "@supabase/supabase-js";
import {
  provisionVoiceAgent,
  standardAllowlist,
  createConversationTools,
} from "@caistech/elevenlabs-convai";
import {
  VOICE_TUTOR_AGENT_BASE_PROMPT,
  VOICE_TUTOR_AGENT_FIRST_MESSAGE,
} from "../src/lib/voice-tutor/voice-tutor-agent-base.mjs";
import { upsertEnvLocal } from "./update-env-local.mjs";

const AGENT_NAME = "LingoPure Voice Tutor Agent";
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
      system_prompt: VOICE_TUTOR_AGENT_BASE_PROMPT,
      first_message: VOICE_TUTOR_AGENT_FIRST_MESSAGE,
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

  // Strip a trailing slash — provisionVoiceAgent's own webhook-URL builder
  // already does this defensively (baseUrl.replace(/\/$/, '')), but
  // createConversationTools does NOT, so NEXT_PUBLIC_APP_URL carrying a
  // trailing slash (it does, in this env) bakes a literal double slash into
  // every tool URL. Confirmed live: that double-slash URL 308-redirects on
  // Vercel, and the provisioned tool config sets follow_redirects: false —
  // so every tool call (incl. get_conversation_context, called at the start
  // of every conversation) would fail on turn one. Normalize once, here, so
  // both the webhook and the tool URLs are built from the same clean base.
  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://purelingo-app-sandbox.vercel.app"
  ).replace(/\/$/, "");
  const host = new URL(site).host;

  console.log(`Provisioning "${AGENT_NAME}" → ${site}/api/convai/webhook …`);
  const result = await provisionVoiceAgent(apiKey, {
    config: { agentName: AGENT_NAME, voiceId: RACHEL_VOICE_ID },
    systemPrompt: VOICE_TUTOR_AGENT_BASE_PROMPT,
    firstMessage: VOICE_TUTOR_AGENT_FIRST_MESSAGE,
    language: "en",
    baseUrl: site,
    postCallWebhookPath: "/api/convai/webhook",
    allowedOrigins: standardAllowlist(host),
    tools: createConversationTools(site, "/api/onboarding/discovery/webhooks", {
      secret: process.env.CONVAI_TOOL_SECRET,
    }),
    existingAgentId: process.env.ELEVENLABS_VOICE_TUTOR_AGENT_ID || undefined,
    enableOverrides: true,
  });
  console.log(
    `${result.created ? "+ created" : "= adopted"} agent ${result.agentId} ` +
      `(webhook ${result.webhookId})`
  );

  await seedConvaiAgent(result.agentId);

  upsertEnvLocal([{ key: "ELEVENLABS_VOICE_TUTOR_AGENT_ID", value: result.agentId }]);
  console.log("+ ELEVENLABS_VOICE_TUTOR_AGENT_ID written to .env.local");
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
