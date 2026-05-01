/**
 * Generates a synthetic discovery-session transcript for a seeded persona.
 *
 * The output is a transcript array structurally identical to what the
 * ConvAI webhook delivers, so it feeds straight into scoreDiscoverySession()
 * for real LLM scoring. The persona "speaks" in-character at their stated
 * proficiency band — wrong articles, hesitation markers, simpler vocabulary
 * for B1; idiomatic precision for C1; and so on.
 *
 * Two LLM calls per persona:
 *   1. Here — generate the transcript (this file)
 *   2. score-discovery.ts — score it (existing real path)
 *
 * Cost is negligible (Sonnet, ~2k tokens each call) and the result lets
 * the buyer see authentic-looking dashboard radars across the cohort.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { TranscriptTurn } from "@/lib/scoring/score-discovery";
import type { AbcPersona, AbcRole } from "./abc-personas";

const MODEL = "claude-sonnet-4-6";

const TranscriptSchema = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(["agent", "user"]),
        message: z.string().min(1).max(1200),
      })
    )
    .min(8)
    .max(18)
    .describe(
      "Realistic 8–18 turn discovery interview. Aria opens, the student answers, alternating. Cover the discovery protocol's six dimensions naturally; do NOT enumerate them."
    ),
});

const SYSTEM_PROMPT = `You are a transcript simulator for LingoPure's QA pipeline. You produce realistic discovery-session transcripts between Aria (an AI English coach) and a Vietnamese B2B student.

## Output

A JSON array of {role, message} turns. role is "agent" for Aria, "user" for the student. The conversation is in English throughout — students who'd code-switch in real life still answer in English here, just at their level.

## Aria — the agent

Aria runs a 6-dimension discovery interview to gauge English ability:
  1. Day-to-day English use (where, how often, in what mode)
  2. Hardest situation in English (the moment they last got stuck)
  3. Comfortable situations
  4. The Sarah/Mark email reading-intent test (Aria reads a 4-sentence email
     hinting that "Sarah" wants to renegotiate a Q3 commitment; the student
     interprets it)
  5. Target level + WHY they need that level
  6. Learning style preferences (session length, time of day, feedback tone)

Aria is warm, brisk, and business-focused. British / Australian-neutral accent. Asks one question at a time, listens, follows up. Never lectures.

## The student — speak as their proficiency dictates

You'll be told the persona's name, role, years of experience, target level + why, and a "personaNotes" paragraph describing their English habits and gaps. CRUCIALLY you'll be told their CURRENT proficiency band:

  - **A2** — short phrases, frequent grammar slips ("I am working there since 4 years"), narrow vocabulary, frequent reach-for of basic words ("good", "thing"), occasional Vietnamese filler ("um", "thì là"). Confident on numbers and concrete nouns. Falls apart on abstract questions.

  - **B1** — full sentences mostly, but with audible hesitation, self-correction, sentence restarts. Vocabulary functional but limited — repeated reach for "good", "interesting", "okay". Misses subtle implications. Reads literal questions accurately, struggles with implied ones.

  - **B2** — fluent for most business situations. Some L1 interference (article drops, occasional preposition slips). Catches the gist of nuanced messages but may soften them ("she wants to talk again" rather than "she wants to renegotiate"). Comfortable across the 6 dimensions but not polished.

  - **C1** — confident, precise. Idiomatic vocabulary in their domain. Catches subtext quickly. Minor errors only on rare, abstract registers. Self-aware about the few things they want to polish.

The transcript MUST sound like the persona speaks at this exact level. Don't make B1 sound like B2; don't make C1 sound like C2. The downstream scorer will read it and judge them — your job is to make that judgement accurate to the persona's stated band.

## Sarah/Mark email — required step

At some point Aria reads:

  "Hi Mark — quick one. We're tracking the Q3 numbers and I just wanted to circle back on the commitment we discussed in May. Things have shifted a bit on our side and I wanted to see whether there's still room to talk. Could you fit a 20-minute call this week?"

Then asks the student what they think Sarah is really asking for. Score the persona's interpretation against their proficiency band:
  - A2: "She wants to confirm the meeting" / "She is asking about Q3"
  - B1: "She wants another meeting" / "She wants to talk again"
  - B2: "She wants to talk again — maybe not happy with the deal"
  - C1: "She's hedging — she wants to renegotiate the Q3 commitment without saying so directly"

## Style rules

- 8–18 turns total. Don't pad.
- Aria's questions are open-ended but ONE question per turn.
- Student turns vary in length — short A2 answers (15–40 words), longer C1 answers (60–120 words).
- The transcript should naturally cover all 6 dimensions but not as a checklist — flow conversationally.
- Realistic Vietnamese English: "since" / "for" confusion at lower bands, occasional dropped articles, "thi-" not "though" at A2/B1.
- NEVER mention the rubric, scoring, or proficiency bands in the transcript. Aria doesn't know the scores; the student doesn't either.
- Output ONLY the JSON object matching the schema. No commentary.`;

export async function generatePersonaTranscript(
  persona: AbcPersona,
  role: AbcRole
): Promise<TranscriptTurn[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const anthropic = new Anthropic({ apiKey });

  const userMessage = [
    "Generate a discovery-session transcript for this persona.",
    "",
    `Name: ${persona.fullName}`,
    `Role: ${role.name} (at ABC Manufacturer)`,
    `Role description: ${role.description}`,
    `Years in role: ${persona.yearsInRole}`,
    "",
    `Persona's TARGET level (aspiration): ${persona.targetLevel}`,
    `Persona's CURRENT proficiency band: ${persona.proficiencyBand}`,
    "",
    `Why they want to improve: ${persona.targetWhy}`,
    "",
    `Persona notes (use these for vocabulary, hesitations, and quirks): ${persona.personaNotes}`,
    "",
    "Produce a realistic 10–14 turn discovery transcript between Aria and this person, in their actual current voice. They will be SCORED on this transcript by a separate model — be honest to the proficiency band.",
  ].join("\n");

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.6,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(TranscriptSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Transcript generator returned no parsed output");
  return parsed.turns.map((t) => ({ role: t.role, message: t.message }));
}
