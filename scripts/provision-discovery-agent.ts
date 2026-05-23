/**
 * Provision (or update) the LingoPure discovery agent on ElevenLabs.
 *
 * Usage (Windows / Git Bash):
 *   set -a; source .env.local; set +a; npx tsx scripts/provision-discovery-agent.ts
 *
 * Idempotent: with ELEVENLABS_AGENT_ID set it UPDATES the existing agent in place
 * (no duplicate created). Uses the 0.3.x workspace-scoped webhook binding — the
 * post-call webhook is created/bound at the workspace level via post_call_webhook_id,
 * NOT the deprecated per-agent platform_settings.webhook (the shape behind the
 * cross-product transcript leak).
 *
 * IMPORTANT — webhook secret: a workspace webhook has its OWN signing secret. If this
 * run CREATES a new workspace webhook (no existing one matches the URL), update
 * ELEVENLABS_WEBHOOK_SECRET (ElevenLabs dashboard -> Webhooks) to the new secret, or
 * the /api/convai/webhook route's signature check will 401. If a webhook with the same
 * URL already exists it is reused and the secret is unchanged.
 */

import { provisionVoiceAgent, standardAllowlist } from "@caistech/elevenlabs-convai";
import { SYSTEM_PROMPT, FIRST_MESSAGE } from "./discovery-system-prompt";

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set in env");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lingo-pure-ai.vercel.app";
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
    // Update the existing agent in place when its id is known (no duplicate).
    existingAgentId: process.env.ELEVENLABS_AGENT_ID,
  });

  console.log("\n✓ Agent provisioned (workspace-scoped webhook)\n");
  console.log(`  agentId   : ${result.agentId}`);
  console.log(`  created   : ${result.created}`);
  console.log(`  webhookId : ${result.webhookId}\n`);
  console.log("Next steps:");
  console.log(`  1. If ELEVENLABS_AGENT_ID was unset, append it to .env.local:`);
  console.log(`       ELEVENLABS_AGENT_ID=${result.agentId}`);
  console.log(`  2. If a NEW workspace webhook was created, set ELEVENLABS_WEBHOOK_SECRET`);
  console.log(`     to its secret (ElevenLabs -> Webhooks), then push to Vercel.`);
  console.log(`  3. Redeploy.\n`);
}

main().catch((err) => {
  console.error("\n✗ Provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
