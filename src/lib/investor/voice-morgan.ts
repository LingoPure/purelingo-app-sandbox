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

import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "@/lib/llm/client";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { MemoryExtractor, DistilledMemory } from "@caistech/elevenlabs-convai";
import { MORGAN_SYSTEM_PROMPT } from "./morgan-prompt.mjs";

type AdminClient = ReturnType<typeof createAdminClient>;

/** The investor Morgan ElevenLabs agent id (provisioned, public + allowlisted). */
export const INVESTOR_MORGAN_AGENT_ID =
  process.env.NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID ?? "";

const DISTILL_MODEL = process.env.INVESTOR_ANSWER_MODEL ?? "claude-sonnet-4-6";

/** A distilled memory item as the get_conversation_context RPC returns it. */
export type RecalledMemory = {
  type: DistilledMemory["memoryType"];
  content: string;
  importance: number;
};

export type VoiceRecall = {
  hasHistory: boolean;
  lastTopic: string | null;
  timeGapCategory: "recent" | "today" | "this_week" | "older" | null;
  /** Top distilled memories about THIS investor (thesis, concerns, follow-ups). */
  memories: RecalledMemory[];
};

const EMPTY_RECALL: VoiceRecall = {
  hasHistory: false,
  lastTopic: null,
  timeGapCategory: null,
  memories: [],
};

/**
 * Load what Morgan should "remember" about this investor. The RPC already
 * returns the top distilled memories (by importance) — we surface them here so
 * a returning investor's thesis / concerns / follow-ups reach the session, not
 * just the last topic. Degrade-don't-fake: any failure (agent not seeded, RPC
 * error) returns no-history so Morgan simply greets fresh — never fabricated.
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
      memories?: Array<{ type?: string; content?: unknown; importance?: unknown }>;
    };
    if (!ctx.has_history) return EMPTY_RECALL;

    const memories: RecalledMemory[] = (ctx.memories ?? [])
      .filter((m): m is { type: string; content: string; importance?: unknown } =>
        typeof m?.content === "string" && m.content.trim().length > 0
      )
      .map((m) => ({
        type: m.type as RecalledMemory["type"],
        content: m.content.trim(),
        importance:
          typeof m.importance === "number"
            ? Math.min(10, Math.max(1, Math.round(m.importance)))
            : 5,
      }));

    return {
      hasHistory: true,
      lastTopic: ctx.last_topic ?? null,
      timeGapCategory: ctx.time_gap_category ?? null,
      memories,
    };
  } catch {
    return EMPTY_RECALL;
  }
}

/**
 * Build the per-session first-message override for a returning investor. Returns
 * null for a first-time investor (so the agent uses its provisioned default
 * greeting). Prefers a remembered focus (their thesis/interest) over the raw
 * last topic, so the opener sounds like she actually knows them — but stays a
 * light nudge, never a recitation of stored facts.
 */
export function buildWelcomeBackMessage(recall: VoiceRecall): string | null {
  if (!recall.hasHistory) return null;
  // The single most important thing we remember about their focus, if any.
  const focus = topFocusMemory(recall.memories);
  if (focus) {
    return `Welcome back. Last time you were focused on ${focus}. Want to pick that back up, or look at something else in the dataroom today?`;
  }
  if (recall.lastTopic) {
    return `Welcome back. Last time we were getting into ${recall.lastTopic}. Want to pick that back up, or look at something else in the dataroom today?`;
  }
  return `Welcome back. Where would you like to pick up — the same ground as last time, or something new in the dataroom?`;
}

/** Memory types that describe what an investor is FOCUSED on (for the opener). */
const FOCUS_TYPES = new Set<RecalledMemory["type"]>([
  "goal",
  "context",
  "preference",
  "followup",
]);

/** The highest-importance "focus" memory, lightly trimmed for a spoken opener. */
function topFocusMemory(memories: RecalledMemory[]): string | null {
  const focus = memories
    .filter((m) => FOCUS_TYPES.has(m.type))
    .sort((a, b) => b.importance - a.importance)[0];
  if (!focus) return null;
  const c = focus.content.replace(/\s+/g, " ").trim();
  // Lower-case the lead so it reads inside "…focused on {focus}."
  const lead = c.charAt(0).toLowerCase() + c.slice(1);
  return lead.length > 120 ? `${lead.slice(0, 117)}…` : lead;
}

/**
 * Compose the per-session SYSTEM-PROMPT override for a returning investor:
 * Morgan's canonical base persona PLUS a compact block of what she remembers
 * about THIS investor, so she can pick up naturally mid-call — not just in the
 * opener. Returns null for a first-timer or when there's nothing worth
 * recalling, so we leave the provisioned base prompt untouched.
 *
 * This is a server-trusted PUSH (the memories are the investor's OWN distilled
 * rows, read via the service role and keyed to their server-bound identity), a
 * proportionate choice for a transient clarifier: the widget exposes no
 * arbitrary dynamic-variable channel for the agent to PULL through, and Morgan
 * holds no tier-gated data. The block deliberately carries only facts ABOUT the
 * investor — never LingoPure's confidential figures (the extractor already
 * excludes those on the way in).
 */
export function buildMorganSessionPrompt(recall: VoiceRecall): string | null {
  if (!recall.hasHistory || recall.memories.length === 0) return null;

  const lines = recall.memories
    .slice(0, 8)
    .map((m) => `- (${m.type}) ${m.content}`)
    .join("\n");

  return `${MORGAN_SYSTEM_PROMPT}

---
RETURNING INVESTOR — you have spoken with this investor before. Below is what you remember about THEM (their focus, concerns, and follow-ups). Use it to pick up naturally and show you remember them; weave it in conversationally. Do NOT read this list aloud or recite it as facts, and it does not change the confidentiality rules above — still defer every specific figure to the cited written answer.

What you remember about this investor:
${lines}`;
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

    const anthropic = anthropicClient();
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
