import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor } from "@/lib/investor/auth";
import { ProfileSection, PasswordSection, AccountSection } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings · LingoPure Investor Dataroom",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const investor = user ? await loadInvestor(user.id) : null;
  if (!investor) return null; // layout gates; satisfies the type-checker

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">Settings</h1>
        <p className="max-w-prose text-base text-navy/70">
          Manage your profile, password, and active sessions.
        </p>
      </header>
      <ProfileSection
        initialName={investor.fullName ?? ""}
        initialFirm={investor.firm ?? ""}
        email={investor.email}
      />
      <PasswordSection />
      <AccountSection />
    </div>
  );
}
