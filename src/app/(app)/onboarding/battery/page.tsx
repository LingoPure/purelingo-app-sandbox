import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseTaskPromptPublic,
  TASK_TYPES,
  type TaskType,
  type TaskPromptPublic,
} from "@/lib/onboarding/battery/types";
import { BatteryRunner, type LoadedTask } from "./battery-runner";

/**
 * Phase 0b assessment-battery — entry point.
 *
 * Pulls one B2 prompt per task type for the student's role (or generic
 * if no role-specific variant). Hydrates a single-page-app runner that
 * walks the student through the four tasks in sequence, submits each to
 * /api/onboarding/battery/submit, then redirects to the dashboard.
 *
 * Row-level security on discovery_task_prompts allows authenticated read
 * on prompt_public; prompt_private is column-revoked. Server-side
 * fetching uses the user's RLS-scoped client deliberately — we don't
 * need or want service role here.
 */
export const dynamic = "force-dynamic";

export default async function BatteryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/onboarding/battery");

  // Look up the student's role so we can prefer role-scoped prompts when
  // they exist. Falls back to generic (role_id IS NULL) prompts for the
  // demo cohort which has no role-specific content yet.
  const { data: studentRow } = await supabase
    .from("students")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();
  const roleId = (studentRow as { role_id?: string | null } | null)?.role_id ?? null;

  // For each task type, pick the first non-archived prompt at B2 — preferring
  // role-scoped, falling back to generic. We don't randomise yet; the demo
  // cohort runs once and the variant_bucket exists for re-test.
  const tasks: LoadedTask[] = [];
  for (const taskType of TASK_TYPES) {
    const prompt = await pickPrompt(supabase, taskType, roleId);
    if (!prompt) {
      // Surface a clear error on the page rather than silently skipping a
      // task — a missing prompt means the seed didn't run.
      return (
        <div className="rounded-lg border border-coral/30 bg-coral/5 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-coral">
            Battery not configured
          </p>
          <h1 className="mt-1 font-serif text-2xl text-navy">
            No {taskType} prompt seeded for B2
          </h1>
          <p className="mt-2 text-sm text-mute">
            Run migration{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              0017_battery_seed_prompts.sql
            </code>{" "}
            against your Supabase project.
          </p>
        </div>
      );
    }
    tasks.push(prompt);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Step 2 — Assessment battery
        </p>
        <h1 className="font-serif text-3xl text-navy">
          Show us how you write, listen, read and choose words
        </h1>
        <p className="mt-3 max-w-2xl text-mute">
          Aria heard you talk. Now we measure the rest — directly. Four short
          tasks, ~15 minutes. Your gap profile updates as each one is scored.
        </p>
      </div>
      <BatteryRunner tasks={tasks} />
    </div>
  );
}

async function pickPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskType: TaskType,
  roleId: string | null
): Promise<LoadedTask | null> {
  // Try role-scoped first if a role is assigned.
  if (roleId) {
    const { data } = await supabase
      .from("discovery_task_prompts")
      .select("id, task_type, prompt_public, variant_bucket, difficulty_band")
      .eq("task_type", taskType)
      .eq("difficulty_band", "B2")
      .eq("is_archived", false)
      .eq("role_id", roleId)
      .limit(1)
      .maybeSingle();
    const row = data as PromptRow | null;
    if (row) return shapeLoaded(row);
  }
  // Generic fallback (role_id IS NULL).
  const { data } = await supabase
    .from("discovery_task_prompts")
    .select("id, task_type, prompt_public, variant_bucket, difficulty_band")
    .eq("task_type", taskType)
    .eq("difficulty_band", "B2")
    .eq("is_archived", false)
    .is("role_id", null)
    .limit(1)
    .maybeSingle();
  const row = data as PromptRow | null;
  if (row) return shapeLoaded(row);
  return null;
}

type PromptRow = {
  id: string;
  task_type: TaskType;
  prompt_public: unknown;
  variant_bucket: string;
  difficulty_band: string;
};

function shapeLoaded(row: PromptRow): LoadedTask {
  const parsed: TaskPromptPublic = parseTaskPromptPublic(
    row.task_type,
    row.prompt_public
  );

  // listen_paraphrase prompts don't store audio_url in the seed — we
  // populate it here so the row stays portable across environments
  // (the route is environment-relative).
  if (parsed.task_type === "listen_paraphrase") {
    return {
      prompt_id: row.id,
      variant_bucket: row.variant_bucket,
      prompt: {
        ...parsed,
        data: {
          ...parsed.data,
          audio_url: `/api/onboarding/battery/audio?prompt_id=${row.id}`,
        },
      },
    };
  }
  return {
    prompt_id: row.id,
    variant_bucket: row.variant_bucket,
    prompt: parsed,
  };
}
