/**
 * Edge-runtime-safe validation logic for cross-app returnTo URLs.
 * Imported by both middleware (Edge runtime, must avoid next/headers)
 * and the read helper in return-link.ts.
 */
export const RETURN_TO_COOKIE = "lp_return_to";
export const RETURN_TO_TTL_SECONDS = 24 * 60 * 60;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://purelingo-app-sandbox.vercel.app",
  "http://localhost:3000",
];

const PREVIEW_HOSTNAME = /^purelingo-app-sandbox[a-z0-9-]*\.vercel\.app$/;

function allowedOrigins(): string[] {
  const fromEnv = process.env.RETURN_TO_ALLOWED_ORIGINS;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function validateReturnTo(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  const origin = parsed.origin;
  if (allowedOrigins().includes(origin)) return origin;
  if (
    parsed.protocol === "https:" &&
    PREVIEW_HOSTNAME.test(parsed.hostname)
  ) {
    return origin;
  }
  return null;
}
