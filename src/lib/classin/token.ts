/**
 * ClassIn SSO token generator.
 *
 * The exact signing algorithm is to be confirmed from EEO Technology's SDK
 * documentation when LingoPure receives the developer credentials. Until
 * then, we implement HMAC-SHA256(app_secret, canonicalString) — the
 * dominant pattern across ClassIn-style LTI integrations and a safe
 * placeholder. When EEO confirms the algorithm, only this file changes.
 *
 * Briefing §07.2 quote:
 *   "ClassIn SSO token is generated server-side using CLASSIN_APP_ID +
 *    CLASSIN_APP_SECRET + student's classin_user_id + class_id + timestamp.
 *    Exact signing algorithm to be confirmed from EEO SDK documentation.
 *    Do not expose APP_SECRET to client."
 */

import { createHmac } from "node:crypto";

export type ClassinTokenInput = {
  classinUserId: string;
  classinClassId: string;
  /** Unix seconds. Default = now. Pass an explicit value for tests. */
  timestamp?: number;
};

export type ClassinSsoToken = {
  appId: string;
  classinUserId: string;
  classinClassId: string;
  timestamp: number;
  signature: string;
};

export type ClassinCredentials = {
  appId: string;
  appSecret: string;
};

export function readClassinCredentials(): ClassinCredentials | null {
  const appId = process.env.CLASSIN_APP_ID;
  const appSecret = process.env.CLASSIN_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function generateSsoToken(
  creds: ClassinCredentials,
  input: ClassinTokenInput
): ClassinSsoToken {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);

  // Canonical string: stable key order, colon-separated. EEO docs may
  // prescribe a different order — adjust here when confirmed.
  const canonical = [
    `app_id=${creds.appId}`,
    `class_id=${input.classinClassId}`,
    `timestamp=${timestamp}`,
    `user_id=${input.classinUserId}`,
  ].join("&");

  const signature = createHmac("sha256", creds.appSecret)
    .update(canonical)
    .digest("hex");

  return {
    appId: creds.appId,
    classinUserId: input.classinUserId,
    classinClassId: input.classinClassId,
    timestamp,
    signature,
  };
}
