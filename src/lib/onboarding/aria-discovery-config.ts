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
};