/**
 * Builds the iframe URL that loads a ClassIn classroom inside LingoPure.
 *
 * The exact ClassIn embed URL pattern is part of the EEO SDK package and is
 * not yet known. The shape below — a predictable host with the SSO token
 * fields as query params — matches every ClassIn-style integration we've
 * seen documented. When EEO confirms the path, only this file changes;
 * /classroom/[sessionId] keeps calling buildEmbedUrl() unchanged.
 */

import {
  generateSsoToken,
  type ClassinCredentials,
  type ClassinTokenInput,
} from "./token";

const DEFAULT_HOST = "https://www.eeo.cn/sdk/classroom";

export type BuildEmbedUrlInput = ClassinTokenInput & {
  /**
   * Override the embed host. The production value is supplied by EEO with
   * the SDK credentials. If unset we fall back to the documented public host.
   */
  host?: string;
};

export function buildEmbedUrl(
  creds: ClassinCredentials,
  input: BuildEmbedUrlInput
): string {
  const token = generateSsoToken(creds, input);
  const host = input.host ?? process.env.CLASSIN_EMBED_HOST ?? DEFAULT_HOST;

  const params = new URLSearchParams({
    app_id: token.appId,
    user_id: token.classinUserId,
    class_id: token.classinClassId,
    timestamp: String(token.timestamp),
    signature: token.signature,
  });

  return `${host}?${params.toString()}`;
}
