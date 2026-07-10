import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "Company · LingoPure" };

/**
 * Company holding page. The one place investor/board framing belongs
 * (per the footer note) — kept below the marketing fold, never above it.
 */
export default function CompanyPage() {
  return (
    <ScaffoldPage
      eyebrow="Company"
      headline="LingoPure"
      subhead="LingoPure Pte. Ltd. (Singapore), a subsidiary of LingoPure Limited (New Zealand). CEFR certification is delivered in partnership with TrackTest."
      cta={{ label: "Contact us", href: "/contact" }}
      annotation={{
        label: "Company page — scaffold",
        note: "Entity detail, team, and any investor-facing framing live here — deliberately below the marketing fold, never above it.",
      }}
    />
  );
}
