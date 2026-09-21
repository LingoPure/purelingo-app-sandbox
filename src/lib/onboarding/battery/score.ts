/**
 * Phase 0b assessment-battery scoring.
 *
 * Per-task scoring entry point. Each task type maps to one of the six
 * gap_scores skills via TASK_SKILL (see types.ts §spec-§8).
 *
 *   email_writing      → Claude rubric scorer  → writing
 *   listen_paraphrase  → Claude rubric scorer  → listening
 *   read_summarise     → Claude rubric scorer  → reading
 *   vocab_cloze        → deterministic         → business_vocabulary
 *
 * Outputs a uniform { score 0-1000, cefr_band, evidence } shape that
 * matches the existing voice scorer in src/lib/scoring/score-discovery.ts.
 *
 * The scorer is invoked from POST /api/onboarding/battery/submit via
 * Next.js `after()`, so it runs after the HTTP response has flushed and
 * is not bound by the request's body-streaming lifetime.
 */

import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructured,
} from "@/lib/llm/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CEFR_BANDS, type CefrBand } from "@/lib/scoring/rubric";
import {
  parseTaskPromptPrivate,
  parseTaskPromptPublic,
  parseTaskResponse,
  type TaskType,
} from "./types";

const SCORING_MODEL_TAG = `${ANTHROPIC_MODEL}:battery:v1`;

export type BatteryScoreOutput = {
  score: number;
  cefr_band: CefrBand;
  evidence: string;
  scoring_model: string;
};

const RubricOutputSchema = z.object({
  score: z.number().int().min(0).max(1000),
  cefr_band: z.enum(CEFR_BANDS),
  evidence: z
    .string()
    .min(1)
    .max(2000)
    .transform((s) => s.slice(0, 600)),
});

function client() {
  return anthropicClient();
}

const SCALE_PROMPT = `LingoPure scale: 0-1000 mapped to CEFR.
  0-199 A1, 200-399 A2, 400-599 B1, 600-799 B2, 800-899 C1, 900-1000 C2.
  Treat 800 as the LingoPure target floor. Be conservative: when between
  two adjacent bands, pick the lower one. Use fine-grained numbers (e.g.
  647, 712, 858) — do not snap to round multiples of 50.
  Quote the student's actual words in the evidence field.`;

// ─── email_writing ───────────────────────────────────────────────────────────

async function scoreEmailWriting(
  promptPublic: ReturnType<typeof parseTaskPromptPublic>,
  promptPrivate: ReturnType<typeof parseTaskPromptPrivate>,
  response: ReturnType<typeof parseTaskResponse>
): Promise<BatteryScoreOutput> {
  if (promptPublic.task_type !== "email_writing") {
    throw new Error("scoreEmailWriting called with wrong task_type");
  }
  if (promptPrivate.task_type !== "email_writing") {
    throw new Error("scoreEmailWriting called with wrong private task_type");
  }
  if (response.task_type !== "email_writing") {
    throw new Error("scoreEmailWriting called with wrong response task_type");
  }

  const system = `You are LingoPure's email-writing scorer. Score the student's
business email response against the rubric anchors below. Output ONLY a
JSON object matching the provided schema.

${SCALE_PROMPT}

Score against four dimensions, weighted equally:
- register_tone
- structural_integrity
- strategic_content
- lexical_range

A composite 0-1000 score reflects the average across these dimensions.

The evidence field MUST quote a specific phrase from the student's email
that drove your score (positive or negative). Format: "Quoted phrase. → why
it shifted the score."`;

  const user = JSON.stringify({
    scenario: promptPublic.data.scenario,
    persona: promptPublic.data.persona,
    rubric_anchors: promptPrivate.data.rubric_anchors,
    student_response: response.data.text,
    metadata: {
      word_count: response.data.word_count,
      paste_count: response.data.paste_count,
      total_keystrokes: response.data.total_keystrokes,
      total_seconds: response.data.total_seconds,
    },
  });

  const parsed = await parseStructured(
    client(),
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      temperature: 0,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    },
    RubricOutputSchema
  );
  return { ...parsed, scoring_model: SCORING_MODEL_TAG };
}

// ─── listen_paraphrase ───────────────────────────────────────────────────────

