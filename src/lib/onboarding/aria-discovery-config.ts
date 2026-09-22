import { z } from "zod";

// Result of the discovery interview
export const discoveryOutcome = z.object({
  role_suitability: z.string(),
  communication_style: z.string(),
  language_goals: z.array(z.string()),
  confidence_score: z.number().min(0).max(10),
});

/**
 * Aria persona definition — the CLIENT-SAFE half of the discovery agent.
 *
 * Split on purpose: the client component (DiscoverySession) only needs
 * `config` to render the widget. Aria's runtime deps (ElevenLabs credentials,
 * Supabase service-role client for the sink) live in aria-discovery.ts, which
 * is server-only — the service-role key must never reach a client bundle.
 *
 * `onResult` here only ever runs server-side (invoked by the webhook route).
 * It is defined in this module so the persona config stays in one place.
 */
export const ariaDiscoveryConfig: {
  slug: string;
  purpose: string;
  persona: {
    name: string;
    voiceId: string;
    opening: string;
    signature: string;
    systemPrompt: string;
  };
  stages: {
    id: string;
    goal: string;
    context: string;
  }[];
  extraction: {
    schema: typeof discoveryOutcome;
    system: string;
    model: { provider: "anthropic"; model: string };
    requireEvidence: boolean;
  };
  onResult: (
    result: unknown,
    meta: { subjectId: string }
  ) => Promise<void>;
  interviewModel: { provider: "openrouter"; model: string };
  primeContext: (subjectId: string) => Promise<string>;
} = {
  slug: "aria-discovery",
  purpose:
    "Assess the learner's language proficiency, goals, and communication style for onboarding.",
  persona: {
    name: "Aria",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Rachel/Aria ID
    opening:
      "Hi! I'm Aria, your LingoPure learning consultant. I'd love to learn about your language goals today.",
    signature: "Let's get started.",
    systemPrompt:
      "You are Aria, LingoPure's friendly, professional onboarding consultant.",
  },
  stages: [
    { id: "intro", goal: "Rapport", context: "Introduce yourself and ask how they're doing." },
    { id: "goals", goal: "Language goals", context: "Ask what they hope to achieve." },
    { id: "assessment", goal: "Assess style", context: "Have them describe a work situation." },
  ],
  extraction: {
    schema: discoveryOutcome,
    system: "Distil the interview into the role suitability and language goals schema.",
    model: { provider: "anthropic", model: "claude-fable-5" },
    requireEvidence: true,
  },
  onResult: async (result: unknown, meta: { subjectId: string }) => {
    // Sinks result into the student record. Server-only (webhook path).
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) return;
    const admin = createClient(url, key);
    await admin
      .from("students")
      .update({ discovery_status: "completed" })
      .eq("id", meta.subjectId);
  },
  interviewModel: { provider: "openrouter", model: "gpt-4.1-mini" },
  // Called by @caistech/discovery-agent's startSession() to build the
  // per-session prompt PUSH (overrides.agent.prompt.prompt). Server-only
  // (invoked from the POST /api/onboarding/discovery/session route) — same
  // dynamic-import pattern as onResult above, so the service-role key never
  // reaches a client bundle.
  //
  // Before this existed, startSession() had no primeContext to call, so
  // promptOverride was always undefined and the agent ran on its static
  // provisioned prompt with every {{student_name}}/{{role_name}}/
  // {{target_level}}/{{employer_name}}/{{native_language}} placeholder in
  // scripts/discovery-system-prompt.ts left completely unsubstituted, for
  // every student, every call. Root-caused live 2026-09-23: a real discovery
  // call had Aria assert "you mentioned you're aiming for B2" to a student
  // who never said that — the prompt's Dimension 5 instruction ("you
  // already know they're aiming for {{target_level}} — confirm it, don't
  // re-ask") combined with an unsubstituted placeholder, and the model
  // hallucinated a plausible CEFR level rather than recognising it as empty.
  primeContext: async (subjectId: string): Promise<string> => {
    const { createClient } = await import("@supabase/supabase-js");
    const { SYSTEM_PROMPT } = await import(
      "../../../scripts/discovery-system-prompt"
    );
    const { isLanguageCode, languageNameOf } = await import(
      "@/lib/i18n/dictionary"
    );
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Degrade to the base (unsubstituted) prompt rather than throwing — a
    // failed lookup must never kill the call outright.
    if (!url || !key) return SYSTEM_PROMPT;
    const admin = createClient(url, key);

    const { data: student } = await admin
      .from("students")
      .select("name, employer_id, role_id, target_level, native_language, discovery_status")
      .eq("id", subjectId)
      .maybeSingle();

    let roleName = "";
    let roleDescription = "";
    if (student?.role_id) {
      const { data: role } = await admin
        .from("roles")
        .select("name, description")
        .eq("id", student.role_id)
        .maybeSingle();
      roleName = (role?.name as string | undefined) ?? "";
      roleDescription = (role?.description as string | undefined) ?? "";
    }

    let employerName = "";
    if (student?.employer_id) {
      const { data: employer } = await admin
        .from("employers")
        .select("name")
        .eq("id", student.employer_id)
        .maybeSingle();
      employerName = (employer?.name as string | undefined) ?? "";
    }

    const langCode = student?.native_language as string | undefined;
    const nativeLanguageName =
      langCode && isLanguageCode(langCode) ? languageNameOf(langCode) : "";

    // students.target_level defaults to 'B2' AT THE SCHEMA LEVEL (migration
    // 0001) — every row has a non-null value whether or not anyone ever
    // actually set it, so presence alone can't distinguish "the student
    // told us B2" from "nobody has touched this column yet". Establishing
    // the target level is literally Dimension 5 of a FIRST discovery call,
    // so only trust the stored value once a PRIOR discovery session has
    // actually completed for this student (score-discovery.ts is what
    // writes a real, elicited value back after a call finishes) — otherwise
    // treat it as empty and let Aria ask, per the prompt's own "any of
    // these may be empty — treat as not pre-briefed" contract.
    const targetLevel =
      student?.discovery_status === "complete"
        ? ((student?.target_level as string | undefined) ?? "")
        : "";

    const values: Record<string, string> = {
      student_name: (student?.name as string | undefined) ?? "",
      native_language: nativeLanguageName,
      role_name: roleName,
      role_description: roleDescription,
      target_level: targetLevel,
      employer_name: employerName,
    };

    let prompt = SYSTEM_PROMPT;
    for (const [k, v] of Object.entries(values)) {
      prompt = prompt.split(`{{${k}}}`).join(v);
    }
    return prompt;
  },
};