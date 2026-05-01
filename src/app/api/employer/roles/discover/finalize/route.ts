/**
 * POST /api/employer/roles/discover/finalize
 *
 * Takes the chat transcript and produces a structured RoleDiscoveryProfile
 * via a separate Claude call (different system prompt — the finalizer is
 * a one-shot extractor, not a conversationalist).
 *
 * Body:    { history: ChatTurn[] }
 * Returns: { profile: RoleDiscoveryProfile }
 *
 * The next step (review-and-save) takes the profile, lets the admin
 * tweak any field, then POSTs to /api/employer/roles to actually create
 * the row.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import {
  ChatTurnSchema,
  RoleDiscoveryProfileSchema,
  ROLE_DISCOVERY_FINALIZER_PROMPT,
} from "@/lib/employer/role-discovery/schema";

const BodySchema = z.object({
  history: z.array(ChatTurnSchema).min(2).max(40),
});

const MODEL = "claude-sonnet-4-6";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  const anthropic = new Anthropic({ apiKey });

  // Render the transcript as a single user message so the finalizer
  // sees it as input data, not as part of an ongoing conversation.
  const transcriptText = body.history
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: [
        {
          type: "text",
          text: ROLE_DISCOVERY_FINALIZER_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the role-architecture interview transcript. Build the structured RoleDiscoveryProfile.\n\n${transcriptText}`,
        },
      ],
      output_config: { format: zodOutputFormat(RoleDiscoveryProfileSchema) },
    });

    const profile = response.parsed_output;
    if (!profile) {
      return NextResponse.json(
        { error: "Finalizer returned no parsed output" },
        { status: 502 }
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Finalizer call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