async function scoreListenParaphrase(
  promptPublic: ReturnType<typeof parseTaskPromptPublic>,
  promptPrivate: ReturnType<typeof parseTaskPromptPrivate>,
  response: ReturnType<typeof parseTaskResponse>
): Promise<BatteryScoreOutput> {
  if (
    promptPublic.task_type !== "listen_paraphrase" ||
    promptPrivate.task_type !== "listen_paraphrase" ||
    response.task_type !== "listen_paraphrase"
  ) {
    throw new Error("scoreListenParaphrase task_type mismatch");
  }

  const system = `You are LingoPure's listening-comprehension scorer. The
student listened to a short voicemail (transcript provided) and typed the
key points they remembered, in their own words. Output ONLY JSON matching
the schema.

${SCALE_PROMPT}

Score against three dimensions, equally weighted:
- recall_accuracy: did they capture the key points the clip actually made?
- inference: did they understand implications (e.g. "8% under spec" as a
  quality issue, not just words), or repeat surface phrasing?
- action_items: did they pick up the explicit ask and any deadline?

Penalise if the student used more plays than the clip allowed.

Evidence field MUST contrast which point they nailed vs which they
missed/garbled. Format: "Got: <X>. Missed: <Y>."`;

  const user = JSON.stringify({
    transcript: promptPrivate.data.transcript,
    expected_key_points: promptPrivate.data.key_points,
    plays_allowed: promptPublic.data.plays_allowed,
    student_response: {
      points: response.data.points,
      plays_used: response.data.plays_used,
    },
  });

  const parsed = await parseStructured(
    client(),
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      temperature: 0,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    },
    RubricOutputSchema
  );
  return { ...parsed, scoring_model: SCORING_MODEL_TAG };
}

// ─── read_summarise ──────────────────────────────────────────────────────────

async function scoreReadSummarise(
  promptPublic: ReturnType<typeof parseTaskPromptPublic>,
  promptPrivate: ReturnType<typeof parseTaskPromptPrivate>,
  response: ReturnType<typeof parseTaskResponse>
): Promise<BatteryScoreOutput> {
  if (
    promptPublic.task_type !== "read_summarise" ||
    promptPrivate.task_type !== "read_summarise" ||
    response.task_type !== "read_summarise"
  ) {
    throw new Error("scoreReadSummarise task_type mismatch");
  }

  const system = `You are LingoPure's reading-comprehension scorer. The
student read a business email/memo and wrote a 3-4 sentence summary.
Output ONLY JSON matching the schema.

${SCALE_PROMPT}

The reading task tests whether the student can spot SUBTEXT, not just the
literal ask. Score against three dimensions, equally weighted:
- surface_comprehension: did they capture the explicit, literal ask?
- subtext_identification: did they spot the buried question / risk /
  political dimension that the indirect language is masking?
- concision: did they SUMMARISE in their own words, or just paraphrase
  long passages? A 3-4 sentence summary that quotes the original verbatim
  is a low score.

Evidence field MUST quote the moment in the student's summary that
revealed (or missed) the subtext.`;

  const user = JSON.stringify({
    body: promptPublic.data.body,
    surface_ask: promptPrivate.data.surface_ask,
    subtext: promptPrivate.data.subtext,
    expected_summary_outline: promptPrivate.data.expected_summary_outline,
    student_summary: response.data.summary,
  });

  const parsed = await parseStructured(
    client(),
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      temperature: 0,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    },
    RubricOutputSchema
  );
  return { ...parsed, scoring_model: SCORING_MODEL_TAG };
}

// ─── vocab_cloze (deterministic) ─────────────────────────────────────────────

