import { ScaffoldPage } from "@/components/marketing/ScaffoldPage";

export const metadata = { title: "For individuals · LingoPure" };

export default function ForIndividualsPage() {
  return (
    <ScaffoldPage
      title="For individuals"
      intro="The B2C argument lives here: find your level, get a plan, and certify your business English at your own pace."
      annotation={{
        label: "B2C PAGE PENDING",
        note: "Individual-learner content depends on B2C research that has not landed. No invented benefits or pricing.",
      }}
    />
  );
}
