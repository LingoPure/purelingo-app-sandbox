/**
 * POST /api/investor/ask  — investor Q&A over the dataroom (Phase 2).
 *
 * Flow: authenticate the investor → derive allowed tiers from their server-side
 * max_tier (the NDA gate; never from the client) → tier-filtered retrieve +
 * Claude answer with citations → audit (ask + answer) → return.
 *
 * Body:  { question: string }
 * Returns: { answer: string, citations: {documentId, displayName, page}[] }
 *
 * Confidentiality: the corpus is contracts / cap table / board materials, so
 * every question and answer is audited with the investor id, and failures are
 * surfaced loud (never a silent fake answer).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor, allowedTiersFor } from "@/lib/investor/auth";
import { answerQuestion } from "@/lib/investor/answer";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;

  let question: string;
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json(
      { error: "Question too long (max 2000 characters)." },
      { status: 400 }
    );
  }

  const allowedTiers = allowedTiersFor(investor.maxTier);
  const svc = createAdminClient();

  try {
    const result = await answerQuestion(question, allowedTiers);

    // Audit — confidentiality-critical, never silent.
    await svc.from("dataroom_audit").insert([
      { investor_id: investor.id, action: "ask", detail: { question } },
      {
        investor_id: investor.id,
        action: "answer",
        detail: {
          question,
          tiers: allowedTiers,
          citations: result.citations.map((c) => c.documentId),
        },
      },
    ]);

    return NextResponse.json({ answer: result.answer, citations: result.citations });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[investor/ask] failed: ${detail}`);
    // Best-effort failure audit (don't let an audit error mask the original).
    await svc
      .from("dataroom_audit")
      .insert({ investor_id: investor.id, action: "ask", detail: { question, error: detail } })
      .then(
        () => {},
        () => {}
      );
    return NextResponse.json({ error: `Could not answer: ${detail}` }, { status: 502 });
  }
}
