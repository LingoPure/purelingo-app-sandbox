#!/usr/bin/env node
// scripts/provision-role-discovery-agent.mjs
//
// One-command provisioning for "Aria" in ROLE-DISCOVERY / admin-interview
// mode — a fourth separate ElevenLabs agent (alongside discovery, plan, and
// voice-tutor), so role-interview calls never flow into any of those
// pipelines. Interviews an EMPLOYER ADMIN about a role, not a student about
// their own English.
//
// Idempotent: re-running adopts the existing agent (by stored id) and
// refreshes its config.
//
//   node scripts/provision-role-discovery-agent.mjs
//
// Requires (from .env.local): ELEVENLABS_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Optional: ELEVENLABS_ROLE_DISCOVERY_AGENT_ID (set
// after the first run for idempotency), NEXT_PUBLIC_SITE_URL, CONVAI_TOOL_SECRET.
//
// NOT run automatically — standing up a new live ElevenLabs agent is a real
// external, costed action. Run this by hand, then push
// ELEVENLABS_ROLE_DISCOVERY_AGENT_ID (and ELEVENLABS_WEBHOOK_SECRET if it
// changed) to Vercel.

import { createClient } from "@supabase/supabase-js";
import {
  provisionVoiceAgent,
  standardAllowlist,
  createConversationTools,
} from "@caistech/elevenlabs-convai";
import {
  ROLE_DISCOVERY_SYSTEM_PROMPT,
  ROLE_DISCOVERY_FIRST_MESSAGE,
} from "../src/lib/roles/role-discovery-agent-base.mjs";
import { upsertEnvLocal } from "./update-env-local.mjs";

const AGENT_NAME = "LingoPure Role Discovery Agent";
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
      system_prompt: ROLE_DISCOVERY_SYSTEM_PROMPT,
      first_message: ROLE_DISCOVERY_FIRST_MESSAGE,
      voice_id: RACHEL_VOICE_ID,
      status: "active",
    },
    { onConflict: "elevenlabs_agent_id" }
  );
  if (error) console.error(`! convai_agents seed failed: ${error.message}`);
  else console.log("+ convai_agents row seeded");
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set in env");

  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://purelingo-app-sandbox.vercel.app"
  ).replace(/\/$/, "");
  const host = new URL(site).host;

  console.log(`Provisioning "${AGENT_NAME}" → ${site}/api/convai/webhook …`);
  const result = await provisionVoiceAgent(apiKey, {
    config: { agentName: AGENT_NAME, voiceId: RACHEL_VOICE_ID },
    systemPrompt: ROLE_DISCOVERY_SYSTEM_PROMPT,
    firstMessage: ROLE_DISCOVERY_FIRST_MESSAGE,
    language: "en",
    baseUrl: site,
    postCallWebhookPath: "/api/convai/webhook",
    allowedOrigins: standardAllowlist(host),
    tools: createConversationTools(site, "/api/onboarding/discovery/webhooks", {
      secret: process.env.CONVAI_TOOL_SECRET,
    }),
    existingAgentId: process.env.ELEVENLABS_ROLE_DISCOVERY_AGENT_ID || undefined,
    enableOverrides: true,
  });
  console.log(
    `${result.created ? "+ created" : "= adopted"} agent ${result.agentId} ` +
      `(webhook ${result.webhookId})`
  );

  await seedConvaiAgent(result.agentId);

  upsertEnvLocal([{ key: "ELEVENLABS_ROLE_DISCOVERY_AGENT_ID", value: result.agentId }]);
  console.log("+ ELEVENLABS_ROLE_DISCOVERY_AGENT_ID written to .env.local");
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
