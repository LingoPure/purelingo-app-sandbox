#!/usr/bin/env node
// scripts/provision-investor-morgan.mjs
//
// One-command provisioning for "Morgan", the investor-dataroom VOICE clarifier.
// Idempotent: re-running adopts the existing agent (by stored id, else by name)
// and refreshes its config. Uses the workspace ELEVENLABS_API_KEY already in
// .env.local — the operator never has to hand-fetch an agent id or API key.
//
// What it does:
//   1. Reads the discovery agent's voice so Morgan sounds consistent with the
//      portfolio (falls back to Rachel if it can't).
//   2. provisionVoiceAgent(): create/adopt the agent, set the system prompt +
//      first message, enable per-session overrides (welcome-back greeting),
//      write the Security allowlist, and bind the SHARED workspace post-call
//      webhook at /api/convai/webhook (the same endpoint discovery uses; the
//      route branches on agent id).
//   3. Seeds a convai_agents row so the post-call webhook can persist + distil
//      Morgan's calls into convai_memory (without a row it returns "Agent not
//      found", exactly the discovery-agent gotcha).
//   4. CANONICAL AUTO-CONFIG: writes NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID (+
//      ELEVENLABS_WEBHOOK_SECRET when this run created the shared workspace
//      webhook) back into .env.local — no dashboard copy-paste. Then push to Vercel.
//
//   node scripts/provision-investor-morgan.mjs
//
// Requires (from .env.local): ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID (the
// discovery agent, for voice match — optional), NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Optional: NEXT_PUBLIC_SITE_URL,
// NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID (set after the first run for idempotency).

import { createClient } from "@supabase/supabase-js";
import {
  provisionVoiceAgent,
  standardAllowlist,
  getAgent,
} from "@caistech/elevenlabs-convai";
import {
  MORGAN_SYSTEM_PROMPT,
  MORGAN_FIRST_MESSAGE,
} from "../src/lib/investor/morgan-prompt.mjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upsertEnvLocal } from "./update-env-local.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const raw of existsSync(path.join(REPO, ".env.local"))
  ? readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/)
  : []) {
  const l = raw.trim();
  if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("=");
  if (i < 0) continue;
  const k = l.slice(0, i).trim();
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const AGENT_NAME = "LingoPure Investor Morgan";
const PROD_HOSTNAME = "purelingo-app-sandbox.vercel.app";
const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Base persona + opener are single-sourced in src/lib/investor/morgan-prompt.mjs
// (the runtime composes base + recalled memory for returning investors).
const SYSTEM_PROMPT = MORGAN_SYSTEM_PROMPT;
const FIRST_MESSAGE = MORGAN_FIRST_MESSAGE;

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("Missing ELEVENLABS_API_KEY in .env.local");
    process.exit(1);
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${PROD_HOSTNAME}`;

  // 1. Voice: match the discovery agent if we can; else Rachel.
  let voiceId = RACHEL_VOICE_ID;
  const discoveryAgentId = process.env.ELEVENLABS_AGENT_ID;
  if (discoveryAgentId) {
    try {
      const a = await getAgent(apiKey, discoveryAgentId);
      const vid = a?.conversation_config?.tts?.voice_id;
      if (vid) {
        voiceId = vid;
        console.log(`= matched discovery agent voice: ${voiceId}`);
      }
    } catch {
      console.log(`= could not read discovery agent voice; using Rachel ${RACHEL_VOICE_ID}`);
    }
  }

  // 2. Provision (idempotent).
  console.log(`Provisioning "${AGENT_NAME}" → ${site}/api/convai/webhook …`);
  const result = await provisionVoiceAgent(apiKey, {
    config: { agentName: AGENT_NAME, voiceId },
    systemPrompt: SYSTEM_PROMPT,
    firstMessage: FIRST_MESSAGE,
    language: "en",
    baseUrl: site,
    postCallWebhookPath: "/api/convai/webhook",
    allowedOrigins: standardAllowlist(PROD_HOSTNAME),
    existingAgentId: process.env.NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID || undefined,
    enableOverrides: true,
  });
  console.log(
    `${result.created ? "+ created" : "= adopted"} agent ${result.agentId} ` +
      `(webhook ${result.webhookId})`
  );
  if (result.webhookSecret) {
    console.log(
      `\n⚠ A NEW workspace webhook was created. Set ELEVENLABS_WEBHOOK_SECRET to:\n  ${result.webhookSecret}\n` +
        `  (sensitive — .env.local + Vercel prod+preview). If the discovery webhook already worked, the existing secret was reused and this won't print.`
    );
  }

  // 3. Seed convai_agents so the post-call webhook can persist + distil memory.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from("convai_agents").upsert(
      {
        // convai_agents.user_id is just ownership; conversations carry their own
        // per-investor user_id. A sentinel keeps the shared agent row single.
        user_id: "00000000-0000-0000-0000-000000000000",
        agent_name: AGENT_NAME,
        elevenlabs_agent_id: result.agentId,
        system_prompt: SYSTEM_PROMPT,
        first_message: FIRST_MESSAGE,
        voice_id: voiceId,
        status: "active",
      },
      { onConflict: "elevenlabs_agent_id" }
    );
    if (error) console.error(`! convai_agents seed failed: ${error.message}`);
    else console.log("+ convai_agents row seeded (memory persistence enabled)");
  } else {
    console.log(
      "= skipped convai_agents seed (no SUPABASE_SERVICE_ROLE_KEY) — memory persistence will report 'Agent not found' until seeded."
    );
  }

  // Canonical auto-configuration: write the Morgan agent id (+ a newly-created
  // shared webhook secret) into .env.local — no dashboard copy-paste.
  const envEntries = [{ key: "NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID", value: result.agentId }];
  if (result.webhookSecret) {
    envEntries.push({ key: "ELEVENLABS_WEBHOOK_SECRET", value: result.webhookSecret });
  }
  const writes = upsertEnvLocal(envEntries);
  for (const w of writes) {
    if (w.written) console.log(`+ .env.local updated: ${w.key}`);
    else console.log(`! .env.local skipped ${w.key} (${w.reason})`);
  }

  console.log(
    `\n✔ Done. Push .env.local to Vercel (plain, production+preview), then redeploy. ` +
      `The "Talk to Morgan" choice on /investor/ask goes live once the env var is present.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
