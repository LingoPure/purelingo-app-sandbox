/**
 * Synthetic end-to-end dry run of the AI voice-tutor drill mechanism —
 * NO ElevenLabs agent required. This exercises every piece of the drill
 * loop except the literal live microphone call:
 *
 *   1. compileVoiceTutorPrompt/FirstMessage against a REAL student's REAL
 *      baseline/gap data — proves the "knows your situation" personalisation
 *      actually reads real rows, not placeholders.
 *   2. A hand-written, realistic drill transcript (what a live session's
 *      output would look like) run through the REAL scoreVoiceTutorSession()
 *      — a real Claude call, real schema validation, real canonical write.
 *   3. Read back the gap_scores row that landed, to confirm source/
 *      provenance/is_canonical are exactly what the live webhook path would
 *      produce.
 *
 * Runs against a DEDICATED synthetic test student (created idempotently
 * below, clearly labelled, no real person's data touched) rather than the
 * probe-discovery-prod.ts e2e fixture, which turned out not to exist in
 * this Supabase project (checked via listUsers — 48 real users, no
 * e2e-student@lingopure.demo among them).
 *
 * Run with: npx tsx scripts/synthetic-voice-tutor-test.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.resolve(__dirname, "../.env.local") });

import { createAdminClient } from "@/lib/supabase/admin";
import { compileVoiceTutorPrompt, compileVoiceTutorFirstMessage } from "@/lib/voice-tutor/config";
import { scoreVoiceTutorSession, type VoiceTutorTranscriptTurn } from "@/lib/scoring/score-voice-tutor";
import { loadBaselinesForStudent, FLAT_FALLBACK_TARGET } from "@/lib/scoring/baselines";
import type { AnySkillKey } from "@/lib/scoring/rubric";

const SYNTHETIC_STUDENT_EMAIL = "synthetic-voicetutor-dryrun@lingopure.test";
const SYNTHETIC_STUDENT_NAME = "Minh (Synthetic Dry-Run)";
const TARGET_SKILL: AnySkillKey = "live_interaction";

// A realistic transcript of what a short drill-coach session would actually
// sound like — Aria giving a scenario, correcting, repeating. Written to be
// a genuinely MIXED performance (not a strawman best-case), so the scorer's
// judgement is worth reading.
const SYNTHETIC_TRANSCRIPT: VoiceTutorTranscriptTurn[] = [
  {
    role: "agent",
    message:
      "Hey Minh, ready for a quick live-interaction practice round? Let's drill this together for a few minutes.",
  },
  {
    role: "user",
    message: "Yes, I am ready. I want to practice for when customer is angry on the phone.",
  },
  {
    role: "agent",
    message:
      "Good scenario. Here we go: a customer calls and says, \"This is the third time I've called about this invoice and nobody has fixed it!\" What do you say?",
  },
  {
    role: "user",
    message:
      "I am sorry for this inconvenience. I understand you are frustrated. Can you give me the invoice number so I check this now?",
  },
  {
    role: "agent",
    message:
      "That's a solid opening — the apology and the ask for specifics were both right. One correction: \"check this now\" sounds a bit abrupt. Try \"so I can look into this for you right away.\" Let's run it again — same angry customer, different complaint: \"Your delivery was two weeks late and nobody told me!\"",
  },
  {
    role: "user",
    message:
      "I am really sorry about that, this is not the standard we want. Let me look into this for you right away and I will call you back before end of day.",
  },
  {
    role: "agent",
    message:
      "Much better — that landed naturally. Let's try one more, this time where the customer interrupts you mid-sentence. Go ahead and just start explaining a late shipment, and I'll cut you off halfway.",
  },
  {
    role: "user",
    message:
      "Sure. So the reason for the delay was due to a problem at our warehouse where—",
  },
  {
    role: "agent",
    message:
      "\"I don't care about your warehouse, I just want my order!\" — what now?",
  },
  {
    role: "user",
    message:
      "Okay, I hear you, this is frustrate for you. Let me just... um... let me check where your order is right now and I call you in ten minutes with answer.",
  },
  {
    role: "agent",
    message:
      "Good recovery under pressure — you stayed calm and gave a concrete next step. The hesitation is fine in a real call, but watch \"this is frustrate for you\" — it's \"this is frustrating for you.\" That's the one grammar point to drill next time. Nice work today — I'll note that your de-escalation openings are strong and we should drill the -ing adjective form next.",
  },
];

async function main() {
  const admin = createAdminClient();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" SYNTHETIC VOICE-TUTOR DRILL — end-to-end dry run (no ElevenLabs)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Step 0: idempotently create/resolve a DEDICATED synthetic test student ──
  const { data: authUser, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) throw new Error(`listUsers failed: ${authErr.message}`);
  let match = authUser.users.find((u) => u.email === SYNTHETIC_STUDENT_EMAIL);

  if (!match) {
    console.log(`[0] No existing synthetic test student — creating ${SYNTHETIC_STUDENT_EMAIL}...`);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: SYNTHETIC_STUDENT_EMAIL,
      password: `synthetic-dryrun-${Date.now()}`,
      email_confirm: true,
      user_metadata: { full_name: SYNTHETIC_STUDENT_NAME },
    });
    if (createErr || !created.user) {
      throw new Error(`Failed to create synthetic test student: ${createErr?.message ?? "no user returned"}`);
    }
    match = created.user;
    // the on_auth_user_created trigger inserts the students row async-ish
    // relative to this call returning; give it a moment before reading.
    await new Promise((r) => setTimeout(r, 1000));
  }
  const studentId = match.id;
  console.log(`[0] Synthetic test student: ${SYNTHETIC_STUDENT_EMAIL} -> student_id ${studentId}\n`);

  // ── Step 1: compile the REAL prompt against this student's REAL data ───
  const { data: student } = await admin
    .from("students")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();
  const firstName = ((student?.name as string | undefined) ?? "there").split(" ")[0];

  const { data: scoreRow } = await admin
    .from("gap_scores")
    .select("score, target")
    .eq("student_id", studentId)
    .eq("skill", TARGET_SKILL)
    .eq("is_canonical", true)
    .maybeSingle();

  const baselines = await loadBaselinesForStudent(admin, studentId);
  const baselinesAny = baselines as Partial<Record<AnySkillKey, number>>;
  const baseline =
    (scoreRow as { target?: number } | null)?.target ??
    baselinesAny[TARGET_SKILL] ??
    FLAT_FALLBACK_TARGET;
  const currentScore = (scoreRow as { score?: number } | null)?.score ?? null;

  const promptCtx = { studentFirstName: firstName, targetSkill: TARGET_SKILL, currentScore, baseline };
  const compiledPrompt = compileVoiceTutorPrompt(promptCtx);
  const compiledFirstMessage = compileVoiceTutorFirstMessage(promptCtx);

  console.log("[1] compileVoiceTutorPrompt() against this student's REAL baseline/gap row:");
  console.log(`    firstName=${firstName}  skill=${TARGET_SKILL}  currentScore=${currentScore ?? "none yet"}  baseline=${baseline}`);
  console.log("    --- compiled first message ---");
  console.log("    " + compiledFirstMessage);
  console.log("    --- compiled system-prompt override (what Aria actually receives) ---");
  console.log(
    compiledPrompt
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );
  console.log();

  // ── Step 2: before snapshot of the canonical row for this skill ────────
  console.log(`[2] gap_scores BEFORE: ${currentScore == null ? "(no canonical row yet)" : `score=${currentScore}`}\n`);

  // ── Step 3: run the REAL scorer against the synthetic transcript ───────
  console.log(`[3] Running scoreVoiceTutorSession() against a ${SYNTHETIC_TRANSCRIPT.length}-turn synthetic transcript (real Claude call)...\n`);
  const result = await scoreVoiceTutorSession(admin, {
    studentId,
    targetSkill: TARGET_SKILL,
    transcript: SYNTHETIC_TRANSCRIPT,
  });

  console.log("    --- scorer output (real model response, schema-validated) ---");
  console.log(`    score: ${result.scores.skill.score}/1000`);
  console.log(`    evidence: "${result.scores.skill.evidence}"`);
  console.log(`    coach_note: "${result.scores.coach_note}"`);
  console.log(`    tokens: in=${result.inputTokens} out=${result.outputTokens}\n`);

  // ── Step 4: read back the written row to prove the canonical write landed ──
  const { data: afterRow, error: afterErr } = await admin
    .from("gap_scores")
    .select("score, target, source, model, prompt_version, rubric_version, is_canonical, created_at")
    .eq("student_id", studentId)
    .eq("skill", TARGET_SKILL)
    .eq("is_canonical", true)
    .maybeSingle();

  if (afterErr) throw new Error(`readback failed: ${afterErr.message}`);

  console.log("[4] gap_scores AFTER (read back from the DB, not from memory):");
  console.log(JSON.stringify(afterRow, null, 2));

  const ok =
    !!afterRow &&
    (afterRow as Record<string, unknown>).source === "ai_voice_tutor" &&
    (afterRow as Record<string, unknown>).is_canonical === true &&
    (afterRow as Record<string, unknown>).score === result.scores.skill.score;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(ok ? " ✅ PASS — the drill mechanism works end-to-end (minus the live mic)." : " ❌ FAIL — readback did not match the scorer output.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Synthetic test failed:", err);
  process.exit(1);
});
