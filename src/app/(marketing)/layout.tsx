import "./marketing.css";
import { AgentJsonLd } from "@caistech/webmcp-kit/react";
import { agentConfig } from "@/agent-readiness.config";
import { SpecProvider } from "@/components/marketing/SpecProvider";
import { MktShell } from "@/components/marketing/CanvasChrome";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { getActiveLanguage } from "@/lib/i18n";
import { MarketingI18nProvider } from "@/components/marketing/i18n-context";

/**
 * Marketing route-group layout. Scopes the sales-flow canvas styling + font
 * stack (via .mkt) and the canvas chrome to the marketing pages only — the
 * product app (/demo, /employer, /investor, …) is unaffected. The language
 * from the lp_lang cookie/student profile drives both the chrome and the
 * homepage copy.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getActiveLanguage();
  return (
    <SpecProvider>
      <AgentJsonLd config={agentConfig} />
      <MktShell>
        <MarketingI18nProvider lang={lang}>
          <Nav />
          {children}
          <Footer lang={lang} />
        </MarketingI18nProvider>
      </MktShell>
    </SpecProvider>
  );
}
