/**
 * Role-discovery epic, part 4: backfill profile_json onto every existing
 * preset role, across every employer.
 *
 * Self-setup creates its OWN employer + role rows per signup (by design —
 * see the org-name-collision/pending-join-request logic in
 * src/lib/org/self-setup.ts, which treats orgName as a real company name
 * that may legitimately recur), so the 9 preset names are duplicated across
 * however many self-setup employers exist, plus the one-off catalogue copy
 * seeded under the Lingopure employer (seed-lingopure-preset-roles.ts). This
 * script matches by NAME across ALL employers rather than targeting one —
 * the only reliable way to reach every copy.
 *
 * Idempotent + non-destructive:
 *   - Only touches rows where profile_json IS NULL (never overwrites a role
 *     that already went through the voice interview, or a previous run of
 *     this same script).
 *   - Never touches name, description, or role_baselines.min_score — those
 *     were already set correctly at creation time (self-setup / seed
 *     script) and may have been hand-edited by an admin since.
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/backfill-preset-role-profiles.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PRESET_ROLE_PROFILES } from "../src/lib/roles/preset-role-profiles";
import { SKILL_KEYS } from "../src/lib/scoring/rubric";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE URL + SERVICE_ROLE_KEY required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const presetNames = Object.keys(PRESET_ROLE_PROFILES);

  const { data: candidates, error } = await supabase
    .from("roles")
    .select("id, name, employer_id, profile_json")
    .in("name", presetNames)
    .is("profile_json", null)
    .returns<{ id: string; name: string; employer_id: string; profile_json: unknown }[]>();

  if (error) throw new Error(`roles lookup failed: ${error.message}`);
  if (!candidates || candidates.length === 0) {
    console.log("Nothing to backfill — every matching role already has profile_json.");
    return;
  }

  console.log(`Found ${candidates.length} preset role row(s) to backfill.`);

  let ok = 0;
  let failed = 0;
  for (const role of candidates) {
    const profile = PRESET_ROLE_PROFILES[role.name];
    if (!profile) continue; // unreachable given the .in() filter, but keep TS honest

    const profileJson = {
      responsibilities: profile.responsibilities,
      vocabulary_domain: profile.vocabularyDomain,
      notes_for_lesson_planner: profile.notesForLessonPlanner,
      skill_rationale: Object.fromEntries(
        SKILL_KEYS.map((skill) => [skill, profile.skills[skill].rationale])
      ),
      skill_examples: Object.fromEntries(
        SKILL_KEYS.map((skill) => [skill, profile.skills[skill].examples])
      ),
    };

    const { error: updateErr } = await supabase
      .from("roles")
      .update({ profile_json: profileJson, defined_via: "preset" })
      .eq("id", role.id);

    if (updateErr) {
      console.error(`  FAILED "${role.name}" (${role.id}) [employer ${role.employer_id}]: ${updateErr.message}`);
      failed++;
      continue;
    }
    console.log(`  ✓ "${role.name}" (${role.id}) [employer ${role.employer_id}]`);
    ok++;
  }

  console.log(`\nDone — ${ok} backfilled, ${failed} failed.`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
