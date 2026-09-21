/**
 * Adaptive battery task selection.
 *
 * Read the student's voice-discovery profile + role baselines, then
 * decide which of the four battery task types to put in front of them
 * (and at what difficulty band). Replaces the original "always run all
 * four at B2" logic.
 *
 * Decision principles (post-voice signal quality, per spec §1; taxonomy
 * updated for ISS-048 — six primary dimensions + two supporting measures):
 *
 *   speaking          — voice MEASURED. No battery task exists.
 *   listening         — voice partially measured (Sarah/Mark email
 *                        read aloud). listen_paraphrase probes
 *                        when the partial signal is weak or below
 *                        the role baseline.
 *   writing           — voice INFERRED only. Always probe.
 *   reading           — voice partially measured (Sarah/Mark
 *                        hint test) but conflated with listening.
 *                        Always probe — silent reading is the
 *                        only clean signal.
 *   grammar           — voice MEASURED (whole-transcript pattern). No
 *                        battery task exists.
 *   live_interaction  — voice MEASURED (turn-taking/repair). No battery
 *                        task exists.
 *   business_vocabulary   (supporting) — voice partially measured (spoken
 *                        vocab only). Probe when below baseline; written
 *                        register is its own gap.
 *   presentation_delivery (supporting) — voice INFERRED only. No battery
 *                        task.
 *
 * Difficulty band: target_level (the band the student needs to reach).
 * That's the level we should be calibrating against — not their current
 * voice-band, which is by definition below target. If target is unknown
 * fall back to B2.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TASK_TYPES,
  TASK_SKILL,
  type TaskType,
} from "./types";
import {
  loadBaselinesForStudent,
  FLAT_FALLBACK_TARGET,
} from "@/lib/scoring/baselines";
import type { CefrBand, AnySkillKey } from "@/lib/scoring/rubric";

export type SelectedTask = {
  taskType: TaskType;
  difficultyBand: CefrBand;
  /** Per-task explanation suitable for surfacing in the UI / logs. */
  reason: string;
  /** The voice-side score for the skill this task probes (or null if
   *  the voice scoring hasn't completed yet). Useful for the UI to show
   *  "we're double-checking your X" framing. */
  voiceScore: number | null;
  /** The role baseline this task is calibrating against. */
  baseline: number;
};

/**
 * Probe thresholds. A skill is "worth probing" when:
 *   - voice scoring inferred it entirely (always-probe), OR
 *   - the voice score is at or below the role baseline minus the slack
 *     (PROBE_SLACK), so we have measurable headroom to verify.
 *
 * Slack of 40 means a student already 40+ points above the role baseline
 * on a partially-measured skill skips the corresponding probe — the demo
 * battery is calibrated to expose gaps, not to grind a strong student.
 */
const PROBE_SLACK = 40;

const ALWAYS_PROBE: ReadonlySet<AnySkillKey> = new Set([
  "writing", // voice infers entirely
  "reading", // voice probes but conflates with listening
]);

type ProfileJson = {
  speaking?: { score: number };
  listening?: { score: number };
  writing?: { score: number };
  reading?: { score: number };
  grammar?: { score: number };
  live_interaction?: { score: number };
  business_vocabulary?: { score: number };
  presentation_delivery?: { score: number };
  target_level?: CefrBand;
};

const ALL_BANDS: readonly CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
function isCefrBand(value: unknown): value is CefrBand {
  return typeof value === "string" && (ALL_BANDS as readonly string[]).includes(value);
}

export async function selectTasksForStudent(
  supabase: SupabaseClient,
  studentId: string
): Promise<SelectedTask[]> {
  const [profileRes, studentRes, baselines] = await Promise.all([
    supabase
      .from("discovery_sessions")
      .select("profile_json")
      .eq("student_id", studentId)
      .eq("status", "complete")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("students")
      .select("target_level")
      .eq("id", studentId)
      .maybeSingle(),
    loadBaselinesForStudent(supabase, studentId),
  ]);

  const profile = (profileRes.data?.profile_json ?? null) as ProfileJson | null;
  const studentTarget = (studentRes.data as { target_level?: string } | null)
    ?.target_level;
  const profileTarget = profile?.target_level;
  const targetLevel: CefrBand = isCefrBand(studentTarget)
    ? studentTarget
    : isCefrBand(profileTarget)
      ? profileTarget
      : "B2";

  const selected: SelectedTask[] = [];

  for (const taskType of TASK_TYPES) {
    const skill = TASK_SKILL[taskType];
    const voiceScore = profile?.[skill]?.score ?? null;
    // Supporting skills (e.g. business_vocabulary) have no role-specific
    // baseline — Baselines only carries the 6 primary keys — so they fall
    // straight through to the flat 800 default.
    const baseline =
      (baselines as Partial<Record<AnySkillKey, number>>)[skill] ??
      FLAT_FALLBACK_TARGET;

    let probe = false;
    let reason = "";

    if (ALWAYS_PROBE.has(skill)) {
      probe = true;
      reason =
        skill === "writing"
          ? "Voice can't measure written register — probe directly."
          : "Voice conflates reading with listening — silent reading is the clean signal.";
    } else if (voiceScore == null) {
      probe = true;
      reason = `No voice score on file for ${skill} — probe to establish a baseline.`;
    } else if (voiceScore <= baseline - PROBE_SLACK) {
      probe = true;
      reason = `Voice score ${voiceScore} is well below the ${baseline} role baseline — verify directly.`;
    } else if (voiceScore <= baseline) {
      probe = true;
      reason = `Voice score ${voiceScore} is at or just below baseline ${baseline} — confirm with a direct probe.`;
    } else {
      reason = `Voice score ${voiceScore} already exceeds baseline ${baseline} by ${voiceScore - baseline}+ — skipping.`;
    }

    if (probe) {
      selected.push({
        taskType,
        difficultyBand: targetLevel,
        reason,
        voiceScore,
        baseline,
      });
    }
  }

  // Stable order: biggest gap first so the student starts on the most
  // diagnostically valuable task. Tied gaps fall back to TASK_TYPES order
  // (matches the spec's task-numbering 1..4 for the UI progress rail).
  selected.sort((a, b) => {
    const gapA = a.voiceScore == null ? Infinity : a.baseline - a.voiceScore;
    const gapB = b.voiceScore == null ? Infinity : b.baseline - b.voiceScore;
    if (gapA !== gapB) return gapB - gapA;
    return TASK_TYPES.indexOf(a.taskType) - TASK_TYPES.indexOf(b.taskType);
  });

  // Floor: never return zero tasks. If a (rare) high-performing student
  // skips every probe, still run a writing probe at target — the demo
  // shouldn't have an empty battery state.
  if (selected.length === 0) {
    const baseline = baselines.writing ?? FLAT_FALLBACK_TARGET;
    selected.push({
      taskType: "email_writing",
      difficultyBand: targetLevel,
      reason:
        "Voice signals all exceed baseline — running a single direct writing probe to confirm.",
      voiceScore: profile?.writing?.score ?? null,
      baseline,
    });
  }

  return selected;
}
