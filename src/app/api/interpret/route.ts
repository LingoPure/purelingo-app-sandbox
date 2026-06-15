/**
 * LCI Bridge — live interpreter (Route A: single-device, turn-based).
 *
 * POST /api/interpret   (multipart/form-data)
 *   fields:
 *     audio       File   — one spoken turn captured by the browser (webm/mp4)
 *     sourceLang  string — the language the speaker just spoke (e.g. "en", "zh")
 *     targetLang  string — the language to render it into (the other party)
 *
 * Pipeline (all three legs already proven in LingoPure prod — no new keys):
 *   1. STT       — OpenAI gpt-4o-transcribe via src/lib/transcription/whisper.ts
 *   2. Translate — Claude (Haiku), any-direction, business-conversation register
 *   3. TTS       — ElevenLabs multilingual, same call shape as battery/audio
 *
 * Returns JSON { sourceText, translatedText, audioUrl } where audioUrl is an
 * inline base64 data URI the client plays aloud. One round-trip per turn.
 *
 * Public on purpose (not under a PROTECTED_PREFIX): the validation demo must be
 * openable cold. Cost runs on LingoPure's own keys — acceptable for a founder
 * demo; gate behind auth / BYOK before any real external rollout (see TODO).
 *
 *   mic ─▶ STT(sourceLang) ─▶ translate(→targetLang) ─▶ TTS(targetLang) ─▶ play
 *
 * Every leg fails LOUD (explicit error + status), never silently — a silent
 * failure is the exact thing that embarrassed the sibling product on mobile.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { transcribeAudio } from "@/lib/transcription/whisper";

export const runtime = "nodejs";
export const maxDuration = 60;

const TRANSLATE_MODEL = "claude-haiku-4-5-20251001";
const TTS_VOICE_ID = process.env.ELEVENLABS_TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
// 21m00Tcm4TlvDq8ikWAM = "Rachel" — renders both English and Mandarin acceptably
// under the multilingual model. Override via ELEVENLABS_TTS_VOICE_ID.

// Human-readable names so the translator prompt is unambiguous about direction.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Mandarin Chinese (Simplified)",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  th: "Thai",
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

/**
 * Translate one conversational turn, any direction, preserving the register a
 * live business interpreter would use. Returns the translated text only.
 * Throws on failure so the route surfaces a visible error (no silent English
 * pass-through — in an interpreter, a missing translation is the failure).
 */
async function translateTurn(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (sourceLang === targetLang) return text;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const anthropic = new Anthropic({ apiKey });

  const system = `You are a live business interpreter rendering one spoken turn
from ${languageName(sourceLang)} into ${languageName(targetLang)}.

Rules:
- Output ONLY the translation in ${languageName(targetLang)}. No preamble, no
  quotes, no notes, no romanisation — just the spoken line as the other party
  should hear it.
- Match a professional business-meeting register: natural, courteous, clear.
  Not stiff officialese, not slang.
- Preserve numbers, dates, quantities, company and product names exactly.
- If the input is already in ${languageName(targetLang)} or is empty, return it
  unchanged.`;

  const r = await anthropic.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: 1000,
    temperature: 0,
    system,
    messages: [{ role: "user", content: text }],
  });

  const block = r.content.find((b) => b.type === "text");
  const out = block && block.type === "text" ? block.text.trim() : "";
  if (!out) throw new Error("Translator returned empty output");
  return out;
}

/**
 * Synthesize speech for the translated turn. Multilingual model so Mandarin (and
 * other non-English targets) pronounce correctly. Returns a base64 data URI.
 */
async function synthesize(text: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(TTS_VOICE_ID)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        // multilingual_v2 handles English + Mandarin in one voice; flash/turbo
        // English-only models mangle Chinese.
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`ElevenLabs TTS ${upstream.status}: ${detail.slice(0, 200)}`);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const sourceLang = ((form.get("sourceLang") as string) || "en").trim();
    const targetLang = ((form.get("targetLang") as string) || "zh").trim();

    if (!audio || audio.size === 0) {
      return NextResponse.json(
        { error: "No audio captured. Hold the button while you speak." },
        { status: 400 }
      );
    }

    // 1. Speech to text in the speaker's language.
    let sourceText: string;
    try {
      sourceText = (await transcribeAudio(audio, sourceLang)).trim();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[interpret] STT failed: ${detail}`);
      return NextResponse.json(
        { error: `Could not transcribe audio: ${detail}` },
        { status: 502 }
      );
    }

    if (!sourceText) {
      return NextResponse.json(
        { error: "Didn't catch any speech — try again, a little closer to the mic." },
        { status: 422 }
      );
    }

    // 2. Translate the turn into the other party's language.
    let translatedText: string;
    try {
      translatedText = await translateTurn(sourceText, sourceLang, targetLang);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[interpret] translate failed: ${detail}`);
      return NextResponse.json(
        { sourceText, error: `Translation failed: ${detail}` },
        { status: 502 }
      );
    }

    // 3. Speak the translation aloud.
    let audioUrl: string;
    try {
      audioUrl = await synthesize(translatedText);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[interpret] TTS failed: ${detail}`);
      // Text still succeeded — return it so the UI can show the translation
      // even if the voice leg failed. Degrade, don't fake.
      return NextResponse.json(
        { sourceText, translatedText, error: `Voice unavailable: ${detail}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ sourceText, translatedText, audioUrl });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[interpret] unexpected: ${detail}`);
    return NextResponse.json({ error: `Interpreter error: ${detail}` }, { status: 500 });
  }
}
