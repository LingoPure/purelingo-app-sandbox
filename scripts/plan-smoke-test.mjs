#!/usr/bin/env node
// scripts/plan-smoke-test.mjs
//
// End-to-end smoke test for the plan-delivery feature against PRODUCTION:
//   1. Ensure a demo student exists (auth user via admin API + students row).
//   2. Attach a role + employer + full 6-skill canonical score set so the
//      plan page has real data.
//   3. Browser sign-in via the real login form, then visit /plan, check the
//      on-screen summary + Aria panel, hit /api/plan/delivery (compiled
//      prompt), record commitment via POST, and /api/plan/session.
//
// Login goes through the app's own `login` server action (password flow) so
// the test exercises the real auth path. Never prints secrets. Idempotent.

import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local so the script runs standalone (playwright doesn't either).
loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROOT =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://purelingo-app-sandbox.vercel.app";

const EMAIL = "plan-smoke@lingopure.demo";
const PASSWORD = "Plan-Smoke-4242!";

const SKILLS = [
  { skill: "speaking_fluency", score: 520, target: 700 },
  { skill: "listening_comprehension", score: 610, target: 720 },
  { skill: "writing_formal", score: 480, target: 800 },
  { skill: "reading_intent", score: 580, target: 750 },
  { skill: "business_vocabulary", score: 540, target: 780 },
  { skill: "presentation_delivery", score: 500, target: 820 },
];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function ensureUser(sb) {
  let user = null;
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email === EMAIL);
    if (hit) {
      user = hit;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Plan Smoke Tower" },
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    user = data.user;
  } else {
    await sb.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Plan Smoke Tower" },
    });
  }
  return user.id;
}

