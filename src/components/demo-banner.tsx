import { getDict } from "@/lib/i18n";

/**
 * Loud, sticky, every-page warning band that this is the LingoPure AI
 * demo, NOT the production lingopure.com service. Sized so an executive
 * walking past someone's screen can't miss it.
 *
 * Server component — pulls localised copy from i18n. Renders at the top
 * of the body in the root layout so it appears on EVERY route (landing,
 * login, app, employer, classroom).
 */
export async function DemoBanner() {
  const { t } = await getDict();
  return (
    <div
      data-demo-banner
      className="sticky top-0 z-50 w-full border-b-2 border-navy/20 bg-gold text-navy shadow-[0_2px_0_rgba(10,37,64,0.08)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-3 text-center sm:flex-row sm:gap-5 sm:py-4">
        <span className="inline-block rounded bg-navy px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.28em] text-gold sm:text-sm">
          AIFTIS Demo
        </span>
        <span className="font-serif text-lg leading-snug sm:text-xl md:text-2xl">
          {t("demo.bannerLead")}
        </span>
        <a
          href="https://lingopure.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm font-bold uppercase tracking-[0.2em] underline decoration-navy/50 underline-offset-2 hover:decoration-navy"
        >
          {t("demo.bannerCta")}
        </a>
      </div>
    </div>
  );
}
