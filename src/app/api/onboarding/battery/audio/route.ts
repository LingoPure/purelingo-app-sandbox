/**
 * Phase 0b — listen_paraphrase audio stream.
 *
 * GET /api/onboarding/battery/audio?prompt_id=<uuid>
 *
 *   1. Verify the user is signed in (any signed-in student can stream
 *      audio for any listen_paraphrase prompt — the value is in the
 *      transcript, which is service-role-only via prompt_private).
 *   2. Fetch the prompt's prompt_private.transcript via service role.
 *   3. Pipe the transcript through ElevenLabs TTS (uses ELEVENLABS_API_KEY
 *      which is already configured for the discovery agent's tokens).
 *   4. Stream MP3 back. Cache aggressively (24h s-maxage) — the prompt
 *      content is stable; we don't want to re-spend TTS credits on every
 *      page reload.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { parseTaskPromptPrivate } from "@/lib/onboarding/battery/types";

const TTS_VOICE_ID = process.env.ELEVENLABS_TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
// 21m00Tcm4TlvDq8ikWAM = "Rachel" — ElevenLabs' default native English voice.
// Override via ELEVENLABS_TTS_VOICE_ID for a UK accent or role-specific
// voice (the listen_paraphrase task wants "regional ops director", so any
// natural mid-Atlantic / Australian voice fits).

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const userClient = await createUserClient();
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const promptId = new URL(request.url).searchParams.get("prompt_id");
  if (!promptId) {
    return NextResponse.json({ error: "prompt_id required" }, { status: 400 });
  }

  const admin = adminSupabase();
  const { data: row, error: rowErr } = await admin
    .from("discovery_task_prompts")
    .select("task_type, prompt_private")
    .eq("id", promptId)
    .maybeSingle();
  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row || row.task_type !== "listen_paraphrase") {
    return NextResponse.json(
      { error: "Prompt not found or not a listen_paraphrase prompt" },
      { status: 404 }
    );
  }

  let transcript: string;
  try {
    const parsed = parseTaskPromptPrivate("listen_paraphrase", row.prompt_private);
    if (parsed.task_type !== "listen_paraphrase") {
      throw new Error("private prompt task_type mismatch");
    }
    transcript = parsed.data.transcript;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Prompt private payload invalid: ${detail}` },
      { status: 500 }
    );
  }

  // Rachel (21m00Tcm4TlvDq8ikWAM) is a free-plan-eligible default voice.
  // If ELEVENLABS_TTS_VOICE_ID points at a library voice, the free plan
  // rejects it with 402 paid_plan_required — retry once with Rachel so
  // Listen & Paraphrase always has audio.
  const FREE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
  const voiceCandidates = [TTS_VOICE_ID, FREE_VOICE_ID].filter(
    (voiceId, index, all) => voiceId && all.indexOf(voiceId) === index
  );

  let upstream: Response | null = null;
  let upstreamError: Error | string | null = null;
  for (const voiceId of voiceCandidates) {
    try {
      const attempt = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "content-type": "application/json",
            accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: transcript,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.75,
              style: 0.2,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (attempt.status !== 402) {
        upstream = attempt;
        break;
      }
      const forcedPlan = await attempt.text().catch(() => "").then((t) =>
        t.includes("paid_plan_required")
      );
      if (forcedPlan && voiceId !== FREE_VOICE_ID) {
        console.error(
          `[battery/audio] 402 paid_plan_required on voice ${voiceId} — retrying with free voice`
        );
        continue;
      }
      upstream = attempt;
      break;
    } catch (err) {
      upstreamError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!upstream) {
    const detail = upstreamError ?? "TTS upstream failed";
    console.error(`[battery/audio] TTS upstream failed: ${detail}`);
    return NextResponse.json(
      { error: `TTS upstream unreachable: ${detail}` },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    console.error(
      `[battery/audio] ElevenLabs ${upstream.status}: ${text.slice(0, 300)}`
    );
    return NextResponse.json(
      { error: `TTS returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      // Cache at the edge for a day, in the browser for the same. The
      // transcript is stable per prompt_id; re-paying ElevenLabs on every
      // reload would burn credits for no signal.
      "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}