async function ensureProfile(sb, userId) {
  let roleId, employerId;
  // Employer must exist before its role (roles.employer_id not-null).
  const { data: emp } = await sb
    .from("employers")
    .select("id")
    .eq("name", "Plan Smoke Employer")
    .maybeSingle();
  if (emp) {
    employerId = emp.id;
  } else {
    const { data: inserted, error } = await sb
      .from("employers")
      .insert({ name: "Plan Smoke Employer" })
      .select("id")
      .single();
    if (error) throw new Error(`employers insert: ${error.message}`);
    employerId = inserted.id;
  }

  const { data: role } = await sb
    .from("roles")
    .select("id")
    .eq("employer_id", employerId)
    .eq("name", "Plan Smoke Role")
    .maybeSingle();
  if (role) {
    roleId = role.id;
  } else {
    const { data: inserted, error } = await sb
      .from("roles")
      .insert({ employer_id: employerId, name: "Plan Smoke Role" })
      .select("id")
      .single();
    if (error) throw new Error(`roles insert: ${error.message}`);
    roleId = inserted.id;
  }

  const { error } = await sb.from("students").upsert(
    {
      id: userId,
      email: EMAIL,
      name: "Plan Smoke Tower",
      target_level: "B2",
      role_id: roleId,
      employer_id: employerId,
      native_language: "en",
      discovery_status: "complete",
      plan_status: "awaited",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`students upsert: ${error.message}`);

  await sb.from("gap_scores").delete().eq("student_id", userId);
  const { error: scoreErr } = await sb.from("gap_scores").insert(
    SKILLS.map((s) => ({
      student_id: userId,
      skill: s.skill,
      score: s.score,
      target: s.target,
      is_canonical: true,
    }))
  );
  if (scoreErr) throw new Error(`gap_scores insert: ${scoreErr.message}`);
  return { roleId, employerId };
}

async function main() {
  const sb = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
  console.log(`\n→ ensure auth user ${EMAIL}`);
  const userId = await ensureUser(sb);
  console.log(`  userId ${userId.slice(0, 8)}…`);
  console.log("→ ensure student row + role + employer + 6 canonical scores");
  await ensureProfile(sb, userId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: ROOT });
  const page = await context.newPage();

  try {
    // Pin UI language to English (native_language default governs chrome).
    await context.addCookies([
      { name: "lp_lang", value: "en", domain: new URL(ROOT).hostname, path: "/" },
    ]);

    console.log("\n→ sign in via the real login form");
    await page.goto("/login");
    await page.locator("#login-email").fill(EMAIL);
    await page
      .locator('form[aria-label="Sign in with password"]')
      .locator('input[name="password"]')
      .fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 30000,
    });
    check("login → redirected off /login", true, page.url());

    console.log("\n→ GET /plan");
    await page.goto("/plan");
    const planText = await page.locator("body").innerText();
    check(
      "page header present",
      /improvement programme/i.test(planText),
      "saw header"
    );
    check(
      "score summary shows baseline gap",
      /gap vs role baseline/i.test(planText)
    );
    check(
      "16-week programme rendered",
      /16-week programme/i.test(planText)
    );
    check(
      "commitment statement section",
      /your commitment/i.test(planText)
    );
    check(
      "Aria voice panel present",
      planText.includes("Sit down with Aria")
    );
    console.log(
      "    [diag] aria heading found in body:",
      /Sit down with Aria/.test(planText),
      "| commitment h2:",
      /Your commitment/.test(planText)
    );

    // Beyond the on-screen summary: call the delivery API like the page data
    // does (GET = compiled prompt; POST = record commitment).
    console.log("\n→ /api/plan/delivery GET (compiled prompt)");
    const delRes = await page.evaluate(async () => {
      const r = await fetch("/api/plan/delivery");
      return { status: r.status, json: await r.json() };
    });
    check(
      "prompt compiled from real plan data",
      delRes.status === 200 &&
        delRes.json?.plan?.phases?.length === 3 &&
        delRes.json?.promptOverride?.includes("Plan Smoke Tower"),
      `${delRes.json?.plan?.phases?.length ?? "?"} phases`
    );

    console.log("\n→ /api/plan/delivery POST (commit)");
    const commitRes = await page.evaluate(async () => {
      const r = await fetch("/api/plan/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: true, notes: "smoke test" }),
      });
      return { status: r.status, json: await r.json() };
    });
    check(
      "commitment POST accepted",
      commitRes.status === 200,
      JSON.stringify(commitRes.json)
    );

    // The delivery POST commits synchronously (the route writes
    // plan_status=committed directly), so it must now read "committed".
    const { data: st } = await sb
      .from("students")
      .select("plan_status")
      .eq("id", userId)
      .maybeSingle();
    check(
      "plan_status flipped to committed by POST",
      (st?.plan_status ?? "?") === "committed",
      `plan_status=${st?.plan_status}`
    );

    console.log("\n→ /api/plan/session POST (agent + token)");
    const sessRes = await page.evaluate(async () => {
      const r = await fetch("/api/plan/session", { method: "POST" });
      return { status: r.status, json: await r.json() };
    });
    check(
      "session minted with compiled prompt + first message",
      sessRes.status === 200 &&
        sessRes.json?.agentId &&
        sessRes.json?.token &&
        sessRes.json?.promptOverride?.includes("Plan Smoke Tower"),
      `agentId=${sessRes.json?.agentId?.slice(0, 16) ?? "?"}…`
    );
    if (sessRes.status !== 200) {
      console.log(
        `    [diag] session failed (${sessRes.status}): ${JSON.stringify(sessRes.json)?.slice(0, 300)}`
      );
    }

    // Ordering: commit comes from the agent webhook at delivery earlier; but
    // /plan page should still render post-commit for a re-visit. Verify the
    // page 200s (not redirect to login) on a second visit.
    await page.goto("/plan");
    check(
      "/plan renders for committed student (still authed)",
      !page.url().includes("/login")
    );
  } finally {
    await browser.close();
  }

  console.log(
    `\n=== /plan end-to-end: ${failures === 0 ? "PASSED" : `${failures} FAILURE(S)`} ===`
  );
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`✗ smoke test crashed: ${err.message}`);
  console.error((err.stack ?? "").slice(0, 800));
  process.exit(1);
});