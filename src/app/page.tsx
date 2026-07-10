import { getDict } from "@/lib/i18n";
import { SpecProvider } from "@/components/marketing/SpecProvider";
import { CanvasBar, ViewToggle } from "@/components/marketing/CanvasChrome";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/01-Hero";
import { TrustBand } from "@/components/marketing/02-TrustBand";
import { Problem } from "@/components/marketing/03-Problem";
import { AudienceFork } from "@/components/marketing/04-AudienceFork";
import { HowItWorks } from "@/components/marketing/05-HowItWorks";
import { ProofOfMethod } from "@/components/marketing/06-ProofOfMethod";
import { Outcomes } from "@/components/marketing/07-Outcomes";
import { Testimonials } from "@/components/marketing/08-Testimonials";
import { Objections } from "@/components/marketing/09-Objections";
import { FinalCTA } from "@/components/marketing/10-FinalCTA";

/**
 * Marketing homepage — the sales-flow canvas.
 *
 * Ten stages in a fixed order; each stage earns the right to the next.
 * All copy comes from the content layer (src/content/home/*) as i18n
 * keys, so nothing user-facing is hardcoded and the page is bilingual.
 * The canvas overlays (annotations, empty slots, view toggle, bar) only
 * appear when NEXT_PUBLIC_CANVAS_MODE=true.
 */
export default async function MarketingHome() {
  const { lang, t } = await getDict();
  return (
    <SpecProvider>
      <CanvasBar />
      <ViewToggle />
      <Nav t={t} lang={lang} />
      <main className="flex-1">
        <Hero t={t} />
        <TrustBand t={t} />
        <Problem t={t} />
        <AudienceFork t={t} />
        <HowItWorks t={t} />
        <ProofOfMethod t={t} />
        <Outcomes t={t} />
        <Testimonials t={t} />
        <Objections t={t} />
        <FinalCTA t={t} />
      </main>
      <Footer t={t} />
    </SpecProvider>
  );
}
