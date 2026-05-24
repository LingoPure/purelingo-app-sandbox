import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguagePill } from "@/components/i18n/language-pill";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { SideNav } from "@/components/nav/side-nav";
import { getDict } from "@/lib/i18n";
import { getReturnTo } from "@/lib/cross-app/return-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // If Supabase env vars are missing the createClient() call throws — fall back
  // to a demo-mode header so the placeholder pages still render in dev.
  let user: { email?: string | null } | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (!user) redirect("/login");
  }

  const { lang, t } = await getDict();
  const returnTo = await getReturnTo();

  // Standard authenticated nav — Dashboard, Lessons, Settings. Used by both the
  // desktop SideNav (left rail) and the mobile drawer (MobileNav).
  const navItems: MobileNavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/lessons", label: t("nav.lessons") },
    { href: "/settings", label: "Settings" },
  ];

  const signOutForm = (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="w-full rounded-md border border-navy/20 px-3 py-2 text-xs font-medium text-navy hover:bg-mist"
      >
        {t("nav.signOut")}
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen bg-mist">
      {/* Desktop: persistent left sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-col border-r border-cream bg-paper sm:flex">
        <div className="border-b border-cream px-5 py-5">
          <Link href="/dashboard" className="font-serif text-xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
        </div>

        <SideNav items={navItems} />

        <div className="mt-auto flex flex-col gap-3 border-t border-cream px-3 py-4">
          {returnTo && (
            <a
              href={returnTo}
              className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-center text-xs font-medium text-navy hover:bg-gold/20"
            >
              ← Back to AIFTIS
            </a>
          )}
          <div className="px-1">
            <LanguagePill current={lang} tone="dark" />
          </div>
          <p className="truncate px-1 text-xs text-mute">{user?.email ?? "demo mode"}</p>
          {signOutForm}
        </div>
      </aside>

      {/* Right column: mobile top bar (drawer) + page content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-cream bg-paper px-4 sm:hidden">
          <Link href="/dashboard" className="font-serif text-xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguagePill current={lang} tone="dark" />
            <MobileNav items={navItems} tone="dark" signOut={signOutForm} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
