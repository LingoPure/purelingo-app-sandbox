/**
 * Audio → text via OpenAI gpt-4o-transcribe.
 *
 * Used for ClassIn session recordings (briefing §07.2 step 6). Caller is
 * responsible for ensuring the input fits OpenAI's 25 MB upload cap; for
 * longer recordings, slice and stitch upstream of this helper.
 *
 * Returns plain text (no diarisation). The session rubric (session-rubric.ts)
 * is calibrated to handle the messy unlabelled output Whisper-class models
 * produce — see the rubric's TRANSCRIPT FORMAT section.
 */

import OpenAI from "openai";

const MODEL = "gpt-4o-transcribe";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
}

/**
 * Map an audio MIME type to a filename extension OpenAI's transcription API accepts.
 * Covers the formats browser MediaRecorder produces plus common server-side ones.
 * Supported by gpt-4o-transcribe / whisper: flac, m4a, mp3, mp4, mpeg, ogg, wav, webm.
 */
function audioExtensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg") || m.includes("oga")) return "ogg";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("m4a") || m.includes("aac") || m.includes("x-m4a")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  if (m.includes("mpeg") || m.includes("mp3") || m.includes("mpga")) return "mp3";
  // MediaRecorder's most common default — a safe fallback for browser audio.
  return "webm";
}

export async function transcribeAudio(
  audio: Blob,
  language: string = "en"
): Promise<string> {
  if (!audio || audio.size === 0) {
    throw new Error("No audio to transcribe (empty recording).");
  }

  // OpenAI infers the audio format from the filename EXTENSION — it must match the
  // actual bytes, or the API rejects with "Audio file might be corrupted or unsupported".
  // Browser MediaRecorder emits webm/opus (Chrome/Firefox) or mp4/aac (Safari), never mp3,
  // so derive the extension from the blob's MIME type rather than hardcoding .mp3.
  const mime = audio.type || "audio/webm";
  const ext = audioExtensionForMime(mime);
  const file = new File([audio], `recording.${ext}`, { type: mime });

  const result = await client().audio.transcriptions.create({
    file,
    model: MODEL,
    language,
  });

  return result.text;
}

export async function transcribeFromUrl(
  url: string,
  language: string = "en"
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to download recording from ${url}: HTTP ${res.status}`
    );
  }
  const audio = await res.blob();
  return transcribeAudio(audio, language);
}