function scoreVocabCloze(
  promptPublic: ReturnType<typeof parseTaskPromptPublic>,
  promptPrivate: ReturnType<typeof parseTaskPromptPrivate>,
  response: ReturnType<typeof parseTaskResponse>
): BatteryScoreOutput {
  if (
    promptPublic.task_type !== "vocab_cloze" ||
    promptPrivate.task_type !== "vocab_cloze" ||
    response.task_type !== "vocab_cloze"
  ) {
    throw new Error("scoreVocabCloze task_type mismatch");
  }

  const correctById = new Map(
    promptPrivate.data.items.map((i) => [i.id, i])
  );
  let weightedTotal = 0;
  let weightedSum = 0;
  let correctCount = 0;
  const wrongDetails: string[] = [];

  for (const ans of response.data.answers) {
    const item = correctById.get(ans.item_id);
    if (!item) continue;
    weightedTotal += item.difficulty_weight;
    if (ans.selected === item.correct) {
      weightedSum += item.difficulty_weight;
      correctCount += 1;
    } else {
      wrongDetails.push(
        `${ans.item_id}: chose "${ans.selected}", correct "${item.correct}"`
      );
    }
  }

  // Map weighted accuracy to 0-1000. 100% correct on B2 items lands at
  // 850 (low C1) — students who ace a B2 vocab set are showing C1+ vocab
  // command. 60% lands ~600 (mid B2). 0% → 0.
  const accuracy = weightedTotal > 0 ? weightedSum / weightedTotal : 0;
  const score = Math.round(accuracy * 850);
  const cefr_band: CefrBand =
    score >= 900
      ? "C2"
      : score >= 800
        ? "C1"
        : score >= 600
          ? "B2"
          : score >= 400
            ? "B1"
            : score >= 200
              ? "A2"
              : "A1";
  const total = response.data.answers.length;
  const evidence =
    wrongDetails.length === 0
      ? `All ${total} items correct.`
      : `${correctCount}/${total} correct. Misses: ${wrongDetails.slice(0, 3).join("; ")}${
          wrongDetails.length > 3 ? "; …" : ""
        }`;

  return {
    score,
    cefr_band,
    evidence: evidence.slice(0, 600),
    scoring_model: "deterministic:battery:v1",
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Pull the prompt halves + response, dispatch to the right scorer, write
 * score / cefr / evidence / scored_at back onto the task_response row.
 *
 * Caller passes a service-role supabase client — RLS protects
 * prompt_private from regular auth tokens, so the scorer cannot run with
 * a user-scoped client.
 */
export async function scoreTaskResponse(
  supabase: SupabaseClient,
  responseId: string
): Promise<{ skill: TaskType; out: BatteryScoreOutput }> {
  const { data: respRow, error: respErr } = await supabase
    .from("discovery_task_responses")
    .select("id, task_type, task_prompt_id, response_json")
    .eq("id", responseId)
    .maybeSingle();
  if (respErr) throw new Error(`task_response load failed: ${respErr.message}`);
  if (!respRow) throw new Error(`task_response ${responseId} not found`);

  const taskType = respRow.task_type as TaskType;

  const { data: promptRow, error: promptErr } = await supabase
    .from("discovery_task_prompts")
    .select("id, task_type, prompt_public, prompt_private")
    .eq("id", respRow.task_prompt_id)
    .maybeSingle();
  if (promptErr) throw new Error(`prompt load failed: ${promptErr.message}`);
  if (!promptRow) throw new Error(`prompt ${respRow.task_prompt_id} not found`);

  const promptPublic = parseTaskPromptPublic(taskType, promptRow.prompt_public);
  const promptPrivate = parseTaskPromptPrivate(taskType, promptRow.prompt_private);
  const response = parseTaskResponse(taskType, respRow.response_json);

  let out: BatteryScoreOutput;
  switch (taskType) {
    case "email_writing":
      out = await scoreEmailWriting(promptPublic, promptPrivate, response);
      break;
    case "listen_paraphrase":
      out = await scoreListenParaphrase(promptPublic, promptPrivate, response);
      break;
    case "read_summarise":
      out = await scoreReadSummarise(promptPublic, promptPrivate, response);
      break;
    case "vocab_cloze":
      out = scoreVocabCloze(promptPublic, promptPrivate, response);
      break;
  }

  const { error: updateErr } = await supabase
    .from("discovery_task_responses")
    .update({
      score: out.score,
      cefr_band: out.cefr_band,
      evidence: out.evidence,
      scoring_model: out.scoring_model,
      scored_at: new Date().toISOString(),
    })
    .eq("id", responseId);
  if (updateErr) {
    throw new Error(`task_response score update failed: ${updateErr.message}`);
  }

  return { skill: taskType, out };
}
