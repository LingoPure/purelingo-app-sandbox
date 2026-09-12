// @explanatory-header-exempt — wizard entry point; the header below is the explanatory header
import { CreateOrgForm } from "@/components/org/onboarding/create-org-form";

export const metadata = {
  title: "Create an organisation — LingoPure",
};

export default function OrgNewPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="font-serif text-3xl text-navy">Create an organisation</h1>
      <p className="mb-8 mt-2 text-sm leading-relaxed text-mute">
        This is the first step of onboarding. Once created you select a service package,
        configure departments, allocate staff and assign teachers to learners — the data
        model for the org portals is built as you go.
      </p>
      <div className="rounded-xl border border-line bg-white p-6">
        <CreateOrgForm />
      </div>
    </div>
  );
}