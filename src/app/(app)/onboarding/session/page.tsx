import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoverySession } from "../discovery-session";
import { getDict } from "@/lib/i18n";
import {
  dict,
  isLanguageCode,
  languageNameOf,
  type LanguageCode,
} from "@/lib/i18n/dictionary";

/**
 * Dedicated full-page route for the discovery voice session.
 *
 * /onboarding (intro + Six Dimensions explainer) → click "Start" →
 * /onboarding/session (this page, auto-fires the SDK) → click "End" →
 * /dashboard?just-finished=1 (banner polls until scoring completes).
 *
 * Server-side: validates the agent is configured + the user is signed
 * in + resolves the right native language for Aria's opener.
 */
export default async function DiscoverySessionPage() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    // Onboarding page renders the "agent not yet configured" message;
    // bouncing back there avoids a confusing blank session screen.
    redirect("/onboarding");
  }

  const { lang, t } = await getDict();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const studentName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    null;

  const { data } = await supabase
    .from("students")
    .select("native_language")
    .eq("id", user.id)
    .maybeSingle();
  const persisted = (data as { native_language?: string } | null)
    ?.native_language;
  const studentNativeLang: LanguageCode | null = isLanguageCode(persisted)
    ? persisted
    : null;

  const ariaLang: LanguageCode = studentNativeLang ?? lang;
  const ariaLangName = languageNameOf(ariaLang);
  const ariaDict = dict(ariaLang);
  const firstMessageLocalized =
    ariaDict["discovery.firstMessage"] ?? t("discovery.firstMessage");

  return (
    <DiscoverySession
      userId={user.id}
      studentName={studentName}
      nativeLanguage={ariaLangName}
      firstMessageLocalized={firstMessageLocalized}
    />
  );
}
