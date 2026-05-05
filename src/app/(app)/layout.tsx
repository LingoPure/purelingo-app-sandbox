import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguagePill } from "@/components/i18n/language-pill";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
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
  // If the student arrived from a partner app (AIFTIS-Demo today) we
  // surface a "Back to AIFTIS" pill until the cookie expires. Cookie
  // is set in middleware after the returnTo origin is allowlisted.
  const returnTo = await getReturnTo();

  const navItems: MobileNavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/lessons", label: t("nav.lessons") },
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
    <div className="flex min-h-screen flex-1 flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/dashboard" className="font-serif text-xl text-navy">
              LingoPure<span className="text-gold">.</span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/70 hover:text-navy"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {returnTo && (
              <a
                href={returnTo}
                className="hidden rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-navy hover:bg-gold/20 sm:inline-flex"
              >
                ← Back to AIFTIS
              </a>
            )}
            <LanguagePill current={lang} tone="dark" />
            <span className="hidden text-xs text-mute sm:inline">
              {user?.email ?? "demo mode"}
            </span>
            <div className="hidden sm:block">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-mist"
                >
                  {t("nav.signOut")}
                </button>
              </form>
            </div>
            <MobileNav items={navItems} tone="dark" signOut={signOutForm} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
