/**
 * The Q&A core — thin adapter over @caistech/dataroom-core. Retrieval + the
 * cited-answer orchestration live in the engine; LingoPure supplies the LLM,
 * retriever, and prompts via ./dataroom. Signature preserved for the routes.
 */

import { dataroom } from "@/lib/investor/dataroom";
import type { Tier } from "@/lib/investor/auth";
import type { AnswerResult, Citation } from "@caistech/dataroom-core";

export type { AnswerResult, Citation };

export function answerQuestion(
  question: string,
  allowedTiers: Tier[]
): Promise<AnswerResult> {
  return dataroom.answerQuestion(question, allowedTiers);
}
