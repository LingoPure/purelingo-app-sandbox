import { z } from "zod";
import { defineDiscovery } from "@caistech/discovery-agent";
import { createClient } from "@supabase/supabase-js";

// Result of the discovery interview
export const discoveryOutcome = z.object({
  role_suitability: z.string(),
  communication_style: z.string(),
  language_goals: z.array(z.string()),
  confidence_score: z.number().min(0).max(10),
});

// Aria persona definition
export const ariaDiscovery = defineDiscovery(
  {
    slug: "aria-discovery",
    purpose: "Assess the learner's language proficiency, goals, and communication style for onboarding.",
    persona: {
      name: "Aria",
      voiceId: "EXAVITQu4vr4xnSDxMaL", // Rachel/Aria ID
      opening: "Hi! I'm Aria, your LingoPure learning consultant. I'd love to learn about your language goals today.",
      signature: "Let's get started.",
      systemPrompt: "You are Aria, LingoPure's friendly, professional onboarding consultant.",
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
    onResult: async (result, meta) => {
      // Sinks result into the student record
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
  },
  {
    runner: {
        run: async ({ schema }) => {
            // Placeholder runner
            return { result: schema.parse({
                role_suitability: "Suitable",
                communication_style: "Professional",
                language_goals: ["Fluency"],
                confidence_score: 8
            }) };
        }
    },
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    sessionSecret: process.env.DISCOVERY_SESSION_SECRET || "temp-secret",
    supabase: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  }
);
