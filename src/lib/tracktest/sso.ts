/**
 * TrackTest SSO handoff — adapter pattern, real signing pending vendor docs.
 *
 * Briefing §05.10:
 *   "SSO handoff to TrackTest exam. Webhook receives result. Exam
 *    readiness predicted from gap score."
 *
 * The exact SSO URL pattern + signing algorithm comes with the TrackTest
 * partner agreement. Until then, sso URL building throws TracktestUnavailable
 * and the demo path uses the simulate endpoint instead.
 */

export class TracktestUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "TracktestUnavailableError";
  }
}

export type TracktestSsoInput = {
  studentId: string;
  examLevel: "B1" | "B2" | "C1";
  certificationId: string;
};

export function readTracktestCredentials():
  | { apiKey: string; partnerId: string }
  | null {
  const apiKey = process.env.TRACKTEST_API_KEY;
  const partnerId = process.env.TRACKTEST_PARTNER_ID;
  if (!apiKey || !partnerId) return null;
  return { apiKey, partnerId };
}

export function buildSsoUrl(input: TracktestSsoInput): string {
  const creds = readTracktestCredentials();
  if (!creds) {
    throw new TracktestUnavailableError(
      "TrackTest credentials not configured (TRACKTEST_API_KEY + TRACKTEST_PARTNER_ID)."
    );
  }
  // TODO(TrackTest): real signing per partner docs. Until then, return a
  // shape that exercises the routing — the iframe page falls back to
  // the placeholder when the host is unreachable anyway.
  const host =
    process.env.TRACKTEST_SSO_HOST ?? "https://www.tracktest.eu/sso";
  const params = new URLSearchParams({
    partner_id: creds.partnerId,
    student_ref: input.studentId,
    exam_level: input.examLevel,
    cert_ref: input.certificationId,
  });
  return `${host}?${params.toString()}`;
}
