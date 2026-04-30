/**
 * One-off: provision the LingoPure discovery agent on ElevenLabs.
 *
 * Usage (Windows / Git Bash):
 *   set -a; source .env.local; set +a; npx tsx scripts/provision-discovery-agent.ts
 *
 * Outputs the new agentId. Paste it into .env.local as ELEVENLABS_AGENT_ID,
 * then run `bash scripts/push-env-to-vercel.sh ELEVENLABS_AGENT_ID` to sync.
 *
 * Re-running creates a NEW agent. To update an existing agent in place,
 * import { updateAgent } from '@caistech/elevenlabs-convai' and call it instead.
 */

import { createAgent } from "@caistech/elevenlabs-convai";
import { SYSTEM_PROMPT, FIRST_MESSAGE } from "./discovery-system-prompt";

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set in env");

  const webhookUrl =
    process.env.ELEVENLABS_WEBHOOK_URL ??
    "https://lingo-pure-ai.vercel.app/api/convai/webhook";

  const result = await createAgent(apiKey, {
    config: {
      agentName: "LingoPure Discovery Agent",
      // Rachel — warm, professional female voice (default ElevenLabs)
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      voiceModel: "eleven_turbo_v2",
      llmModel: "gemini-2.5-flash",
      temperature: 0.5,
      webhookUrl,
      webhookEvents: ["post_call_transcription"],
    },
    systemPrompt: SYSTEM_PROMPT,
    firstMessage: FIRST_MESSAGE,
    language: "en",
  });

  console.log("\n✓ Agent provisioned\n");
  console.log(`  agentId    : ${result.agentId}`);
  console.log(`  agentName  : ${result.agentName}`);
  console.log(`  webhookUrl : ${webhookUrl}\n`);
  console.log("Next steps:");
  console.log(`  1. Append to .env.local:`);
  console.log(`       ELEVENLABS_AGENT_ID=${result.agentId}`);
  console.log(`       ELEVENLABS_WEBHOOK_SECRET=<from ElevenLabs dashboard → Webhooks>`);
  console.log(`  2. bash scripts/push-env-to-vercel.sh ELEVENLABS_AGENT_ID ELEVENLABS_WEBHOOK_SECRET`);
  console.log(`  3. Restart dev server / redeploy.\n`);
}

main().catch((err) => {
  console.error("\n✗ Provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
