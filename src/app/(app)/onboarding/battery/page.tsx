import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseTaskPromptPublic,
  type TaskType,
  type TaskPromptPublic,
} from "@/lib/onboarding/battery/types";
import {
  selectTasksForStudent,
  type SelectedTask,
} from "@/lib/onboarding/battery/select-tasks";
import type { CefrBand } from "@/lib/scoring/rubric";
import { BatteryRunner, type LoadedTask } from "./battery-runner";

/**
 * Phase 0b assessment-battery — entry point.
 *
 *   1. Read the student's voice-discovery profile + role baselines, and
 *      ask src/lib/onboarding/battery/select-tasks.ts which subset of the
 *      four task types to run, at what difficulty band each.
 *   2. Pull one prompt per selected task type at the chosen difficulty,
 *      preferring role-scoped → falling back to generic.
 *   3. Hydrate the runner that walks the student through the chosen
 *      tasks in priority order, then redirects to /dashboard once done.
 *
 * Row-level security: discovery_task_prompts allows authenticated read on
 * prompt_public; prompt_private is column-revoked. Server-side fetching
 * uses the user's RLS-scoped client deliberately.
 */
export const dynamic = "force-dynamic";

export default async function BatteryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/onboarding/battery");

  const { data: studentRow } = await supabase
    .from("students")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();
  const roleId = (studentRow as { role_id?: string | null } | null)?.role_id ?? null;

  const selected = await selectTasksForStudent(supabase, user.id);

  const tasks: LoadedTask[] = [];
  for (const sel of selected) {
    const loaded = await pickPrompt(supabase, sel, roleId);
    if (!loaded) {
      return (
        <div className="rounded-lg border border-coral/30 bg-coral/5 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-coral">
            Battery not configured
          </p>
          <h1 className="mt-1 font-serif text-2xl text-navy">
            No {sel.taskType} prompt seeded for {sel.difficultyBand}
          </h1>
          <p className="mt-2 text-sm text-mute">
            Seed role-scoped prompts via{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              scripts/seed-role-battery-prompts.ts
            </code>
            , or apply migration{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              0017_battery_seed_prompts.sql
            </code>{" "}
            for the generic fallbacks.
          </p>
        </div>
      );
    }
    tasks.push(loaded);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Step 2 — Assessment battery
        </p>
        <h1 className="font-serif text-3xl text-navy">
          {tasks.length === 1
            ? "One short task to confirm your strongest skill"
            : `${tasks.length} short tasks tuned to your voice profile`}
        </h1>
        <p className="mt-3 max-w-2xl text-mute">
          Aria heard you talk. We picked these tasks based on what the voice
          conversation couldn&apos;t measure directly — or where the score
          looked close to your role baseline and we want to verify.
        </p>
      </div>
      {selected.length > 0 && <SelectionRationale selected={selected} />}
      <BatteryRunner tasks={tasks} />
    </div>
  );
}

function SelectionRationale({ selected }: { selected: SelectedTask[] }) {
  return (
    <details className="rounded-md border border-cream bg-paper p-4 text-sm">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy">
        Why these tasks?
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {selected.map((s) => (
          <li key={s.taskType} className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy">
              {s.taskType.replace("_", " ")} · {s.difficultyBand}
            </span>
            <span className="text-xs italic text-mute">{s.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

async function pickPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  selected: SelectedTask,
  roleId: string | null
): Promise<LoadedTask | null> {
  const tryFetch = async (
    band: CefrBand,
    role: string | null
  ): Promise<PromptRow | null> => {
    let q = supabase
      .from("discovery_task_prompts")
      .select("id, task_type, prompt_public, variant_bucket, difficulty_band")
      .eq("task_type", selected.taskType)
      .eq("difficulty_band", band)
      .eq("is_archived", false)
      .limit(1);
    q = role === null ? q.is("role_id", null) : q.eq("role_id", role);
    const { data } = await q.maybeSingle();
    return (data as PromptRow | null) ?? null;
  };

  // Resolution order: role-scoped at exact band → generic at exact band →
  // role-scoped at fallback band (B2) → generic at fallback (B2).
  const fallbackBand: CefrBand = "B2";
  const ladder: { band: CefrBand; role: string | null }[] = [];
  if (roleId) ladder.push({ band: selected.difficultyBand, role: roleId });
  ladder.push({ band: selected.difficultyBand, role: null });
  if (selected.difficultyBand !== fallbackBand) {
    if (roleId) ladder.push({ band: fallbackBand, role: roleId });
    ladder.push({ band: fallbackBand, role: null });
  }

  for (const step of ladder) {
    const row = await tryFetch(step.band, step.role);
    if (row) return shapeLoaded(row);
  }
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
