import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "Method · LingoPure" };

export default function MethodPage() {
  return (
    <ScaffoldPage
      eyebrow="Method"
      headline={'We don’t tell you you’re "intermediate". We show you which eighteenth.'}
      subhead="CEFR gives you six levels — too coarse to act on. LP-18 splits each level into three micro-bands and maps your communication signals against them."
      cta={{ label: "See yours after one class", href: "/demo" }}
      annotation={{
        label: "Landing page — scaffold",
        note: "Method detail mirrors the homepage proof section — LP-18, CEFR, micro-bands, and nothing beyond it. If it feels thin, it is thin until the full explainer is written; the copy does not fill the gap with claims.",
      }}
    />
  );
}
