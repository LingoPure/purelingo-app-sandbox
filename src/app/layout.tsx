import type { Metadata } from "next";
import { ConditionalSayFix } from "@/components/conditional-sayfix";
import { Plus_Jakarta_Sans, DM_Serif_Display, DM_Mono } from "next/font/google";
import "./globals.css";
import { getActiveLanguage } from "@/lib/i18n";
import { DemoBanner } from "@/components/demo-banner";
import { ConditionalDemoBanner } from "@/components/conditional-demo-banner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "LingoPure AI · Strategic Platform Demo",
  description:
    "Strategic platform demo for LingoPure: voice-led AI discovery, gap-scored micro-learning, employer cohort dashboards, and CEFR certification — wrapped around ClassIn. Not the production LingoPure service.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getActiveLanguage();
  return (
    <html
      lang={lang}
      className={`${jakarta.variable} ${dmSerif.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <ConditionalDemoBanner>
          <DemoBanner />
        </ConditionalDemoBanner>
        {children}<ConditionalSayFix repo="lingopureai" />
      </body>
    </html>
  );
}
