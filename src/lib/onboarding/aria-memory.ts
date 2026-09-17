/**
 * Discovery (Aria) memory extractor — distils a completed onboarding interview
 * into durable convai_memory rows so a returning learner is remembered across
 * sessions and logout/login cycles (the coaching leg of VOICE_MEMORY_STANDARD).
 *
 * The discovery conversations carry the learner's goals, level, style, and
 * constraints — exactly the continuity Aria needs to greet naturally next time.
 * Degrade-don't-fake: returns [] on any failure rather than inventing memories.
 */

import type { MemoryExtractor } from "@caistech/elevenlabs-convai";
import { anthropicClient } from "@/lib/llm/client";

const DISTILL_MODEL = process.env.ANTHROPIC_DISTILL_MODEL ?? "claude-sonnet-4-6";

export function ariaMemoryExtractor(): MemoryExtractor {
  return async (turns) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || turns.length === 0) return [];
    const transcript = turns
      .map((t) => `${t.role === "assistant" ? "Aria" : "Learner"}: ${t.content}`)
      .join("\n");

    const anthropic = anthropicClient();
    try {
      const completion = await anthropic.messages.create({
        model: DISTILL_MODEL,
        max_tokens: 700,
        system:
          "You distil a learner's spoken onboarding interview with Aria (LingoPure's business-English discovery coach) into durable memory items that would help Aria pick up naturally in a future session. " +
          "Capture ONLY things worth remembering about THIS learner: their language goals, current level/fluency, communication style, professional context/role, time constraints or scheduling, preferred topics, and anything they explicitly corrected. " +
          'Return ONLY a JSON array (no prose, no fence): [{"content": string, "memoryType": "preference"|"context"|"goal"|"decision"|"followup"|"correction"|"insight", "importance": 1-10, "tags": string[]}]. ' +
          "Return [] if nothing is worth keeping.",
        messages: [{ role: "user", content: transcript.slice(0, 12000) }],
      });
      const raw = completion.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .replace(/^```json\s*|\s*```$/g, "");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (m) =>
            m &&
            typeof m.content === "string" &&
            m.content.trim().length > 0 &&
            ["preference", "context", "goal", "decision", "followup", "correction", "insight"].includes(
              m.memoryType
            )
        )
        .map((m) => ({
          content: m.content.trim(),
          memoryType: m.memoryType,
          importance: Number.isFinite(Number(m.importance))
            ? Math.min(10, Math.max(1, Math.round(Number(m.importance))))
            : 5,
        }))
        .slice(0, 12);
    } catch {
      return [];
    }
  };
}