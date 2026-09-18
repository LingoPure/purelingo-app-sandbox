// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveLanguage } from "@/lib/i18n";
import { bilingualize } from "@/lib/i18n/translate";
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

export const dynamic = "force-dynamic";

export default async function BatteryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/onboarding/battery");

  const { data: studentRow } = await supabase
    .from("students")
    .select("role_id, discovery_status")
    .eq("id", user.id)
    .maybeSingle();
  const studentInfo = studentRow as
    | { role_id?: string | null; discovery_status?: string | null }
    | null;
  const roleId = studentInfo?.role_id ?? null;

  // Gate: the battery is meaningless without the voice signal it's
  // calibrated against. If the voice discovery hasn't completed (e.g.
  // the student deep-linked here, or the post-call webhook hasn't yet
  // landed), bounce to /onboarding/session. Battery scores written
  // without a voice profile produce a half-built gap analysis that
  // misleads both the student and the employer.
  if (studentInfo?.discovery_status !== "complete") {
    redirect("/onboarding/session");
  }

  const selected = await selectTasksForStudent(supabase, user.id);
  const lang = await getActiveLanguage();
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

  const introTexts = [
    "Voice discovery complete",
    "Now we measure the rest — directly",
    "Aria heard you speak. The voice conversation is great for fluency, comprehension, and learning style — but it can't directly measure how you write business emails, how you read for subtext, or how precisely you pick words. These short tasks fill those gaps. Together they produce the full profile your employer sees.",
    "Total time: ~",
    "min · One submission at the end triggers the full gap analysis",
    "Start the assessment →",
  ];
  const bIntro = await bilingualize(introTexts, lang);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          {bIntro[0].native}
        </p>
        <h1 className="font-serif text-3xl text-navy">
          {bIntro[1].native}
        </h1>
      </div>
      <BatteryRunner tasks={tasks} selected={selected} bIntro={bIntro} />
    </div>
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
