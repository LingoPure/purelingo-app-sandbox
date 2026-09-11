/**
 * POST /api/2k/responses/{responseId}/transcribe — ISS-017.
 *
 * Pulls the registered audio from the private 2k-assessment-audio bucket via a
 * service-role signed URL, transcribes with the existing whisper helper, and
 * persists the transcript back onto the response row (+ processing event).
 *
 * This is the manual trigger the pipeline worker will call per-response; it is
 * idempotent-safe (re-transcribing overwrites client_transcript and appends a
 * fresh processing event).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeResponse, AssessmentServiceError } from "@/lib/2k/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ responseId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { responseId } = await ctx.params;
  try {
    const body = await req.json().catch(() => null);
    const language = typeof body?.language === "string" ? body.language : "en";
    const result = await transcribeResponse(supabase, user, responseId, language);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}