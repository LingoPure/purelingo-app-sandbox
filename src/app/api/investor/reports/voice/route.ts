/**
 * POST /api/investor/reports/voice — Morgan, the reports discovery consultant
 * (text brain; ported from F2K's reports/voice pattern). Helps the investor pick
 * a report + sections, then emits a Zod-validated ReportSpec the form applies /
 * the run route executes. The model composes a SPEC, never queries.
 *
 * Body: { messages: {role,content}[] }
 * Returns: { reply: string, spec: ReportSpec | null }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireInvestor } from "@/lib/investor/auth";
import { ReportSpecSchema, capabilityManifestForLLM } from "@/lib/investor/report-spec";

export const runtime = "nodejs";
export const maxDuration = 30;

const DISCOVERY_MODEL = process.env.INVESTOR_ANSWER_MODEL ?? "claude-sonnet-4-6";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(40),
});

const SYSTEM = `You are Morgan, LingoPure's investor-reports consultant. An investor wants a report generated from the dataroom. Briefly help them choose the report type and its sections, then emit a spec.

${capabilityManifestForLLM()}

OUTPUT FORMAT — return ONLY a JSON object, no markdown fence, no prose outside it:
{"reply":"<your next line to the investor, plain text>","spec":null}
Keep "spec" null while clarifying. Once the investor has confirmed (or clearly stated) what they want, set "spec" to:
{"reportType":"<one of the listed types>","title":<string or null>,"topic":<string or null>,"sections":["..."],"format":"pdf"}
Default "sections" to the type's defaults unless the investor asked for specific ones. Keep "reply" short and conversational even when emitting a spec (e.g. "Generating that now.").`;

export async function POST(req: NextRequest) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The reports consultant is unavailable — use the form below." },
      { status: 503 }
    );
  }
  const anthropic = new Anthropic({ apiKey });
  const convo =
    parsed.data.messages.length === 0
      ? [{ role: "user" as const, content: "(The investor just opened the Reports page.)" }]
      : parsed.data.messages;

  try {
    const completion = await anthropic.messages.create({
      model: DISCOVERY_MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: convo,
    });
    const raw = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let reply = raw;
    let spec: unknown = null;
    try {
      const obj = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      if (obj && typeof obj === "object") {
        reply = typeof obj.reply === "string" ? obj.reply : raw;
        spec = obj.spec ?? null;
      }
    } catch {
      // not JSON — treat the whole thing as the reply
    }

    let validSpec = null;
    if (spec) {
      const s = ReportSpecSchema.safeParse(spec);
      if (s.success) validSpec = s.data;
    }

    return NextResponse.json({
      reply:
        reply ||
        "What report would you like — an investment memo, a financials brief, due-diligence on a topic…?",
      spec: validSpec,
    });
  } catch (err) {
    console.error("[investor/reports/voice]", err);
    return NextResponse.json(
      { error: "The consultant hit a snag — build your report with the form below." },
      { status: 502 }
    );
  }
}
