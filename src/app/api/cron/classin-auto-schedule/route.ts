/**
 * @machine-callable
 *
 * Daily auto-scheduling cron — for every student with at least one
 * `kind: "class"` recommendation on their current plan, ensures a live
 * ClassIn slot exists (scheduleClassForRecommendation is idempotent — a
 * skill that already has an upcoming unscored slot is skipped).
 *
 * Student/course-focused, not coordinator-approved: the system decides
 * WHEN a slot is needed and writes it immediately. WHO teaches it is out
 * of scope here (classin_sessions.teacher_name stays null) — see
 * classin/scheduling.ts's module doc comment.
 *
 * WHY THE MARKER MATTERS. The session-refresh middleware redirects
 * anything without a session, so a scheduled route is 307'd to /login
 * unless explicitly excluded from the protected matcher. `@machine-
 * callable` is what lets `portfolio-gate-audit-machine-routes` catch that
 * class of regression — see the 2K-retention cron's identical header for
 * the incident this guards against.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateLessonPlan, type PlanRecommendation } from "@/lib/lessons/plan-generator";
import { scheduleClassForRecommendation } from "@/lib/classin/scheduling";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAuthorised(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = adminClient();

  // Active = has completed discovery (there's a real gap profile to plan
  // against). A larger cohort query (active plan subscriptions, etc.) is a
  // product decision for later — this is the minimal correct filter today.
  const { data: students, error } = await admin
    .from("students")
    .select("id")
    .eq("discovery_status", "complete");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { studentId: string; skill: string; status: string }[] = [];
  let errors = 0;

  for (const row of students ?? []) {
    const studentId = (row as { id: string }).id;
    let recs: PlanRecommendation[];
    try {
      recs = await generateLessonPlan(admin, studentId);
    } catch (err) {
      console.error(`[cron/classin-auto-schedule] plan generation failed for ${studentId}:`, err);
      errors++;
      continue;
    }

    const classRecs = recs.filter((r) => r.kind === "class" && r.priority !== "optional");
    for (const rec of classRecs) {
      try {
        const result = await scheduleClassForRecommendation(admin, studentId, rec);
        results.push({ studentId, skill: rec.skill, status: result.status });
      } catch (err) {
        console.error(
          `[cron/classin-auto-schedule] scheduling failed for ${studentId}/${rec.skill}:`,
          err
        );
        errors++;
      }
    }
  }

  return NextResponse.json({
    studentsChecked: students?.length ?? 0,
    scheduled: results.filter((r) => r.status === "scheduled_locally").length,
    alreadyScheduled: results.filter((r) => r.status === "already_scheduled").length,
    noSlot: results.filter((r) => r.status === "no_slot_available").length,
    errors,
  });
}
