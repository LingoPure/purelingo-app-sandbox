/**
 * GET /api/2k/responses/{responseId}/audio — secured raw-audio access (ISS-041 / G13).
 *
 * Issues a short-lived signed URL ONLY to the learner who owns the assessment.
 * Denied attempts are logged to the processing-event ledger (G13: denied and
 * logged).  Signed URL expiry is the retention control for raw media access.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadResponseAudio, AssessmentServiceError } from "@/lib/2k/service";

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB per response
const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
]);

/**
 * POST /api/2k/responses/{responseId}/audio — canonical endpoint #4 (ISS-016).
 *
 * Multipart upload of the raw response audio. Computes a SHA-256 checksum,
 * writes the object into the private "2k-assessment-audio" bucket via the
 * service role, then registers audio_id + upload_status on the response row
 * (learner-scoped client respects RLS ownership).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ responseId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { responseId } = await ctx.params;
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported content type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 });
    }

    const duration_ms = Number(form?.get("duration_ms") ?? 0);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const registered = await uploadResponseAudio(supabase, user, responseId, bytes, {
      content_type: file.type,
      duration_ms,
      size_bytes: file.size,
    });
    return NextResponse.json(registered, { status: 201 });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ responseId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { responseId } = await ctx.params;

  const { data: response, error: responseError } = await supabase
    .from("assessment_responses")
    .select("response_id, assessment_id, audio_id")
    .eq("response_id", responseId)
    .single();
  if (responseError || !response) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("assessment_id, learner_id")
    .eq("assessment_id", String(response.assessment_id))
    .single();
  if (sessionError || !session || session.learner_id !== user.id || !response.audio_id) {
    // Unauthorized: log the denial and refuse.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.from("assessment_processing_events").insert({
      assessment_id: String(response.assessment_id),
      from_status: null,
      to_status: null,
      action: "audio_access_denied",
      detail: { response_id: responseId, reason: session?.learner_id !== user.id ? "not_owner" : "no_audio" },
      terminal: false,
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: signedUrl, error: signedError } = await admin.storage
    .from("2k-assessment-audio")
    .createSignedUrl(String(response.audio_id), SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signedUrl?.signedUrl) {
    return NextResponse.json({ error: "Media could not be signed" }, { status: 500 });
  }

  await admin.from("assessment_processing_events").insert({
    assessment_id: String(response.assessment_id),
    from_status: null,
    to_status: null,
    action: "audio_access_granted",
    detail: { response_id: responseId, expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS },
    terminal: false,
  });

  return NextResponse.json({ signedUrl: signedUrl.signedUrl, expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS });
}