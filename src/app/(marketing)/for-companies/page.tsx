import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "For companies · LingoPure" };

export default function ForCompaniesPage() {
  return (
    <ScaffoldPage
      eyebrow="For companies"
      headline="Close your team's English gap, and prove it."
      subhead="Assess a whole team in a week. Get a capability baseline, not an attendance sheet."
      cta={{ label: "Try a team assessment", href: "/demo" }}
      annotation={{
        label: "Landing page — scaffold",
        note: "The full B2B argument mirrors the homepage sales flow. This uses the existing product-demo headline and the homepage fork-card copy until the customer research lands — nothing here is invented.",
      }}
    />
  );
}
