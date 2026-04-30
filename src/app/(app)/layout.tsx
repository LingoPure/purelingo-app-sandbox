import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";

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

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-mist">
      <header className="border-b border-cream bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-serif text-xl text-navy">
              LingoPure<span className="text-gold">.</span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              <Link
                href="/dashboard"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/70 hover:text-navy"
              >
                {t("nav.dashboard")}
              </Link>
              <Link
                href="/lessons"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/70 hover:text-navy"
              >
                {t("nav.lessons")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LanguagePill current={lang} tone="dark" />
            <span className="hidden text-xs text-mute sm:inline">
              {user?.email ?? "demo mode"}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-mist"
              >
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
