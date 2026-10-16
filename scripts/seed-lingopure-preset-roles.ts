/**
 * One-off: seed the 9 self-setup preset roles (name + rationale as
 * description + the 6 per-skill baselines) for the "Lingopure" demo
 * employer, so the staff-invite Role dropdown has the same catalogue the
 * initial self-setup onboarding flow already offers. Idempotent — skips
 * any role name that already exists for this employer (unique
 * (employer_id, name)); never overwrites a role an admin may have already
 * edited by hand.
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/seed-lingopure-preset-roles.ts
 */

import { createClient } from "@supabase/supabase-js";

const EMPLOYER_ID = "ae643e37-8ff7-4c5e-b66e-848603b642d8"; // Lingopure

// Mirrors src/app/(app)/onboarding/self-setup.tsx's ROLES array exactly —
// same names, same rationale text, same per-skill baselines.
const PRESET_ROLES = [
  {
    name: "Inbound Sales",
    rationale:
      "Must decode prospect intent; talking well is useless if you pitch the wrong thing",
    baselines: { speaking: 650, listening: 700, writing: 400, reading: 450, grammar: 450, live_interaction: 650 },
  },
  {
    name: "Outbound Sales",
    rationale:
      "Cold outreach is persuasion; fluency and confidence determine whether they stay on the line",
    baselines: { speaking: 750, listening: 550, writing: 450, reading: 400, grammar: 500, live_interaction: 700 },
  },
  {
    name: "Inbound Customer Service",
    rationale:
      "Customer leads the conversation; misunderstanding the issue = wrong resolution = churn",
    baselines: { speaking: 600, listening: 750, writing: 450, reading: 500, grammar: 500, live_interaction: 750 },
  },
  {
    name: "Inbound Tech Support",
    rationale:
      "Must extract precise technical details from non-technical users; vocabulary prevents miscommunication",
    baselines: { speaking: 550, listening: 700, writing: 550, reading: 600, grammar: 600, live_interaction: 700 },
  },
  {
    name: "Back Office Operations",
    rationale:
      "Document-in, document-out function; spoken English is irrelevant to core output",
    baselines: { speaking: 350, listening: 400, writing: 650, reading: 650, grammar: 700, live_interaction: 300 },
  },
  {
    name: "Quality Assurance",
    rationale:
      "Evaluates interactions and writes evaluations; analytical documentation function",
    baselines: { speaking: 450, listening: 650, writing: 700, reading: 700, grammar: 700, live_interaction: 500 },
  },
  {
    name: "Recruitment / HR",
    rationale:
      "Shifts between reading resumes, interviewing, writing policies — no single skill dominates",
    baselines: { speaking: 600, listening: 550, writing: 600, reading: 550, grammar: 600, live_interaction: 600 },
  },
  {
    name: "Accounts / Finance",
    rationale:
      "Document-driven function; financial writing precision prevents real risk",
    baselines: { speaking: 350, listening: 350, writing: 700, reading: 700, grammar: 750, live_interaction: 300 },
  },
  {
    name: "Training / L&D",
    rationale:
      "Training IS delivery; if they cannot present, nothing else matters",
    baselines: { speaking: 700, listening: 500, writing: 550, reading: 500, grammar: 550, live_interaction: 650 },
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE URL + SERVICE_ROLE_KEY required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingRoles } = await supabase
    .from("roles")
    .select("name")
    .eq("employer_id", EMPLOYER_ID);
  const existingNames = new Set((existingRoles ?? []).map((r) => (r as { name: string }).name));

  for (const preset of PRESET_ROLES) {
    if (existingNames.has(preset.name)) {
      console.log(`- skip "${preset.name}" (already exists)`);
      continue;
    }

    const { data: roleRow, error: insertErr } = await supabase
      .from("roles")
      .insert({ employer_id: EMPLOYER_ID, name: preset.name, description: preset.rationale })
      .select("id")
      .single();
    if (insertErr) {
      console.error(`FAILED inserting "${preset.name}": ${insertErr.message}`);
      continue;
    }
    const roleId = (roleRow as { id: string }).id;

    const baselineRows = Object.entries(preset.baselines).map(([skill, min_score]) => ({
      role_id: roleId,
      skill,
      min_score,
    }));
    const { error: baselineErr } = await supabase.from("role_baselines").insert(baselineRows);
    if (baselineErr) {
      console.error(`  baselines FAILED for "${preset.name}": ${baselineErr.message}`);
      continue;
    }
    console.log(`✓ seeded "${preset.name}" (${roleId})`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
