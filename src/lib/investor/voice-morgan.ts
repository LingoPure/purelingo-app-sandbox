/**
 * Voice Morgan — the investor-portal voice clarifier (server-side helpers).
 *
 * Morgan is the spoken counterpart to the text "Ask the dataroom": an investor
 * chooses "Text only (I know what I need)" or "Talk to Morgan" (help me figure
 * out what I need). Morgan is a CLARIFIER — she helps an investor turn a broad
 * interest into the specific questions the dataroom can answer, then hands them
 * to the cited written analyst. She never recites tier-gated figures (only the
 * authed text Ask, server-tier-checked, does that), so a voice call carries no
 * confidential-data egress.
 *
 * This module owns the two server-side legs of the persistent-memory loop:
 *   - RECALL  — loadVoiceRecall() reads prior conversations/memory so the page
 *               can greet a returning investor (welcome-back) via a first-message
 *               override on the VoiceWidget.
 *   - PERSIST — morganMemoryExtractor() distils a completed call's transcript
 *               into convai_memory (called from the post-call webhook).
 *
 * The ElevenLabs agent's base system prompt + default first message live in the
 * provisioning script (scripts/provision-investor-morgan.mjs) — that is where
 * they are authoritative. Here we only build the per-session welcome-back
 * override and the distillation.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { MemoryExtractor, DistilledMemory } from "@caistech/elevenlabs-convai";

type AdminClient = ReturnType<typeof createAdminClient>;

/** The investor Morgan ElevenLabs agent id (provisioned, public + allowlisted). */
export const INVESTOR_MORGAN_AGENT_ID =
  process.env.NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID ?? "";

const DISTILL_MODEL = process.env.INVESTOR_ANSWER_MODEL ?? "claude-sonnet-4-6";

export type VoiceRecall = {
  hasHistory: boolean;
  lastTopic: string | null;
  timeGapCategory: "recent" | "today" | "this_week" | "older" | null;
};

const EMPTY_RECALL: VoiceRecall = {
  hasHistory: false,
  lastTopic: null,
  timeGapCategory: null,
};

/**
 * Load what Morgan should "remember" about this investor for the welcome-back
 * greeting. Degrade-don't-fake: any failure (agent not seeded, RPC error)
 * returns no-history so Morgan simply greets fresh — never a fabricated recall.
 */
export async function loadVoiceRecall(
  svc: AdminClient,
  investorId: string
): Promise<VoiceRecall> {
  if (!INVESTOR_MORGAN_AGENT_ID) return EMPTY_RECALL;
  try {
    const { data: agent } = await svc
      .from("convai_agents")
      .select("id")
      .eq("elevenlabs_agent_id", INVESTOR_MORGAN_AGENT_ID)
      .maybeSingle();
    if (!agent?.id) return EMPTY_RECALL;

    const { data, error } = await svc.rpc("get_conversation_context", {
      p_agent_id: agent.id,
      p_user_id: investorId,
    });
    if (error || !data) return EMPTY_RECALL;

    const ctx = data as {
      has_history?: boolean;
      last_topic?: string | null;
      time_gap_category?: VoiceRecall["timeGapCategory"];
    };
    if (!ctx.has_history) return EMPTY_RECALL;
    return {
      hasHistory: true,
      lastTopic: ctx.last_topic ?? null,
      timeGapCategory: ctx.time_gap_category ?? null,
    };
  } catch {
    return EMPTY_RECALL;
  }
}

/**
 * Build the per-session first-message override for a returning investor. Returns
 * null for a first-time investor (so the agent uses its provisioned default
 * greeting). The override carries the just-needed trigger (the topic), not a
 * dump of stored state — the welcome-back signal, nothing confidential.
 */
export function buildWelcomeBackMessage(recall: VoiceRecall): string | null {
  if (!recall.hasHistory) return null;
  if (recall.lastTopic) {
    return `Welcome back. Last time we were getting into ${recall.lastTopic}. Want to pick that back up, or look at something else in the dataroom today?`;
  }
  return `Welcome back. Where would you like to pick up — the same ground as last time, or something new in the dataroom?`;
}

const VALID_MEMORY_TYPES = new Set<DistilledMemory["memoryType"]>([
  "preference",
  "context",
  "goal",
  "decision",
  "followup",
  "correction",
  "insight",
]);

/**
 * Distil an investor voice call into a handful of durable memories (their thesis,
 * what they care about, concerns raised, follow-ups). Used by the post-call
 * webhook via distillConversationToMemory. Degrade-don't-fake: returns [] on any
 * failure rather than inventing memories.
 */
export function morganMemoryExtractor(): MemoryExtractor {
  return async (turns) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || turns.length === 0) return [];
    const transcript = turns
      .map((t) => `${t.role === "assistant" ? "Morgan" : "Investor"}: ${t.content}`)
      .join("\n");

    const anthropic = new Anthropic({ apiKey });
    try {
      const completion = await anthropic.messages.create({
        model: DISTILL_MODEL,
        max_tokens: 700,
        system:
          "You distil an investor's spoken conversation with Morgan (LingoPure's investor-relations voice guide) into durable memory items that would help Morgan pick up naturally next time. " +
          "Capture ONLY things worth remembering about THIS investor: their investment thesis / focus, what parts of the business they care about, concerns or objections they raised, and explicit follow-ups. " +
          "Do NOT capture LingoPure's own figures or document contents — only facts about the investor and the conversation. " +
          'Return ONLY a JSON array (no prose, no fence): [{"content": string, "memoryType": "preference"|"context"|"goal"|"decision"|"followup"|"correction"|"insight", "importance": 1-10, "tags": string[]}]. ' +
          "Return [] if nothing is worth keeping.",
        messages: [{ role: "user", content: transcript.slice(0, 12000) }],
      });
      const raw = completion.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .replace(/^```json\s*|\s*```$/g, "");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (m): m is DistilledMemory =>
            m &&
            typeof m.content === "string" &&
            m.content.trim().length > 0 &&
            VALID_MEMORY_TYPES.has(m.memoryType)
        )
        .slice(0, 8)
        .map((m) => ({
          content: m.content.trim(),
          memoryType: m.memoryType,
          importance:
            typeof m.importance === "number"
              ? Math.min(10, Math.max(1, Math.round(m.importance)))
              : 5,
          tags: Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string") : [],
        }));
    } catch {
      return [];
    }
  };
}
