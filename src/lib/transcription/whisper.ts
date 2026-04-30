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

export async function transcribeAudio(
  audio: Blob,
  language: string = "en"
): Promise<string> {
  const file = new File([audio], "recording.mp3", {
    type: audio.type || "audio/mpeg",
  });

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
