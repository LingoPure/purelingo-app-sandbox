/**
 * Public, non-auth narration for the 30-second sandbox-flow preview
 * (/demo and the homepage #preview section).
 *
 * GET /api/demo/narration?clip=intro|outro
 *
 * Deliberately NOT authenticated — the preview lives on marketing surfaces
 * a visitor sees before signing up. That's safe here only because the
 * route serves exactly two FIXED, server-defined lines (never client-
 * supplied text) — an unauthenticated endpoint that spoke arbitrary text
 * would be an open TTS proxy, uncovered cost exposure on every anonymous
 * hit (MONETISATION_RULES R10/R12).
 *
 * Narrated in Aria's voice for brand continuity with the real discovery
 * agent (src/lib/onboarding/aria-discovery-config.ts), but this is one-shot
 * TTS playback, not a live ConvAI session — no microphone, no conversation,
 * no recording of the visitor — so the ElevenLabs voice/recording-consent
 * surface (REGULATORY_INCLUSIONS I3) does not apply.
 */

import { NextRequest, NextResponse } from "next/server";

const ARIA_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // must match aria-discovery-config.ts's persona.voiceId
const FREE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // free-plan-eligible fallback ("Rachel")

const CLIPS = {
  intro:
    "Hi, I'm Aria. In about thirty seconds, I'll show you exactly how LingoPure works — sign up, talk with me, see your skill profile, and get your plan.",
  outro:
    "That's the whole flow. Now click Start Free Assessment to try the whole thing out for yourself!",
} as const;

type Clip = keyof typeof CLIPS;

function isClip(value: string | null): value is Clip {
  return value === "intro" || value === "outro";
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const clipParam = new URL(request.url).searchParams.get("clip");
  if (!isClip(clipParam)) {
    return NextResponse.json(
      { error: "clip must be 'intro' or 'outro'" },
      { status: 400 }
    );
  }
  const text = CLIPS[clipParam];

  // Same free-plan retry as /api/onboarding/battery/audio: a library voice
  // 402s on the free plan, so fall back to a free-eligible voice rather
  // than leave the preview silent.
  const voiceCandidates = [ARIA_VOICE_ID, FREE_VOICE_ID].filter(
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
            text,
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
      if (voiceId !== FREE_VOICE_ID) {
        console.error(
          `[demo/narration] 402 paid_plan_required on voice ${voiceId} — retrying with free voice`
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
    console.error(`[demo/narration] TTS upstream unreachable: ${detail}`);
    return NextResponse.json(
      { error: `TTS upstream unreachable: ${detail}` },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error(
      `[demo/narration] ElevenLabs ${upstream.status}: ${errText.slice(0, 300)}`
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
      // Fixed text per clip — these bytes don't change until the copy
      // above is redeployed, so cache hard rather than re-spend TTS
      // credits on every anonymous visitor.
      "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}
