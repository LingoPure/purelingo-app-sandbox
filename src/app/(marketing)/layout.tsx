import "./marketing.css";
import { AgentJsonLd } from "@caistech/webmcp-kit/react";
import { agentConfig } from "@/agent-readiness.config";
import { SpecProvider } from "@/components/marketing/SpecProvider";
import { MktShell } from "@/components/marketing/CanvasChrome";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

/**
 * Marketing route-group layout. Scopes the sales-flow canvas styling + font
 * stack (via .mkt) and the canvas chrome to the marketing pages only — the
 * product app (/demo, /employer, /investor, …) is unaffected.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpecProvider>
      <AgentJsonLd config={agentConfig} />
      <MktShell>
        <Nav />
        {children}
        <Footer />
      </MktShell>
    </SpecProvider>
  );
}
