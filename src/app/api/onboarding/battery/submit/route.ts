/**
 * Phase 0b assessment-battery submit endpoint.
 *
 * POST { task_prompt_id, task_type, response: ... }
 *
 *   1. Verify the user is signed in.
 *   2. Validate the payload against the discriminated union in
 *      src/lib/onboarding/battery/types.ts (no raw JSON access).
 *   3. Upsert into discovery_task_responses with attempt_number=1
 *      (unique (student_id, task_type, attempt_number) → resume = update).
 *      Always reset scored_at = NULL so re-submits are re-scored.
 *   4. Schedule scoring + gap_scores reconciliation via Next.js `after()`
 *      so it runs after the HTTP response has flushed (spec §8 — Vercel
 *      function timeouts won't accommodate sequential Sonnet calls
 *      reliably inside the request lifecycle).
 *   5. Return 200 immediately with the response_id so the client can
 *      poll for the score if it wants live feedback (the dashboard
 *      polling banner is the demo path).
 *
 * Auth model:
 *   - Insert/upsert uses the user-scoped client; RLS enforces
 *     student_id = auth.uid().
 *   - Scoring + reconcile use the service-role client because they need
 *     prompt_private (RLS-revoked from authenticated) and they may
 *     demote rows belonging to the student via update.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  TASK_TYPES,
  TaskResponseSchema,
  type TaskType,
} from "@/lib/onboarding/battery/types";
import { scoreTaskResponse } from "@/lib/onboarding/battery/score";
import { reconcileBatteryScore } from "@/lib/onboarding/battery/reconcile";
import { z } from "zod";

const RequestSchema = z.object({
  task_prompt_id: z.string().uuid(),
  task_type: z.enum(TASK_TYPES),
  response: z.unknown(),
});

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request shape", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  // Validate the response payload matches the discriminated union for the
  // declared task_type — catches client-side bugs that would otherwise land
  // bad JSON in the JSONB column.
  const responseParsed = TaskResponseSchema.safeParse({
    task_type: parsed.data.task_type,
    data: parsed.data.response,
  });
  if (!responseParsed.success) {
    return NextResponse.json(
      {
        error: "Response shape did not match task_type",
        detail: responseParsed.error.issues,
      },
      { status: 400 }
    );
  }
  const taskType: TaskType = responseParsed.data.task_type;

  // Link the response back to the student's most recent completed
  // discovery_sessions row (nullable per the schema — if the webhook
  // hasn't landed yet the response still records, just unlinked).
  const { data: sessionRow } = await userClient
    .from("discovery_sessions")
    .select("id")
    .eq("student_id", user.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const discoverySessionId =
    (sessionRow as { id?: string } | null)?.id ?? null;

  const upsertPayload = {
    student_id: user.id,
    discovery_session_id: discoverySessionId,
    task_prompt_id: parsed.data.task_prompt_id,
    task_type: taskType,
    attempt_number: 1,
    started_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    response_json: responseParsed.data.data,
    score: null,
    cefr_band: null,
    evidence: null,
    scored_at: null,
    scoring_model: null,
  };

  const { data: inserted, error: insertErr } = await userClient
    .from("discovery_task_responses")
    .upsert(upsertPayload, {
      onConflict: "student_id,task_type,attempt_number",
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    console.error("[battery/submit] upsert failed", insertErr.message);
    return NextResponse.json(
      { error: `Submit failed: ${insertErr.message}` },
      { status: 500 }
    );
  }
  const responseId = (inserted as { id?: string } | null)?.id;
  if (!responseId) {
    return NextResponse.json(
      { error: "Submit returned no row id" },
      { status: 500 }
    );
  }

  // Score + reconcile after the HTTP response has flushed. Errors are
  // logged; the recovery cron (vercel.json crons, every 5 min) re-scores
  // any rows where submitted_at < now() - 2min AND scored_at IS NULL.
  after(async () => {
    const admin = adminSupabase();
    try {
      const { out } = await scoreTaskResponse(admin, responseId);
      await reconcileBatteryScore(admin, user.id, taskType, {
        score: out.score,
        cefr_band: out.cefr_band,
        evidence: out.evidence,
      });
      console.log(
        `[battery/submit] scored ${taskType} for ${user.id} → ${out.score} (${out.cefr_band})`
      );
    } catch (err) {
      console.error(
        `[battery/submit] deferred scoring failed for ${responseId}:`,
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json({ ok: true, response_id: responseId });
}
