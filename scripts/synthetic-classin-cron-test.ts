/**
 * Synthetic dry run of the classin-auto-schedule cron's core logic against
 * the same synthetic test student — the third leg of the voice-tutor/
 * curriculum dry-run sequence (after the scorer-direct test and the
 * webhook-logic test). This is the piece that proves the OTHER new build
 * this phase (student/course-focused auto-scheduling, decoupled from
 * staffing) also actually runs against real data, not just unit tests on
 * the pure decision function.
 *
 * It replicates GET /api/cron/classin-auto-schedule's body — same two real
 * functions, same order (generateLessonPlan, then scheduleClassForRecommendation
 * for every kind:"class" rec) — rather than HTTP-calling the route, since
 * driving it directly against one known student is simpler than running a
 * dev server + crafting a cron-auth header, and exercises the identical
 * library calls either way.
 *
 * Run with: npx tsx scripts/synthetic-classin-cron-test.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.resolve(__dirname, "../.env.local") });

import { createAdminClient } from "@/lib/supabase/admin";
import { generateLessonPlan } from "@/lib/lessons/plan-generator";
import { scheduleClassForRecommendation } from "@/lib/classin/scheduling";

const SYNTHETIC_STUDENT_EMAIL = "synthetic-voicetutor-dryrun@lingopure.test";

async function main() {
  const admin = createAdminClient();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" SYNTHETIC CLASSIN AUTO-SCHEDULE DRY RUN — real plan + scheduler, against real data");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const match = authUsers.users.find((u) => u.email === SYNTHETIC_STUDENT_EMAIL);
  if (!match) {
    throw new Error(
      `Synthetic student ${SYNTHETIC_STUDENT_EMAIL} not found — run synthetic-voice-tutor-test.ts first.`
    );
  }
  const studentId = match.id;
  console.log(`[0] Synthetic student: ${SYNTHETIC_STUDENT_EMAIL} -> ${studentId}`);

  // The cron filters on discovery_status='complete' — flip it for this
  // dry run (this student has no real discovery session, which is fine;
  // we're testing the scheduler, not re-running discovery).
  await admin.from("students").update({ discovery_status: "complete" }).eq("id", studentId);
  console.log(`[0] Set discovery_status='complete' so the cron's cohort filter picks this student up.\n`);

  // Clear any classin_sessions rows this student accumulated from a prior
  // run, so this run's "already_scheduled" vs "scheduled_locally" readout
  // is unambiguous.
  const { error: delErr } = await admin.from("classin_sessions").delete().eq("student_id", studentId);
  if (delErr) console.warn(`    (could not clear prior classin_sessions rows: ${delErr.message})`);

  console.log("[1] Running generateLessonPlan() — same canonical gap_scores this student already has");
  console.log("    (grammar score=560 vs baseline=800, gap=240, written by the earlier webhook test)...\n");
  const recs = await generateLessonPlan(admin, studentId);

  console.log(`    ${recs.length} recommendation(s):`);
  for (const r of recs) {
    console.log(`    - [${r.kind}] ${r.skill} gap=${r.gap} priority=${r.priority} "${r.title}"`);
  }

  const classRecs = recs.filter((r) => r.kind === "class" && r.priority !== "optional");
  console.log(`\n[2] ${classRecs.length} "class" recommendation(s) the cron would act on.\n`);

  if (classRecs.length === 0) {
    console.log("    Nothing to schedule — the earlier webhook test's gap wasn't wide enough (unexpected).");
    process.exit(1);
  }

  for (const rec of classRecs) {
    console.log(`[3] scheduleClassForRecommendation() for skill=${rec.skill}...`);
    const result = await scheduleClassForRecommendation(admin, studentId, rec);
    console.log(`    -> ${JSON.stringify(result)}`);
  }

  // Read back what actually landed.
  const { data: sessions } = await admin
    .from("classin_sessions")
    .select("focus_skill, scheduled_at, status, classin_class_id, join_url, teacher_name")
    .eq("student_id", studentId);

  console.log("\n[4] classin_sessions rows AFTER:");
  console.log(JSON.stringify(sessions, null, 2));

  const ok =
    !!sessions &&
    sessions.length > 0 &&
    sessions.every((s) => {
      const row = s as Record<string, unknown>;
      // classin_class_id/join_url are expected NULL today — createClass()
      // unconditionally throws ClassinUnavailableError until EEO credentials
      // land (see src/lib/classin/api.ts). The local write must still
      // succeed independent of that — that's the whole point of the
      // "when, not who" decoupling this build implements.
      return row.status === "scheduled" && row.teacher_name === null && row.scheduled_at;
    });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (ok) {
    console.log(" ✅ PASS — a real gap-driven plan correctly escalates to a class recommendation,");
    console.log("    and the scheduler writes a real local slot even though the live ClassIn push");
    console.log("    is (expectedly) unavailable — exactly the degrade-gracefully behaviour the");
    console.log("    module doc comment promises.");
  } else {
    console.log(" ❌ FAIL");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Synthetic cron dry run failed:", err);
  process.exit(1);
});
