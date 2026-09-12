import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform/auth";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";
import { AdminSignOut } from "./sign-out-button";

export const metadata = {
  title: "Platform admin — LingoPure",
};

const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/onboarding", label: "Onboarding" },
  { href: "/admin/content", label: "Content" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin");
  }
  const admin = await isPlatformAdmin(supabase, user.id);
  if (!admin) {
    redirect("/dashboard?error=not_admin");
  }

  const { lang } = await getDict();
  const navItems: MobileNavItem[] = NAV.map((n) => ({
    href: n.href,
    label: n.label,
    exact: n.exact,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/admin" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
              <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-gold lg:inline">
                Platform console
              </span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              {NAV.map((item) => (
                <NavLink key={item.href} href={item.href} exact={item.exact}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguagePill current={lang} tone="light" />
            <div className="hidden sm:block">
              <AdminSignOut />
            </div>
            <MobileNav items={navItems} tone="light" signOut={<AdminSignOut />} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/70 hover:text-paper"
    >
      {children}
    </Link>
  );
}