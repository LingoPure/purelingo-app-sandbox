import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "For individuals · LingoPure" };

export default function ForIndividualsPage() {
  return (
    <ScaffoldPage
      eyebrow="For individuals"
      headline="You've done the courses. You still don't sound like yourself."
      subhead="Start with one free class and a placement report that tells you exactly where you are, and exactly what's holding you back."
      cta={{ label: "Try a free demo class", href: "/demo" }}
      annotation={{
        label: "Landing page — scaffold",
        note: "The full B2C argument mirrors the homepage sales flow. This uses the homepage fork-card copy until the individual-learner research lands — no invented benefits or pricing.",
      }}
    />
  );
}
