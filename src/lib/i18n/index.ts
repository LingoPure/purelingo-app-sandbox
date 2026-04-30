/**
 * Server-side i18n entrypoint.
 *
 * Resolution order for the active language on a request:
 *   1. lp_lang cookie (client toggle)
 *   2. authenticated student's students.native_language column
 *   3. DEFAULT_LANGUAGE (en)
 *
 * Use `await getDict()` in server components / route handlers to get a
 * `t(key, vars?)` helper. Keys missing a translation transparently fall
 * back to the English entry.
 */

import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  dict,
  isLanguageCode,
  type LanguageCode,
} from "./dictionary";
import { createClient } from "@/lib/supabase/server";

export const LANG_COOKIE = "lp_lang";

export type T = (key: string, vars?: Record<string, string | number>) => string;

export type I18n = {
  lang: LanguageCode;
  t: T;
};

/** Read the active language from cookie/student profile (server-side). */
export async function getActiveLanguage(): Promise<LanguageCode> {
  // 1. Cookie wins — explicit user choice from the pill.
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LANG_COOKIE)?.value;
  if (isLanguageCode(cookieValue)) return cookieValue;

  // 2. Authenticated student's persisted choice.
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL
  ) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("students")
          .select("native_language")
          .eq("id", user.id)
          .maybeSingle();
        const lang = (data as { native_language?: string } | null)
          ?.native_language;
        if (isLanguageCode(lang)) return lang;
      }
    } catch {
      // Auth not configured / network blip — fall through to default.
    }
  }

  return DEFAULT_LANGUAGE;
}

export async function getDict(): Promise<I18n> {
  const lang = await getActiveLanguage();
  const active = dict(lang);
  const fallback = dict(DEFAULT_LANGUAGE);

  const t: T = (key, vars) => {
    let value = active[key] ?? fallback[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  };

  return { lang, t };
}
