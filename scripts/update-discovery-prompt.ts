/**
 * Updates the live discovery agent's system prompt + first message in place
 * (no re-provisioning, no new agent ID). Run this whenever the prompt has
 * been iterated on after a QA pass.
 *
 * Usage:
 *   set -a; source .env.local; set +a; npx tsx scripts/update-discovery-prompt.ts
 *
 * Source of truth for the prompt: ./discovery-system-prompt.ts
 */

import { updateAgent } from "@caistech/elevenlabs-convai";
import { SYSTEM_PROMPT, FIRST_MESSAGE } from "./discovery-system-prompt";

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error("ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID required");
  }

  await updateAgent(apiKey, agentId, {
    systemPrompt: SYSTEM_PROMPT,
    firstMessage: FIRST_MESSAGE,
    temperature: 0.5,
  });

  console.log(`✓ Agent ${agentId} updated.`);
  console.log(`  Prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Re-run QA: npx tsx scripts/qa-discovery-agent.ts`);
}

main().catch((err) => {
  console.error("✗ Update failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
