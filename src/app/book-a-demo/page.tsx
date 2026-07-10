import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "Book a demo · LingoPure" };

export default function BookADemoPage() {
  return (
    <ScaffoldPage
      title="Book a free demo class"
      intro="Tell us about your team and we'll assess a few of your people, then show you the LP-18 report."
      annotation={{
        label: "BOOKING FLOW STUB",
        note: "Calendar embed placeholder. Wire the real booking tool (Cal.com / Calendly) once the demo offer is finalised.",
      }}
    />
  );
}
