import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/dictionary";
import { RoleConfirmAndStart } from "./role-confirm";

export default async function OnboardingPage() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const { lang, t } = await getDict();

  // Pull the authenticated student's id, persisted native language,
  // current role_id, and the employer's available roles. Native
  // language now cascades: students.native_language (employer-stamped
  // at invite or set by the employee here) → employers.default_native_
  // language → UI lang. The discovery session needs role + native
  // language locked in BEFORE Aria starts — otherwise the gap scorer
  // can't calibrate against the role baseline.
  let userId: string | null = null;
  let studentNativeLang: LanguageCode | null = null;
  let employerDefaultLang: LanguageCode | null = null;
  let initialRoleId: string | null = null;
  let employerId: string | null = null;
  let roles: { id: string; name: string; description: string | null }[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: studentData } = await supabase
        .from("students")
        .select("native_language, role_id, employer_id")
        .eq("id", user.id)
        .maybeSingle();
      const studentRow = studentData as
        | {
            native_language?: string;
            role_id?: string | null;
            employer_id?: string | null;
          }
        | null;
      if (isLanguageCode(studentRow?.native_language)) {
        studentNativeLang = studentRow.native_language;
      }
      initialRoleId = studentRow?.role_id ?? null;
      employerId = studentRow?.employer_id ?? null;

      if (employerId) {
        const [rolesRes, empRes] = await Promise.all([
          supabase
            .from("roles")
            .select("id, name, description")
            .eq("employer_id", employerId)
            .eq("is_archived", false)
            .order("name", { ascending: true }),
          supabase
            .from("employers")
            .select("default_native_language")
            .eq("id", employerId)
            .maybeSingle(),
        ]);
        roles = (rolesRes.data ?? []) as typeof roles;
        const empDefault = (
          empRes.data as { default_native_language?: string } | null
        )?.default_native_language;
        if (isLanguageCode(empDefault)) employerDefaultLang = empDefault;
      }
    }
  }

  const ariaLang: LanguageCode =
    studentNativeLang ?? employerDefaultLang ?? lang;

  const dimensions: { num: string; label: string; body: string }[] = [
    { num: "1", label: t("onboarding.dim1Label"), body: t("onboarding.dim1Body") },
    { num: "2", label: t("onboarding.dim2Label"), body: t("onboarding.dim2Body") },
    { num: "3", label: t("onboarding.dim3Label"), body: t("onboarding.dim3Body") },
    { num: "4", label: t("onboarding.dim4Label"), body: t("onboarding.dim4Body") },
    { num: "5", label: t("onboarding.dim5Label"), body: t("onboarding.dim5Body") },
    { num: "6", label: t("onboarding.dim6Label"), body: t("onboarding.dim6Body") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          {t("onboarding.kicker")}
        </p>
        <h1 className="font-serif text-3xl text-navy">
          {t("onboarding.heading")}
        </h1>
        <p className="mt-3 max-w-2xl text-mute">{t("onboarding.lead")}</p>
      </div>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">
          {t("onboarding.coverHeading")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {dimensions.map((d) => (
            <div key={d.num} className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy font-mono text-xs text-paper">
                {d.num}
              </span>
              <div>
                <h3 className="font-medium text-ink">{d.label}</h3>
                <p className="text-sm text-mute">{d.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {agentId && userId ? (
        <RoleConfirmAndStart
          roles={roles}
          initialRoleId={initialRoleId}
          initialNativeLanguage={ariaLang}
          copy={{
            languageLabel: t("onboarding.languagePickerLabel"),
            languageExplain: t("onboarding.langExplain"),
            readyHeading: t("onboarding.readyHeading"),
            readyLead: t("onboarding.readyLead"),
            startButton: t("onboarding.startButton"),
            headphonesNote: t("onboarding.headphonesNote"),
          }}
        />
      ) : (
        <section className="rounded-lg border border-cream bg-paper p-8 text-center">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Discovery agent — not yet configured
          </p>
          <h2 className="mb-2 font-serif text-2xl text-navy">
            Awaiting ElevenLabs ConvAI agent
          </h2>
          <p className="mx-auto mb-1 max-w-lg text-sm text-mute">
            Run{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              npx tsx scripts/provision-discovery-agent.ts
            </code>{" "}
            to create the agent, paste{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              ELEVENLABS_AGENT_ID
            </code>{" "}
            and{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              ELEVENLABS_WEBHOOK_SECRET
            </code>{" "}
            into{" "}
            <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
              .env.local
            </code>
            , then redeploy.
          </p>
          <p className="mt-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-navy hover:underline"
            >
              ← Back to dashboard
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
