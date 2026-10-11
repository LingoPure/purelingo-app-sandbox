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

// ─── Push-direction: curriculum → ClassIn ───────────────────────────────────
//
// Create Course / Create Class (single/multiple) / enrolment are DOCUMENTED
// as existing on EEO's public API listing (docs/AUDIT_REPORT.md §A5.4) —
// unlike the recording/analytics endpoints above, whose existence itself
// was never fully confirmed. That changes nothing about readiness, though:
// the exact request/response schema, auth header shape, and base URL were
// never pulled past the doc-listing level. Same locked-adapter-shape
// discipline as fetchSessionAnalytics/downloadRecording — throw until EEO
// confirms the wire format, never guess it (the embed-host guess in
// embed.ts is exactly the mistake this discipline exists to avoid).

export type ClassinCourseInput = {
  title: string;
  /** Free text — EEO's schema for what a "course" actually models
   *  (a single ongoing enrolment vs. a term/programme container) is
   *  unconfirmed; pass through whatever the caller has. */
  description?: string;
};

export type ClassinCourse = {
  classinCourseId: string;
};

/**
 * POST .../course (exact path unconfirmed) — Create Course.
 */
export async function createCourse(
  input: ClassinCourseInput
): Promise<ClassinCourse> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured (CLASSIN_APP_ID + CLASSIN_APP_SECRET). " +
        "Real course creation will be enabled once EEO provides SDK access."
    );
  }
  // TODO(EEO): real request. Unconfirmed: base URL, auth header shape,
  // whether a teacher must be assigned at creation time or can follow later.
  throw new ClassinUnavailableError(
    `ClassIn Create Course endpoint not yet implemented (title: "${input.title}").`
  );
}

export type ClassinClassInput = {
  classinCourseId: string;
  /** When unset, the class is created unstaffed — teacher assignment is a
   *  separate, later concern (the HR module's roster, not this adapter).
   *  Whether EEO's Create Class API actually permits an unassigned teacher
   *  at creation time is itself unconfirmed — if it doesn't, the caller
   *  needs a placeholder/internal teacher id until a real one is assigned. */
  teacherId?: string;
  scheduledAt: string; // ISO timestamp
  durationMins: number;
};

export type ClassinClass = {
  classinClassId: string;
  joinUrl: string | null;
};

/**
 * POST .../class (exact path unconfirmed) — Create Class (single).
 */
export async function createClass(
  input: ClassinClassInput
): Promise<ClassinClass> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured (CLASSIN_APP_ID + CLASSIN_APP_SECRET). " +
        "Real class creation will be enabled once EEO provides SDK access."
    );
  }
  throw new ClassinUnavailableError(
    `ClassIn Create Class endpoint not yet implemented (course ${input.classinCourseId}, ` +
      `scheduled ${input.scheduledAt}).`
  );
}

export type ClassinEnrolInput = {
  studentId: string;
  classinCourseId: string;
};

/**
 * POST .../student + Add Students And Audit Course (exact shape
 * unconfirmed) — provisions the student's classin_user_id if they don't
 * have one yet, then enrols them in the course.
 */
export async function enrolStudent(
  input: ClassinEnrolInput
): Promise<{ classinUserId: string }> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured (CLASSIN_APP_ID + CLASSIN_APP_SECRET). " +
        "Real student enrolment will be enabled once EEO provides SDK access."
    );
  }
  throw new ClassinUnavailableError(
    `ClassIn Add/Edit Student + enrolment endpoints not yet implemented ` +
      `(student ${input.studentId}, course ${input.classinCourseId}).`
  );
}

export type ClassinAssignTeacherInput = {
  classinClassId: string;
  teacherId: string;
};

/**
 * Assigns a teacher to an already-created (possibly unstaffed) class — the
 * step that ties an auto-scheduled slot back to the HR module's roster once
 * that integration exists. Deliberately separate from createClass: "when
 * should this happen" (the scheduling engine, student/course-paced) and
 * "who teaches it" (HR staffing) are different decisions on different
 * timelines — see classin/scheduling.ts.
 */
export async function assignTeacher(
  input: ClassinAssignTeacherInput
): Promise<void> {
  const creds = readClassinCredentials();
  if (!creds) {
    throw new ClassinUnavailableError(
      "ClassIn credentials not configured (CLASSIN_APP_ID + CLASSIN_APP_SECRET)."
    );
  }
  throw new ClassinUnavailableError(
    `ClassIn teacher-assignment endpoint not yet implemented (class ${input.classinClassId}, ` +
      `teacher ${input.teacherId}).`
  );
}
