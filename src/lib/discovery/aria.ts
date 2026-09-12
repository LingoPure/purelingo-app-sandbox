/**
 * Aria onboarding discovery — the Kira-style voice discovery agent
 * applied to the learner onboarding / discovery surface (#4 / §10.4).
 *
 * This is the ONE surface the package customises (README "The one surface
 * a product customises"); the classroom speaking-practice voices stay bespoke.
 */

import { z } from "zod";
import { defineDiscovery } from "@caistech/discovery-agent";

// ─── Extraction schema ────────────────────────────────────────────────────────
// Aria's post-call webhook extracts these facts; the battery + session page
// consume them. Kept lean — the 2K battery covers the real proficiency scoring.

export const ariaExtraction = z.object({
  /** Native language the learner reports. */
  nativeLanguage: z.string().nullable(),
  /** Self-reported workplace context. */
  workContext: z.string().nullable(),
  /** Specific English challenge the learner names. */
  challenge: z.string().nullable(),
  /** Target CEFR band the learner or their org selects. */
  targetLevel: z.string().nullable(),
});
export type AriaExtraction = z.infer<typeof ariaExtraction>;

// ─── Discovery definition ─────────────────────────────────────────────────────

export const ariaDiscovery = defineDiscovery<AriaExtraction>(
  {
    slug: "aria-onboarding",
    purpose:
      "Conduct a warm bilingual English discovery interview. Learn the learner's name, native language, workplace role, and the English situations they encounter most. Surface their biggest challenge. Then hand off cleanly to the structured assessment battery.",
    persona: {
      name: "Aria",
      voiceId: process.env.ARIA_VOICE_ID!,
      opening:
        "Hi there! I'm Aria. I'll be chatting with you for a few minutes to learn about your work and how you use English. Don't worry — this isn't a test. It's just a conversation.",
      signature:
        "Great — now you're ready for the next part. You've got this!",
      systemPrompt: [
        "You are Aria, a warm, professional bilingual English interviewer.",
        "You are interviewing a learner as part of their onboarding into an English training programme.",
        "Your goal is to learn: (1) their native language, (2) their workplace role, (3) the English situations they face most, and (4) the single biggest English challenge they'd like to overcome.",
        "Keep the conversation natural, supportive, and concise — aim for 3–5 minutes. Do NOT run an English test; this is a friendly conversation.",
        "If the learner seems nervous, reassure them. If they drift off-topic, gently guide them back.",
      ].join("\n"),
    },
    stages: [
      {
        id: "warmup",
        goal: "Learn the learner's name and native language",
        context:
          "Greet the learner warmly. Ask their name and what language they speak at home. Mirror back what they tell you.",
      },
      {
        id: "role_context",
        goal: "Understand their workplace role and where English fits in",
        context:
          "Ask what kind of work they do and whether they use English at work. If they describe a role, ask for a specific example of when they use English.",
      },
      {
        id: "scenario",
        goal: "Surface the real English challenge",
        context:
          "Ask what the hardest part of using English at work is. Listen for a concrete story — emails, meetings, phone calls. Acknowledge the difficulty.",
      },
      {
        id: "closing",
        goal: "Wrap up and transition to the assessment",
        context:
          "Summarise what you heard: their role, where they use English, and the challenge they named. Tell them you're done and the structured assessment is next. Be encouraging.",
      },
    ],
    extraction: {
      schema: ariaExtraction,
      system:
        "Extract the facts Aria collected: native language, work context, the named challenge, and the target level if mentioned. Use null for anything not discussed.",
      model: {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4",
      },
      requireEvidence: true,
    },
    interviewModel: {
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
    },
    /**
     * Push what we already know into Aria's opening context so she walks in
     * informed — the Kira "pre-cached identity" pattern (§3.A1).
     */
    primeContext: async (subjectId: string) => {
      // subjectId is the learner's auth.uid — the server route injects
      // this, and the webhook route can read the student's row for any
      // additional context. For now the opener is sufficient.
      return `You are about to speak with a learner (${subjectId}). Be warm and natural.`;
    },
    onResult: async (result: AriaExtraction, meta: { subjectId: string }) => {
      // The post-call extraction result. The existing onboarding flow
      // navigates to the battery next; the battery page can pick these
      // up from the session result. For now, log the extraction result.
      console.info("[aria-discovery] extraction result", {
        subjectId: meta.subjectId,
        result,
      });
    },
  },
  {
    runner: {
      /**
       * The StructuredRunner is injected — no model SDK weight in the
       * package. We provide the Anthropic tool-use runner inline using
       * the installed @anthropic-ai/sdk (README §Injecting the runner).
       */
      async run({ model, system, input }) {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic();
        const res = await client.messages.create({
          model: model.model ?? "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system,
          messages: [{ role: "user", content: JSON.stringify(input) }],
        });
        const text =
          res.content.find((b) => b.type === "text")?.text ?? "{}";
        return JSON.parse(text) as Record<string, unknown>;
      },
    },
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY!,
    sessionSecret: process.env.DISCOVERY_SESSION_SECRET!,
    supabase: null, // Optional — the built-in memory store is used; pass a Supabase client if memory persistence is desired
    baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
    existingAgentId: process.env.ARIA_AGENT_ID || undefined,
    postCallSecret: process.env.ARIA_WEBHOOK_SECRET || undefined,
  },
);