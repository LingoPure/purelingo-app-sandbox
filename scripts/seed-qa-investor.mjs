#!/usr/bin/env node
// scripts/seed-qa-investor.mjs — provision the CANONICAL shared QA user-agent
// (cais-shared-services/.secrets/qa-secrets.json → QA_TEST_USER_*) as a LingoPure
// investor for Mode-A testing. The password is read from the shared secrets file
// and never printed. Idempotent.
//
//   node scripts/seed-qa-investor.mjs            # main-tier QA investor
//   node scripts/seed-qa-investor.mjs --tier restricted
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const raw of existsSync(path.join(REPO, ".env.local")) ? readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const l = raw.trim(); if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("="); if (i < 0) continue;
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const SECRETS = path.resolve(REPO, "..", "cais-shared-services", ".secrets", "qa-secrets.json");
if (!existsSync(SECRETS)) { console.error(`Canonical QA secrets not found at ${SECRETS}`); process.exit(1); }
const qa = JSON.parse(readFileSync(SECRETS, "utf8"));
const email = qa.QA_TEST_USER_EMAIL;
const password = qa.QA_TEST_USER_PASSWORD;
if (!email || !password) { console.error("qa-secrets.json missing QA_TEST_USER_EMAIL / QA_TEST_USER_PASSWORD"); process.exit(1); }

const tier = process.argv.includes("--tier") ? process.argv[process.argv.indexOf("--tier") + 1] : "main";
if (!["main", "restricted"].includes(tier)) { console.error("--tier must be main|restricted"); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

async function findUser(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

let userId;
const create = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (create.error) {
  if (/registered|exists/i.test(create.error.message)) {
    const u = await findUser(email);
    if (!u) throw new Error(`user exists but not found: ${email}`);
    userId = u.id;
    const upd = await sb.auth.admin.updateUserById(userId, { password });
    if (upd.error) throw new Error(`set password failed: ${upd.error.message}`);
    console.log(`= auth user existed (${userId}); password synced to the canonical shared QA password`);
  } else {
    throw new Error(`createUser failed: ${create.error.message}`);
  }
} else {
  userId = create.data.user.id;
  console.log(`+ auth user created (${userId}) with the canonical shared QA password`);
}

// New model: admin sets eligibility; the online NDA gates actual access. So
// --tier restricted = deep-dive-INVITED (eligible), but max_tier stays 'main'
// until the investor accepts the NDA in-app.
const deepDive = tier === "restricted";
const { error } = await sb.from("investors").upsert(
  { id: userId, email, full_name: "QA Investor", firm: "QA Capital", max_tier: "main", deep_dive_invited: deepDive, status: "active", invited_by: "qa-seed" },
  { onConflict: "id" }
);
if (error) throw new Error(`investors upsert failed: ${error.message}`);

console.log(`+ investors row upserted (deep_dive_invited=${deepDive}, max_tier=main, status=active)`);
console.log(`\n✔ ${email} is now a LingoPure investor. Mode-A: sign in at /investor/login with the shared QA_TEST_USER_PASSWORD.`);
