/**
 * The LingoPure investor dataroom, wired onto @caistech/dataroom-core.
 *
 * This is the single composition point: it injects LingoPure's LLM (Anthropic)
 * and retriever (./retrieval), plus the product prompts + report title strategy,
 * into the shared engine. answer.ts / build-report.ts are thin adapters over the
 * `dataroom` instance exported here.
 */

import { anthropicClient } from "@/lib/llm/client";
import { createDataroom, type ChatFn } from "@caistech/dataroom-core";
import { retrieve } from "@/lib/investor/retrieval";
import {
  ASK_SYSTEM_PROMPT,
  NO_ANSWER,
  SECTION_SYSTEM,
  NOT_COVERED,
} from "@/lib/investor/ask-prompt";
import { defaultTitleFor } from "@/lib/investor/report-spec";

const ANSWER_MODEL = process.env.INVESTOR_ANSWER_MODEL ?? "claude-sonnet-4-6";

/** Inject Anthropic as the engine's ChatFn (returns the assistant text, or ""). */
const chat: ChatFn = async ({ system, user, model, maxTokens }) => {
  const anthropic = anthropicClient();
  const r = await anthropic.messages.create({
    model: model ?? ANSWER_MODEL,
    max_tokens: maxTokens ?? 1500,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = r.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
};

export const dataroom = createDataroom({
  chat,
  retrieve,
  answer: {
    systemPrompt: ASK_SYSTEM_PROMPT,
    noAnswerText: NO_ANSWER,
    model: ANSWER_MODEL,
    matchCount: 12,
  },
  report: {
    sectionSystemPrompt: SECTION_SYSTEM,
    notCoveredText: NOT_COVERED,
    titleFor: defaultTitleFor,
    model: ANSWER_MODEL,
    matchCount: 8,
  },
});
