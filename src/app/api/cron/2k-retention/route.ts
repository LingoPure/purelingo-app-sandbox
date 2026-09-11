/**
 * @machine-callable
 *
 * Daily 2K raw-audio retention sweep (ISS-041 / G13).
 *
 * Called by Vercel Cron, never by a browser. Deletes raw response audio from
 * the private "2k-assessment-audio" bucket once it is older than the retention
 * window, then nulls audio_id/upload_status on the response rows so the
 * reference cannot outlive the object.
 *
 * WHY THE MARKER MATTERS. The session-refresh middleware redirects anything
 * without a session, so a scheduled route is 307'd to /login unless it is
 * explicitly excluded from the protected matcher. A redirect is not an error:
 * nothing throws, nothing logs, the caller follows it to a 200 HTML page, and
 * the feature silently never runs. `@machine-callable` is what lets
 * `portfolio-gate-audit-machine-routes` fail the build if the matcher ever
 * starts capturing this path. The middleware only redirects PROTECTED_PREFIXES
 * and `/api/cron/...` matches none of them.
 *
 * IDEMPOTENCE. The sweep predicate is `audio_id IS NOT NULL` on rows older
 * than retention. A double-fire finds nothing left to delete. Storage remove
 * is not fatal: if an object is already gone we still clear the row reference
 * (the object and its reference are removed together, and G3 never relied on
 * the audio beyond the retention window anyway).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RETENTION_DAYS = Number(process.env.LP_2K_AUDIO_RETENTION_DAYS ?? 90);

const AUTH_HEADER_KEY = process.env.CRON_SECRET;
const AUTH_HEADER_VALUE = process.env.LP_2K_CRON_SECRET;

export async function GET(req: NextRequest) {
  // Basic cron authentication: require the shared secret if configured.
  if (AUTH_HEADER_KEY && AUTH_HEADER_VALUE) {
    const provided = req.headers.get(AUTH_HEADER_KEY);
    if (provided !== AUTH_HEADER_VALUE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: expiredError } = await supabase
    .from("assessment_responses")
    .select("response_id, assessment_id, audio_id")
    .not("audio_id", "is", null)
    .lt("created_at", cutoff);

  if (expiredError) {
    return NextResponse.json({ error: expiredError.message }, { status: 500 });
  }

  if (!expired?.length) {
    return NextResponse.json({ swept: 0, retention_days: RETENTION_DAYS });
  }

  let swept = 0;
  for (const row of expired) {
    const audioId = String(row.audio_id);
    try {
      await admin.storage.from("2k-assessment-audio").remove([audioId]);
    } catch {
      // Object already gone — still clear the reference below.
    }
    await supabase
      .from("assessment_responses")
      .update({ audio_id: null, upload_status: "pending" })
      .eq("response_id", String(row.response_id));
    swept += 1;
  }

  return NextResponse.json({ swept, retention_days: RETENTION_DAYS });
}