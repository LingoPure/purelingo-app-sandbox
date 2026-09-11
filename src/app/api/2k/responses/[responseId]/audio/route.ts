/**
 * POST /api/2k/responses/{responseId}/audio — canonical endpoint #4 (ISS-016).
 *
 * Multipart upload of the raw response audio. Computes a SHA-256 checksum,
 * writes the object into the private "2k-assessment-audio" bucket via the
 * service role, then registers audio_id + upload_status on the response row
 * (learner-scoped client respects RLS ownership).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadResponseAudio, AssessmentServiceError } from "@/lib/2k/service";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB per response
const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
]);

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

    return NextResponse.json({
      audio_id: registered.audio_id,
      storage_path: registered.storage_path,
      checksum: registered.checksum,
    });
  } catch (err) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}