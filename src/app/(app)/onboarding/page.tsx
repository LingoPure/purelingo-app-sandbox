import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";
import {
  isLanguageCode,
  languageNameOf,
  type LanguageCode,
} from "@/lib/i18n/dictionary";

export default async function OnboardingPage() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const { lang, t } = await getDict();

  // Pull the authenticated student's id + persisted native language.
  // The session route does its own resolution server-side; we just need
  // userId here to gate the CTA, and the language to render the pill.
  let userId: string | null = null;
  let studentNativeLang: LanguageCode | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data } = await supabase
        .from("students")
        .select("native_language")
        .eq("id", user.id)
        .maybeSingle();
      const persisted = (data as { native_language?: string } | null)
        ?.native_language;
      if (isLanguageCode(persisted)) studentNativeLang = persisted;
    }
  }

  // Effective language for Aria's intro: prefer the persisted profile
  // value, else the cookie/UI language. The session route (where Aria
  // actually speaks) does the same resolution server-side; we just need
  // the display name here for the language pill.
  const ariaLang: LanguageCode = studentNativeLang ?? lang;
  const ariaLangName = languageNameOf(ariaLang);

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

      <section className="rounded-lg border border-cream bg-paper p-8 text-center">
        {agentId && userId ? (
          <>
            <div className="relative mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full ring-2 ring-cream ring-offset-2 ring-offset-paper">
              <Image
                src="/kira-avatar.jpg"
                alt="Aria, your discovery consultant"
                fill
                sizes="96px"
                className="object-cover"
                priority
              />
            </div>
            <p className="mb-1 font-serif text-base text-navy">Meet Aria</p>
            <h2 className="mb-2 font-serif text-2xl text-navy">
              {t("onboarding.readyHeading")}
            </h2>
            <p className="mb-2 text-sm text-mute">
              {t("onboarding.readyLead")}
            </p>
            <p className="mb-6 text-sm text-ink">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
                {t("onboarding.languagePickerLabel")}
              </span>
              <br />
              <span className="font-serif text-lg text-navy">{ariaLangName}</span>
              <br />
              <span className="text-xs text-mute">
                {t("onboarding.langExplain")}
              </span>
            </p>
            <Link
              href="/onboarding/session"
              className="inline-block rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep"
            >
              {t("onboarding.startButton")} →
            </Link>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-mute">
              {t("onboarding.headphonesNote")}
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </section>
    </div>
  );
}
