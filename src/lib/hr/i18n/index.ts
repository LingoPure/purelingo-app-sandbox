/**
 * Server-side i18n entry point for the HR module.
 *
 * Resolution order for the active language:
 *   1. `hr_employees.locale` — the person's own explicit choice
 *   2. `hr_org_policy.default_locale` — what the company uses by default
 *   3. `HR_DEFAULT_LOCALE` (Vietnamese) — the staff are in Vietnam
 *
 * Note there is no cookie in that chain, unlike the host app's i18n. An
 * employee's language is a property of their employment record, not of the
 * browser they happen to be using — and it has to be resolvable server-side
 * with no request at all, because the notification emails are sent from a cron
 * job and must still arrive in the recipient's language.
 *
 * THE RECIPIENT'S LANGUAGE, NOT THE ACTOR'S. `translatorFor` takes an explicit
 * locale for exactly this reason: when an English-preferring manager approves
 * leave for a Vietnamese-preferring employee, the email is Vietnamese. Using the
 * ambient request locale would send it in the approver's language, which is the
 * easy mistake and an invisible one — the approver never sees the mail.
 */

import { hrUserClient, hrServiceClient } from "../deps";
import {
  hrTranslator,
  isHrLocale,
  HR_DEFAULT_LOCALE,
  type HrLocale,
  type HrTranslate,
} from "./dictionary";

export {
  HR_LOCALES,
  HR_DEFAULT_LOCALE,
  isHrLocale,
  hrTranslator,
  dictKeys,
  type HrLocale,
  type HrTranslate,
} from "./dictionary";

export type HrI18n = {
  locale: HrLocale;
  t: HrTranslate;
};

/** A translator for an explicitly chosen locale. Use for emails. */
export function translatorFor(locale: HrLocale | null | undefined): HrI18n {
  const resolved = isHrLocale(locale) ? locale : HR_DEFAULT_LOCALE;
  return { locale: resolved, t: hrTranslator(resolved) };
}

/**
 * The signed-in employee's language, for rendering the UI.
 *
 * Degrades to the default rather than throwing. A language lookup failing
 * should render the page in Vietnamese, not produce an error boundary — the
 * content is what the user came for.
 */
export async function getHrI18n(): Promise<HrI18n> {
  try {
    const supabase = await hrUserClient();
    const { data: employeeId } = await supabase.rpc("hr_current_employee");
    if (!employeeId) return translatorFor(HR_DEFAULT_LOCALE);

    const { data } = await supabase
      .from("hr_employees")
      .select("locale, org_id")
      .eq("id", employeeId as string)
      .maybeSingle();

    const row = data as unknown as { locale: string | null; org_id: string } | null;
    if (row?.locale && isHrLocale(row.locale)) return translatorFor(row.locale);

    if (row?.org_id) {
      const { data: policy } = await supabase
        .from("hr_org_policy")
        .select("default_locale")
        .eq("org_id", row.org_id)
        .maybeSingle();
      const fallback = (policy as unknown as { default_locale: string } | null)?.default_locale;
      if (isHrLocale(fallback)) return translatorFor(fallback);
    }

    return translatorFor(HR_DEFAULT_LOCALE);
  } catch (error) {
    console.error("[hr/i18n] locale resolution failed:", error);
    return translatorFor(HR_DEFAULT_LOCALE);
  }
}

/**
 * An employee's language, resolved with the service client.
 *
 * For notification paths, which run outside any user session — a cron job, or a
 * request handler acting on behalf of somebody other than the recipient.
 */
export async function localeForEmployee(employeeId: string): Promise<HrLocale> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_employees")
    .select("locale, org_id")
    .eq("id", employeeId)
    .maybeSingle();

  const row = data as unknown as { locale: string | null; org_id: string } | null;
  if (row?.locale && isHrLocale(row.locale)) return row.locale;

  if (row?.org_id) {
    const { data: policy } = await service
      .from("hr_org_policy")
      .select("default_locale")
      .eq("org_id", row.org_id)
      .maybeSingle();
    const fallback = (policy as unknown as { default_locale: string } | null)?.default_locale;
    if (isHrLocale(fallback)) return fallback;
  }

  return HR_DEFAULT_LOCALE;
}
