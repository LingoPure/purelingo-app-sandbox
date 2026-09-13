/**
 * POST /api/employer/roles/discover
 *
 * Multi-turn role-discovery chat. The client maintains the full
 * conversation history in component state and POSTs it whole each
 * request — server is stateless, so demos and refresh-resilience are
 * cheap.
 *
 * Body: { history: ChatTurn[] }   // [] on the first request
 * Returns: { firstMessage?: string, step: ChatStep }
 *
 * On the very first call (history.length === 0) we just return the
 * canned ROLE_DISCOVERY_FIRST_MESSAGE — no LLM call. From the second
 * call onwards we ask Claude what to say next given the running
 * transcript.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructured,
} from "@/lib/llm/client";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import {
  ChatTurnSchema,
  ChatStepSchema,
  ROLE_DISCOVERY_AGENT_PROMPT,
  ROLE_DISCOVERY_FIRST_MESSAGE,
} from "@/lib/employer/role-discovery/schema";

const BodySchema = z.object({
  history: z.array(ChatTurnSchema).max(40),
});

export async function POST(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (body.history.length === 0) {
    return NextResponse.json({
      firstMessage: ROLE_DISCOVERY_FIRST_MESSAGE,
      step: {
        next_message: ROLE_DISCOVERY_FIRST_MESSAGE,
        ready_to_finalize: false,
        open_questions: [
          "Role title and main responsibility",
          "Day-to-day English use",
          "Who they communicate with",
          "Speaking/listening pressure",
          "Reading/writing demands",
          "Stakes when English breaks down",
          "Domain vocabulary",
        ],
      },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  const anthropic = anthropicClient();

  const messages = body.history.map((t) => ({
    role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: t.content,
  }));

  try {
    const step = await parseStructured(
      anthropic,
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        temperature: 0.6,
        system: [
          {
            type: "text",
            text: ROLE_DISCOVERY_AGENT_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      },
      ChatStepSchema
    );

    return NextResponse.json({ step });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
