import { z } from "zod";
import { ROLE_DISCOVERY_SYSTEM_PROMPT } from "./role-discovery-agent-base.mjs";

// Result shape defineDiscovery's types require — unused at runtime. The
// real extraction (transcript -> role profile) happens server-side in the
// convai webhook's role-discovery branch via scoreRoleDiscoverySession, the
// same split the student discovery flow already has (aria-discovery.ts's
// runner is likewise a placeholder; see its own comment).
export const roleDiscoveryOutcome = z.object({
  interview_complete: z.boolean(),
});

/**
 * Aria-as-role-interviewer persona definition — the CLIENT-SAFE half.
 *
 * Mirrors onboarding/aria-discovery-config.ts's split: the client
 * component only needs `config` to render the widget; runtime deps
 * (ElevenLabs credentials, the service-role sink, the runner) live in
 * role-discovery.ts, server-only.
 */
export const roleDiscoveryConfig: {
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
    schema: typeof roleDiscoveryOutcome;
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
  slug: "role-discovery",
  purpose:
    "Interview an employer admin about a role's day-to-day English demands, to set accurate per-skill baselines for it.",
  persona: {
    name: "Aria",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Rachel/Aria ID
    opening:
      "Hi, I'm Aria. I'm here to help define this role properly.",
    signature: "Thanks for walking me through that.",
    systemPrompt: ROLE_DISCOVERY_SYSTEM_PROMPT,
  },
  stages: [
    { id: "intro", goal: "Confirm the role + get the plain-language description", context: "Ask what the role is called and what it does day to day." },
    { id: "communication", goal: "Who they talk to + how formal/high-stakes", context: "Ask who this role communicates with and how important getting it right is." },
    { id: "modes", goal: "Spoken vs written demands", context: "Ask whether the role leans spoken (calls, meetings) or written (email, reports), and how real-time the spoken work is." },
    { id: "stakes", goal: "What happens when English breaks down", context: "Ask what the real consequence is when someone in this role gets the English wrong." },
  ],
  extraction: {
    schema: roleDiscoveryOutcome,
    system: "Unused placeholder — real extraction runs server-side from the transcript (see score-role-discovery.ts).",
    model: { provider: "anthropic", model: "claude-fable-5" },
    requireEvidence: false,
  },
  onResult: async () => {
    // Unused — scoring happens in the convai webhook's role-discovery
    // branch, not via the package's own distil/onResult path. Left as a
    // no-op for type conformance, matching aria-discovery.ts's placeholder
    // runner.
  },
  interviewModel: { provider: "openrouter", model: "gpt-4.1-mini" },
  // Called by @caistech/discovery-agent's startSession() to build the
  // per-session prompt PUSH. subjectId here is the DRAFT ROLE's id (not an
  // admin's user id) — the role being defined is this interview's real
  // subject; the admin's identity is bound separately via the existing
  // generic /api/convai/bind (same mechanism every other voice agent in
  // this app already uses).
  primeContext: async (subjectId: string): Promise<string> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) return ROLE_DISCOVERY_SYSTEM_PROMPT;
    const admin = createClient(url, key);

    const { data: role } = await admin
      .from("roles")
      .select("name, employer_id")
      .eq("id", subjectId)
      .maybeSingle();
    if (!role?.name) return ROLE_DISCOVERY_SYSTEM_PROMPT;

    let employerName = "";
    if (role.employer_id) {
      const { data: employer } = await admin
        .from("employers")
        .select("name")
        .eq("id", role.employer_id)
        .maybeSingle();
      employerName = (employer?.name as string | undefined) ?? "";
    }

    const context =
      `\n\nThe admin named this role "${role.name}"` +
      (employerName ? ` at ${employerName}` : "") +
      `. Confirm the name is right, then move straight into what the role actually does — don't ask them to re-state the name.`;
    return ROLE_DISCOVERY_SYSTEM_PROMPT + context;
  },
};
