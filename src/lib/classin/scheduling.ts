/**
 * Auto-scheduling decision engine — student/course-focused, not
 * coordinator-approved. For a `kind: "class"` plan recommendation, decides
 * WHEN a live-tutor slot should happen and writes it locally, independent
 * of whether the live ClassIn push succeeds (it currently can't — see
 * classin/api.ts). WHO teaches it is explicitly out of scope here: a slot
 * is created unstaffed (classin_sessions.teacher_name stays null — a
 * column that already tolerated this before today, see NextClassCard),
 * and staffing it is a separate, later pass against the HR module's
 * roster/availability (teachers_departments, staff_department_allocation,
 * hr_calendar).
 *
 * "When" and "who" are deliberately decoupled: deciding whether live
 * tutoring is even the right call for a gap (the plan-generator's job)
 * must not be blocked on staffing logic existing yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClass, type ClassinClass } from "./api";
import { ClassinUnavailableError } from "./api";
import type { PlanRecommendation } from "@/lib/lessons/plan-generator";

/** A new slot is never scheduled further out than this from now — an
 *  automatic scheduler with no staffing feedback loop yet needs a bound,
 *  not an unlimited forward horizon. */
export const MAX_LOOKAHEAD_DAYS = 21;
/** Default class length until a real curriculum-driven duration exists. */
export const DEFAULT_CLASS_DURATION_MINS = 45;
/** Fixed drop-dead slot hour (UTC) — a placeholder until real student
 *  timezone/availability data exists. Stated plainly as a placeholder
 *  rather than silently picking something that looks considered. */
const PLACEHOLDER_SLOT_HOUR_UTC = 2; // ~09:00-10:00 ICT/WIB, a reasonable guess for the SEA student base — NOT a confirmed preference.

export type ExistingSlot = { scheduledAt: string };

/**
 * Pure decision function: given what's already scheduled for this student
 * and a lookahead window, pick the next non-colliding business-day slot.
 * No weekends, no same-day-as-an-existing-slot collisions, capped at
 * MAX_LOOKAHEAD_DAYS out. Returns null if no slot fits the window (the
 * caller should not force one further out — flag it instead).
 */
export function decideNextClassSlot(
  existing: ExistingSlot[],
  now: Date = new Date()
): Date | null {
  const existingDays = new Set(
    existing.map((e) => new Date(e.scheduledAt).toISOString().slice(0, 10))
  );

  for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(PLACEHOLDER_SLOT_HOUR_UTC, 0, 0, 0);

    const dayOfWeek = candidate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dayKey = candidate.toISOString().slice(0, 10);
    if (existingDays.has(dayKey)) continue;

    return candidate;
  }
  return null;
}

export type ScheduleResult =
  | { status: "already_scheduled"; classinSessionId: string }
  | { status: "scheduled_locally"; classinSessionId: string; pushedToClassin: boolean }
  | { status: "no_slot_available" };

/**
 * For one `kind: "class"` recommendation: check for an existing unscored
 * upcoming slot for this skill first (idempotent — don't double-schedule),
 * otherwise decide a slot and write it. Always writes the local
 * classin_sessions row, even when the live ClassIn push fails (it does,
 * today, unconditionally — see classin/api.ts) — the dashboard's "Next
 * class" card is useful before ClassIn is live, and the row exists to be
 * pushed again later once credentials land, not re-derived from scratch.
 */
export async function scheduleClassForRecommendation(
  supabase: SupabaseClient,
  studentId: string,
  rec: Pick<PlanRecommendation, "skill" | "title">
): Promise<ScheduleResult> {
  const { data: existingForSkill } = await supabase
    .from("classin_sessions")
    .select("id")
    .eq("student_id", studentId)
    .eq("focus_skill", rec.skill)
    .in("status", ["scheduled", "live"])
    .limit(1)
    .maybeSingle();

  if (existingForSkill) {
    return {
      status: "already_scheduled",
      classinSessionId: (existingForSkill as { id: string }).id,
    };
  }

  const { data: upcoming } = await supabase
    .from("classin_sessions")
    .select("scheduled_at")
    .eq("student_id", studentId)
    .in("status", ["scheduled", "live"])
    .not("scheduled_at", "is", null);

  const slot = decideNextClassSlot(
    ((upcoming ?? []) as { scheduled_at: string }[]).map((r) => ({
      scheduledAt: r.scheduled_at,
    }))
  );
  if (!slot) return { status: "no_slot_available" };

  let classinClass: ClassinClass | null = null;
  let pushedToClassin = false;
  try {
    classinClass = await createClass({
      classinCourseId: "", // TODO(EEO): a real course must exist/be created first — see createCourse.
      scheduledAt: slot.toISOString(),
      durationMins: DEFAULT_CLASS_DURATION_MINS,
    });
    pushedToClassin = true;
  } catch (err) {
    if (!(err instanceof ClassinUnavailableError)) throw err;
    // Expected today — log and still record the local scheduling intent.
    console.warn(
      `[classin/scheduling] ClassIn push unavailable, recording locally only: ${err.message}`
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("classin_sessions")
    .insert({
      student_id: studentId,
      classin_class_id: classinClass?.classinClassId ?? null,
      join_url: classinClass?.joinUrl ?? null,
      focus_skill: rec.skill,
      scheduled_at: slot.toISOString(),
      status: "scheduled",
      teacher_name: null, // staffing is a separate, later pass — see module doc comment.
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new Error(`classin_sessions insert failed: ${insertErr?.message ?? "no row returned"}`);
  }

  return {
    status: "scheduled_locally",
    classinSessionId: (inserted as { id: string }).id,
    pushedToClassin,
  };
}
