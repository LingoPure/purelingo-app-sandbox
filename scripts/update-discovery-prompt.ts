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

import { updateAgent } from "../node_modules/@caistech/elevenlabs-convai/dist/index.js";
import { SYSTEM_PROMPT, FIRST_MESSAGE } from "./discovery-system-prompt";
import type { Bilingual } from "../src/lib/i18n/translate";

/**
 * DANGER — this file ships the SYSTEM PROMPT + FIRST MESSAGE to the LIVE agent.
 * A wrong target here is a production incident, not a formatting nit.
 *
 * SAFETY (VOICE_MEMORY_STANDARD rule 5 — sign-off on writes to prod):
 * - The default here is `"discovery"` — the sandbox agent, which is what your
 *   topic type tests against.
 * - You MUST pass `--target prod` explicitly to touch the production agent.
 *   Without it this script refuses to run.
 */

const TARGETS = {
  discovery: {
    id: process.env.ELEVENLABS_DISCOVERY_AGENT_ID ?? "sandbox-only",
    label: "discovery (sandbox)",
    requireExplicit: false,
  },
  prod: {
    id: process.env.ELEVENLABS_AGENT_ID,
    label: "production (pure cohort)",
    requireExplicit: true,
  },
} as const;

const targetFlag = process.argv[2];
const target = (targetFlag === "prod" ? TARGETS.prod : TARGETS.discovery);
if (target.requireExplicit && targetFlag !== "prod") {
  throw new Error("Refusing to run: pass --target prod to update the LIVE agent.");
}

// Bilingualize the first message (glossed, never overrides the agent's voice
// turn-taking); the prompt stays English (assessment/turn rules are language
// of record).
const langOverride = process.argv[3] ?? "en";

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
