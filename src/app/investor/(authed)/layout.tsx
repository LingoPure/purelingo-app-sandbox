import Link from "next/link";
import { redirect } from "next/navigation";
import { InvestorSignOut } from "../sign-out-button";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor } from "@/lib/investor/auth";

/**
 * Investor portal chrome + auth gate (third audience, mirrors the employer
 * (authed) layout). Lean for Phase 2 — the full §4 navbar (Documents, Reports,
 * Settings) and the /investor/login flow land in Phases 3–4.
 *
 * Gate: a signed-in user with an ACTIVE investors row. No row → not an investor.
 */
export default async function InvestorAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Investor portal segregation — bounce to the investor login, not the student one.
    redirect("/investor/login");
  }
  const investor = await loadInvestor(user.id);
  if (!investor || investor.status !== "active") {
    redirect("/?error=not_investor");
  }

  const navItems: MobileNavItem[] = [
    { href: "/investor/ask", label: "Ask", exact: true },
    { href: "/investor/reports", label: "Reports" },
    { href: "/investor/documents", label: "Documents" },
    // Only deep-dive-INVITED investors who haven't signed yet see the NDA unlock.
    ...(investor.deepDiveInvited && investor.maxTier === "main"
      ? [{ href: "/investor/nda", label: "Unlock deep dive" }]
      : []),
    { href: "/investor/explore", label: "Explore the platform" },
    { href: "/investor/settings", label: "Settings" },
  ];
  const accessLabel =
    investor.maxTier === "restricted" ? "Deep-dive access" : "Main dataroom";

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/investor/ask" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
              <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-gold sm:inline">
                Investor Dataroom
              </span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/70 hover:text-paper"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 sm:inline">
              {accessLabel}
            </span>
            <div className="hidden sm:block">
              <InvestorSignOut />
            </div>
            <MobileNav items={navItems} tone="light" signOut={<InvestorSignOut />} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 overflow-x-clip px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
