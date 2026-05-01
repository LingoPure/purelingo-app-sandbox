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
 * /onboarding (intro + Six Dimensions explainer + role confirm) → click
 * "Start" → /onboarding/session (this page, auto-fires the SDK) → click
 * "End" → /dashboard?just-finished=1 (banner polls until scoring
 * completes).
 *
 * Server-side prep:
 *   - validate agent + auth
 *   - resolve native language
 *   - load the student's role + employer so Aria opens *informed* about
 *     who she's talking to (role title, role description, target level,
 *     employer). These are passed through to the SDK as dynamic
 *     variables and substituted into Aria's system prompt — that's how
 *     "prep before the call" actually flows in ConvAI.
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

  // Name precedence: explicit students.name (set by employer at invite
  // time) wins, then auth metadata full_name, then email-as-fallback.
  const { data: studentRaw } = await supabase
    .from("students")
    .select("name, native_language, role_id, target_level, employer_id")
    .eq("id", user.id)
    .maybeSingle();
  const studentRow = (studentRaw ?? null) as {
    name?: string | null;
    native_language?: string | null;
    role_id?: string | null;
    target_level?: string | null;
    employer_id?: string | null;
  } | null;

  const studentName =
    studentRow?.name?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    null;

  const studentNativeLang: LanguageCode | null = isLanguageCode(
    studentRow?.native_language
  )
    ? studentRow!.native_language
    : null;
  const ariaLang: LanguageCode = studentNativeLang ?? lang;
  const ariaLangName = languageNameOf(ariaLang);
  const ariaDict = dict(ariaLang);
  const firstMessageLocalized =
    ariaDict["discovery.firstMessage"] ?? t("discovery.firstMessage");

  // Pre-call context for Aria: role + employer.
  let roleName: string | null = null;
  let roleDescription: string | null = null;
  let employerName: string | null = null;

  if (studentRow?.role_id) {
    const { data: roleRaw } = await supabase
      .from("roles")
      .select("name, description")
      .eq("id", studentRow.role_id)
      .maybeSingle();
    const roleRow = roleRaw as { name?: string; description?: string } | null;
    roleName = roleRow?.name ?? null;
    roleDescription = roleRow?.description ?? null;
  }
  if (studentRow?.employer_id) {
    const { data: empRaw } = await supabase
      .from("employers")
      .select("name")
      .eq("id", studentRow.employer_id)
      .maybeSingle();
    employerName = (empRaw as { name?: string } | null)?.name ?? null;
  }

  return (
    <DiscoverySession
      userId={user.id}
      studentName={studentName}
      nativeLanguage={ariaLangName}
      firstMessageLocalized={firstMessageLocalized}
      roleName={roleName}
      roleDescription={roleDescription}
      targetLevel={studentRow?.target_level ?? null}
      employerName={employerName}
    />
  );
}
