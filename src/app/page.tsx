import Link from "next/link";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";

export default async function LandingPage() {
  const { lang, t } = await getDict();
  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      <header className="border-b border-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-serif text-2xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <nav className="flex items-center gap-3">
            <LanguagePill current={lang} tone="dark" />
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
            >
              {t("home.ctaPrimary")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            {t("home.kicker")}
          </p>
          <h1 className="font-serif text-5xl leading-tight text-navy md:text-6xl">
            {t("home.headline")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-mute">{t("home.lead")}</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          <PathCard
            tag={t("home.path1Tag")}
            heading={t("home.path1Heading")}
            body={t("home.path1Body")}
            cta={t("home.path1Cta")}
            href="/signup"
            tone="secondary"
          />
          <PathCard
            tag={t("home.path2Tag")}
            heading={t("home.path2Heading")}
            body={t("home.path2Body")}
            cta={t("home.path2Cta")}
            href="/employer/login"
            tone="primary"
          />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            tag="01"
            title="AI Voice Assessment"
            body="Aria, our voice AI, conducts a 20–35 min professional English assessment across six competency dimensions — no human assessor required."
          />
          <FeatureCard
            tag="02"
            title="Verified CPD Points"
            body="Completion automatically issues verified CPD points against the member's professional record — association-endorsed and audit-ready."
          />
          <FeatureCard
            tag="03"
            title="Portable ASEAN Credentials"
            body="CEFR-anchored certificates are issued by the member's association and recognised across ASEAN borders for professional mobility."
          />
        </div>
      </main>

      <footer className="border-t border-cream py-8">
        <div className="mx-auto max-w-6xl px-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-mute">
          LingoPure · AIFTIS Demo · 2026
        </div>
      </footer>
    </div>
  );
}

function PathCard({
  tag,
  heading,
  body,
  cta,
  href,
  tone,
}: {
  tag: string;
  heading: string;
  body: string;
  cta: string;
  href: string;
  tone: "primary" | "secondary";
}) {
  const cardClass =
    tone === "primary"
      ? "rounded-xl border-2 border-navy bg-navy p-8 shadow-sm"
      : "rounded-xl border border-cream bg-paper p-8 shadow-sm";
  const tagClass =
    tone === "primary"
      ? "mb-3 font-mono text-xs uppercase tracking-[0.2em] text-gold"
      : "mb-3 font-mono text-xs uppercase tracking-[0.2em] text-gold";
  const headingClass =
    tone === "primary"
      ? "mb-3 font-serif text-2xl text-paper"
      : "mb-3 font-serif text-2xl text-navy";
  const bodyClass =
    tone === "primary"
      ? "mb-6 text-sm leading-relaxed text-paper/70"
      : "mb-6 text-sm leading-relaxed text-mute";
  const ctaClass =
    tone === "primary"
      ? "inline-block rounded-md bg-gold px-5 py-2.5 text-sm font-medium text-navy hover:bg-gold/90"
      : "inline-block rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep";
  return (
    <div className={cardClass}>
      <p className={tagClass}>{tag}</p>
      <h2 className={headingClass}>{heading}</h2>
      <p className={bodyClass}>{body}</p>
      <a href={href} className={ctaClass}>
        {cta}
      </a>
    </div>
  );
}

function FeatureCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6 shadow-sm">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-gold">
        {tag}
      </div>
      <h3 className="mb-2 font-serif text-xl text-navy">{title}</h3>
      <p className="text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}
