/**
 * Resolve the student's PRIMARY / native language for bilingual display.
 *
 * Distinct from getDict().lang, which may be an explicit cookie choice.
 * The gloss language — the one shown alongside English instruction copy —
 * should be what the student actually grew up with:
 *
 *   students.native_language → employer.default_native_language → UI lang
 *
 * Same chain the discovery session page uses when briefing Aria.
 */
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/dictionary";

export async function resolveNativeLanguage(): Promise<LanguageCode> {
  const { lang } = await getDict();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return lang;

  const { data: studentRaw } = await supabase
    .from("students")
    .select("native_language, employer_id")
    .eq("id", user.id)
    .maybeSingle();
  const student = studentRaw as
    | { native_language?: string | null; employer_id?: string | null }
    | null;

  if (student?.native_language && isLanguageCode(student.native_language)) {
    return student.native_language;
  }

  if (student?.employer_id) {
    const { data: empRaw } = await supabase
      .from("employers")
      .select("default_native_language")
      .eq("id", student.employer_id)
      .maybeSingle();
    const employer = empRaw as { default_native_language?: string | null } | null;
    if (
      employer?.default_native_language &&
      isLanguageCode(employer.default_native_language)
    ) {
      return employer.default_native_language;
    }
  }

  return lang;
}