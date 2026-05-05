/**
 * Server-component-side cookie read for cross-app returnTo. The
 * validation primitives + cookie name + TTL live in return-validate.ts
 * so they're safe to import from Edge middleware. Anything that needs
 * `next/headers` (i.e. cookies()) lives here.
 */
import { cookies } from "next/headers";
import { RETURN_TO_COOKIE, validateReturnTo } from "./return-validate";

export {
  RETURN_TO_COOKIE,
  RETURN_TO_TTL_SECONDS,
  validateReturnTo,
} from "./return-validate";

/**
 * Read the persisted returnTo origin from the cookie. Re-validates on
 * read so a stale cookie pointing at a no-longer-allowed origin can't
 * leak through if the allowlist tightens.
 */
export async function getReturnTo(): Promise<string | null> {
  const c = await cookies();
  return validateReturnTo(c.get(RETURN_TO_COOKIE)?.value);
}
