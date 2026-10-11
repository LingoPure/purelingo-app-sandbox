/**
 * Synthetic end-to-end test of the voice-tutor POST-CALL WEBHOOK LOGIC —
 * closing the gap the previous dry run (synthetic-voice-tutor-test.ts) left
 * open: that one called scoreVoiceTutorSession() directly, bypassing
 * webhook signature verification, payload parsing, and agent-id dispatch
 * entirely.
 *
 * ⚠️ IMPORTANT HONESTY NOTE ON SCOPE: this does NOT execute the literal
 * `export async function POST` from app/api/convai/webhook/route.ts. That
 * route statically imports @caistech/elevenlabs-convai, which is a pure-ESM
 * package (no "require" export condition) — fine inside Next's own bundler,
 * but a standalone tsx script in this CJS-default project cannot `require()`
 * it transitively (confirmed: throws ERR_PACKAGE_PATH_NOT_EXPORTED). Rather
 * than fake that around, this script instead calls the SAME REAL exported
 * functions route.ts calls (verifyWebhookSignature, parsePostCallPayload,
 * verifyAnonSessionToken, resolveVoiceTutorAgentId, scoreVoiceTutorSession),
 * in the SAME ORDER and with the SAME DECISION LOGIC handleVoiceTutorPostCall
 * uses (read directly from route.ts just before writing this). It proves the
 * real signature check, the real payload parsing, the real identity
 * resolution, and the real scorer all compose correctly — it does not prove
 * route.ts's own source text is byte-identical to what's reproduced here.
 * If route.ts's dispatch logic changes, this script needs updating to match.
 *
 * What this proves that the direct-scorer dry run did not:
 *   - A real HMAC-signed payload in the real ElevenLabs wire shape verifies.
 *   - The real anon session token (same mint/verify pair the live session
 *     route + webhook use) round-trips correctly to resolve student identity.
 *   - The agent-id dispatch condition (resolveVoiceTutorAgentId() match)
 *     correctly gates which branch runs.
 *
 * Run with: npx tsx scripts/synthetic-voice-tutor-webhook-test.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
loadEnv({ path: path.resolve(__dirname, "../.env.local") });

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVoiceTutorAgentId } from "@/lib/voice-tutor/resolve-agent";
import { scoreVoiceTutorSession } from "@/lib/scoring/score-voice-tutor";
import type { AnySkillKey } from "@/lib/scoring/rubric";

// Fake agent id — reachable branch, not a real ElevenLabs resource.
const FAKE_AGENT_ID = "agent_synthetic_test_voice_tutor_dryrun";
process.env.ELEVENLABS_VOICE_TUTOR_AGENT_ID = FAKE_AGENT_ID;

async function main() {
  // Pure-ESM package — load via dynamic import (works from a CJS-compiled
  // script; a nested static `require()` of it, as route.ts's own module
  // graph performs, does not — see the honesty note above).
  const {
    verifyWebhookSignature,
    parsePostCallPayload,
    verifyAnonSessionToken,
    mintAnonSessionToken,
  } = await import("@caistech/elevenlabs-convai");

  const admin = createAdminClient();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" SYNTHETIC WEBHOOK-LOGIC TEST — real sig/parse/identity/scorer, fake agent id");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) throw new Error("ELEVENLABS_WEBHOOK_SECRET not set — cannot sign a synthetic payload");
  const sessionSecret = process.env.DISCOVERY_SESSION_SECRET;
  if (!sessionSecret) throw new Error("DISCOVERY_SESSION_SECRET not set — cannot mint a session token");

  // ── Resolve the same synthetic student the scoring dry run created ─────
  const SYNTHETIC_STUDENT_EMAIL = "synthetic-voicetutor-dryrun@lingopure.test";
  const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const match = authUsers.users.find((u) => u.email === SYNTHETIC_STUDENT_EMAIL);
  if (!match) {
    throw new Error(
      `Synthetic student ${SYNTHETIC_STUDENT_EMAIL} not found — run synthetic-voice-tutor-test.ts first.`
    );
  }
  const studentId = match.id;
  console.log(`[0] Reusing synthetic student ${SYNTHETIC_STUDENT_EMAIL} -> ${studentId}\n`);

  // ── Step 1: mint a REAL anon session token (same call the session route makes) ──
  const { token } = mintAnonSessionToken(sessionSecret, { agentId: FAKE_AGENT_ID, sid: studentId });
  console.log(`[1] Minted anon session token via the real mintAnonSessionToken (sid=${studentId.slice(0, 8)}…)\n`);

  // ── Step 2: insert a REAL pending ai_voice_tutor_sessions row ───────────
  const conversationId = `conv_synthetic_${Date.now()}`;
  const { data: sessionRow, error: insertErr } = await admin
    .from("ai_voice_tutor_sessions")
    .insert({ student_id: studentId, target_skill: "grammar", trigger: "on_demand", status: "pending" })
    .select("id")
    .single();
  if (insertErr || !sessionRow) throw new Error(`Failed to insert pending session row: ${insertErr?.message}`);
  const pendingSessionId = (sessionRow as { id: string }).id;
  console.log(`[2] Inserted pending ai_voice_tutor_sessions row ${pendingSessionId} (target_skill=grammar)\n`);

  // ── Step 3: build the REAL ElevenLabs post-call payload shape + sign it ──
  const nowSecs = Math.floor(Date.now() / 1000);
  const payloadObj = {
    type: "post_call_transcription",
    data: {
      agent_id: FAKE_AGENT_ID,
      conversation_id: conversationId,
      status: "done",
      metadata: {
        start_time_unix_secs: nowSecs - 180,
        end_time_unix_secs: nowSecs,
        call_duration_secs: 180,
        termination_reason: "end_call_tool_called",
      },
      analysis: { transcript_summary: "Grammar drill — subject-verb agreement practice." },
      transcript: [
        { role: "agent", message: "Let's drill subject-verb agreement. Finish this: 'The reports on my desk ___ overdue.'", time_in_call_secs: 2 },
        { role: "user", message: "The reports on my desk is overdue.", time_in_call_secs: 8 },
        { role: "agent", message: "Close — 'reports' is plural, so it's 'are overdue', not 'is overdue'. Try again.", time_in_call_secs: 12 },
        { role: "user", message: "The reports on my desk are overdue.", time_in_call_secs: 18 },
        { role: "agent", message: "That's it. One more: 'Neither of the managers ___ available today.'", time_in_call_secs: 22 },
        { role: "user", message: "Neither of the managers are available today.", time_in_call_secs: 30 },
        { role: "agent", message: "Common trap — 'neither' takes a singular verb, so 'is available'. You're close, this is the pattern to keep drilling. Nice work today.", time_in_call_secs: 36 },
      ],
      conversation_initiation_client_data: { dynamic_variables: { user_id: token } },
    },
  };
  const rawBody = JSON.stringify(payloadObj);
  const ts = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const signatureHeader = `t=${ts},v0=${hmac}`;
  console.log(`[3] Built + HMAC-signed a synthetic post-call payload (conversation_id=${conversationId})\n`);

  // ── Step 4: run the REAL verification + parsing + dispatch chain ───────
  const sigOk = verifyWebhookSignature(rawBody, signatureHeader, secret);
  console.log(`[4a] verifyWebhookSignature() -> ${sigOk}`);
  if (!sigOk) throw new Error("Signature verification failed — the HMAC scheme has changed upstream.");

  const parsed = parsePostCallPayload(rawBody);
  console.log(`[4b] parsePostCallPayload() -> ${parsed ? "parsed OK" : "null (malformed)"}`);
  if (!parsed) throw new Error("Payload parsing failed.");

  const voiceTutorAgentId = await resolveVoiceTutorAgentId();
  const routesToVoiceTutor = !!voiceTutorAgentId && parsed.data.agent_id === voiceTutorAgentId;
  console.log(`[4c] resolveVoiceTutorAgentId() -> ${voiceTutorAgentId}; dispatch match -> ${routesToVoiceTutor}`);
  if (!routesToVoiceTutor) throw new Error("Dispatch condition did not match — would have fallen through to discovery scoring.");

  // ── Step 5: replicate handleVoiceTutorPostCall's body exactly ──────────
  const dynToken = parsed.data.conversation_initiation_client_data?.dynamic_variables?.user_id;
  const claims = dynToken ? verifyAnonSessionToken(sessionSecret, dynToken) : null;
  const resolvedUserId = claims?.sid ?? null;
  console.log(`[4d] verifyAnonSessionToken() -> resolved userId ${resolvedUserId} (expected ${studentId})`);
  if (resolvedUserId !== studentId) throw new Error("Identity resolution mismatch.");

  const { data: foundPending } = await admin
    .from("ai_voice_tutor_sessions")
    .select("id, target_skill")
    .eq("student_id", resolvedUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(`[4e] most-recent pending session lookup -> ${(foundPending as { id?: string } | null)?.id}`);
  if ((foundPending as { id?: string } | null)?.id !== pendingSessionId) {
    throw new Error("Pending-session lookup did not find the row we just inserted.");
  }

  const startMs = parsed.data.metadata.start_time_unix_secs * 1000;
  const endMs = parsed.data.metadata.end_time_unix_secs! * 1000;
  await admin
    .from("ai_voice_tutor_sessions")
    .update({
      elevenlabs_conversation_id: conversationId,
      status: parsed.data.status === "done" ? "complete" : "failed",
      started_at: new Date(startMs).toISOString(),
      completed_at: new Date(endMs).toISOString(),
    })
    .eq("id", pendingSessionId);

  const transcript = parsed.data.transcript.map((t) => ({ role: t.role as "agent" | "user", message: t.message as string }));
  const result = await scoreVoiceTutorSession(admin, {
    studentId: resolvedUserId,
    targetSkill: (foundPending as { target_skill: AnySkillKey }).target_skill,
    transcript,
  });
  await admin.from("ai_voice_tutor_sessions").update({ scored_at: new Date().toISOString() }).eq("id", pendingSessionId);

  console.log(`\n[5] Scorer output: score=${result.scores.skill.score} evidence="${result.scores.skill.evidence}"`);
  console.log(`    coach_note: "${result.scores.coach_note}"\n`);

  // ── Step 6: read back ───────────────────────────────────────────────────
  const { data: afterSession } = await admin
    .from("ai_voice_tutor_sessions")
    .select("status, elevenlabs_conversation_id, scored_at, target_skill")
    .eq("id", pendingSessionId)
    .maybeSingle();
  const { data: gapRow } = await admin
    .from("gap_scores")
    .select("score, source, model, is_canonical")
    .eq("student_id", studentId)
    .eq("skill", "grammar")
    .eq("is_canonical", true)
    .maybeSingle();

  console.log("[6] ai_voice_tutor_sessions AFTER:", JSON.stringify(afterSession));
  console.log("[6] gap_scores (grammar) AFTER:", JSON.stringify(gapRow));

  const sessionClosed = (afterSession as Record<string, unknown> | null)?.status === "complete";
  const scored =
    !!(afterSession as Record<string, unknown> | null)?.scored_at &&
    (gapRow as Record<string, unknown> | null)?.source === "ai_voice_tutor" &&
    (gapRow as Record<string, unknown> | null)?.score === result.scores.skill.score;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (sessionClosed && scored) {
    console.log(" ✅ PASS — real signature verification, real payload parsing, real agent-id");
    console.log("    dispatch gate, real identity resolution, and the real scorer all compose");
    console.log("    correctly end-to-end on a synthetic post-call delivery.");
  } else {
    console.log(" ❌ FAIL");
    console.log(`    sessionClosed=${sessionClosed} scored=${scored}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(sessionClosed && scored ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Synthetic webhook-logic test failed:", err);
  process.exit(1);
});
