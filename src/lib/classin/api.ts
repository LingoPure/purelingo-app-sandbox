/**
 * ClassIn Analytics API adapter.
 *
 * Briefing §10 risk register:
 *   "Build the post-session sync job with an adapter pattern. The ClassIn
 *    API response is normalised in lib/classin/api.ts before touching the
 *    DB. When real schema is confirmed, only the adapter changes."
 *
 * Today the real schema is unknown. Both functions throw a structured
 * ClassinUnavailableError so the sync route can return a clean 503 with a
 * useful message rather than a generic 500. The throw is the placeholder —
 * the SHAPE returned is what the rest of the code consumes, and that shape
 * is locked.
 */

import { readClassinCredentials } from "./token";

export class ClassinUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ClassinUnavailableError";
  }
}

export type ClassinSessionAnalytics = {
  classinClassId: string;
  durationSecs: number;
  attended: boolean;
  recordingUrl: string | null;
  participation: {
    speakingTimeSecs: number;
    chatMessages: number;
    handRaises: number;
    cameraOnRatio: number;
  };
};

/**
 * GET /analytics/session/{classinClassId} on the EEO ClassIn Analytics API.
 *
 * Until LingoPure receives SDK credentials + endpoint paths from EEO, this
 * throws ClassinUnavailableError. Replace the body — keep the shape.
 */
export async function fetchSessionAnalytics(
  classinClassId: string
): Promise<ClassinSessionAnalytics> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured (CLASSIN_APP_ID + CLASSIN_APP_SECRET). " +
        "Real analytics fetch will be enabled once EEO provides SDK access."
    );
  }
  // TODO(EEO): real fetch + normalise. Reference signature:
  //   const url = `${EEO_BASE}/analytics/session/${classinClassId}`;
  //   const res = await fetch(url, { headers: signedHeaders(creds) });
  //   return normalise(await res.json());
  throw new ClassinUnavailableError(
    `ClassIn analytics endpoint not yet implemented for class ${classinClassId}.`
  );
}

/**
 * Download a session recording from ClassIn CDN.
 *
 * Confirm download API access with EEO (briefing §04). Until then this
 * also throws — sync route falls back to the "paste a transcript" demo path.
 */
export async function downloadRecording(recordingUrl: string): Promise<Blob> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured; cannot authenticate against the recording CDN."
    );
  }
  // TODO(EEO): authenticated fetch. Some ClassIn deployments serve recordings
  // via signed URLs that expire — may need to re-fetch the analytics row to
  // refresh the URL before downloading.
  const res = await fetch(recordingUrl);
  if (!res.ok) {
    throw new ClassinUnavailableError(
      `Recording download failed: HTTP ${res.status}`
    );
  }
  return res.blob();
}
