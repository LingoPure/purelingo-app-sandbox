/**
 * Provision (or update) the LingoPure discovery agent on ElevenLabs.
 *
 * Usage (Windows / Git Bash):
 *   set -a; source .env.local; set +a; npx tsx scripts/provision-discovery-agent.ts
 *
 * Idempotent: with ELEVENLABS_AGENT_ID set it UPDATES the existing agent in place
 * (no duplicate created). Uses the workspace-scoped webhook binding — the
 * post-call webhook is created/bound at the workspace level via post_call_webhook_id,
 * NOT the deprecated per-agent platform_settings.webhook (the shape behind the
 * cross-product transcript leak).
 *
 * CANONICAL AUTO-CONFIGURATION — this script WRITES the values the app needs back
 * into .env.local itself (agent id always; webhook secret only when a NEW workspace
 * webhook was created — ElevenLabs shows the secret just once). No dashboard copy-
 * paste. It also seeds the convai_agents row so the post-call webhook can persist +
 * distil memory (the persistent-memory loop floor).
 *
 * IMPORTANT — webhook secret: a workspace webhook has its OWN signing secret, shown
 * only at creation. If this run CREATES one, we write .env.local with the returned
 * secret. If an existing webhook with the URL is reused, the secret is unchanged
 * (the stored value stays valid). You still must push new env to Vercel.
 */

import { provisionVoiceAgent, standardAllowlist, createConversationTools } from "@caistech/elevenlabs-convai";
import { createClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT, FIRST_MESSAGE } from "./discovery-system-prompt.mts";
import { upsertEnvLocal } from "./update-env-local.mjs";

async function seedConvaiAgent(agentId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("= skipped convai_agents seed (no SUPABASE_SERVICE_ROLE_KEY) — memory persistence will report 'Agent not found' until seeded.");
    return;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("convai_agents").upsert(
    {
      // convai_agents.user_id is just ownership; conversations carry their own
      // per-student user_id. A sentinel keeps the shared agent row single.
      user_id: "00000000-0000-0000-0000-000000000000",
      agent_name: "LingoPure Discovery Agent",
      elevenlabs_agent_id: agentId,
      system_prompt: SYSTEM_PROMPT,
      first_message: FIRST_MESSAGE,
      voice_id: "21m00Tcm4TlvDq8ikWAM",
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://purelingo-app-sandbox.vercel.app";
  const host = new URL(appUrl).host;

  const result = await provisionVoiceAgent(apiKey, {
    config: {
      agentName: "LingoPure Discovery Agent",
      // Rachel — warm, professional female voice (default ElevenLabs)
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      voiceModel: "eleven_turbo_v2",
      llmModel: "gemini-2.5-flash",
      temperature: 0.5,
    },
    systemPrompt: SYSTEM_PROMPT,
    firstMessage: FIRST_MESSAGE,
    language: "en",
    baseUrl: appUrl,
    // LingoPure's post-call route is /api/convai/webhook (not the package default path).
    postCallWebhookPath: "/api/convai/webhook",
    allowedOrigins: standardAllowlist(host),
    // Bake the secret into agent tools so the memory-loop webhook routes accept the header.
    tools: createConversationTools(appUrl, '/api/onboarding/discovery/webhooks', {
      secret: process.env.CONVAI_TOOL_SECRET,
    }),
    // Update the existing agent in place when its id is known (no duplicate).
    existingAgentId: process.env.ELEVENLABS_AGENT_ID,
  });

  console.log("\n✓ Agent provisioned (workspace-scoped webhook)\n");
  console.log(`  agentId   : ${result.agentId}`);
  console.log(`  created   : ${result.created}`);
  console.log(`  webhookId : ${result.webhookId}`);

  // Canonical auto-configuration: write the agent id + (newly created) webhook
  // secret into .env.local so nothing needs manual copy-paste from a dashboard.
  const envEntries: { key: string; value: string }[] = [
    { key: "ELEVENLABS_AGENT_ID", value: result.agentId },
  ];
  const createdWebhook = Boolean(result.webhookSecret);
  if (result.webhookSecret) {
    envEntries.push({ key: "ELEVENLABS_WEBHOOK_SECRET", value: result.webhookSecret });
  }
  const writes = upsertEnvLocal(envEntries);
  for (const w of writes) {
    if (w.written) console.log(`+ .env.local updated: ${w.key}`);
    else console.log(`! .env.local skipped ${w.key} (${w.reason})`);
  }

  // Seed convai_agents so the post-call webhook persists + distils memory.
  await seedConvaiAgent(result.agentId);

  if (createdWebhook) {
    console.log("  (webhook was NEW — secret written to .env.local, not printed here)");
  } else {
    console.log("= reused existing workspace webhook; ELEVENLABS_WEBHOOK_SECRET unchanged");
  }
  console.log("\nNext step: push updated .env.local to Vercel (production + preview), then redeploy.\n");
}

main().catch((err) => {
  console.error("\n✗ Provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
