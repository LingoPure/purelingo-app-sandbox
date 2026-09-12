import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/teacher");

  const identity = await getTeacherIdentity(supabase, user);
  if (!identity) {
    redirect("/dashboard?error=not_a_teacher");
  }

  const { lang } = await getDict();
  const navItems: MobileNavItem[] = [
    { href: "/teacher", label: "My Students", exact: true },
    { href: "/teacher/schedule", label: "Schedule" },
    { href: "/teacher/notes", label: "Notes" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/teacher" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-gold sm:inline">
              {identity.fullName}
            </span>
            <LanguagePill current={lang} tone="light" />
            <div className="hidden sm:block">
              <TeacherSignOut />
            </div>
            <MobileNav items={navItems} tone="light" signOut={<TeacherSignOut />} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/70 hover:text-paper">
      {children}
    </Link>
  );
}

async function TeacherSignOut() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="rounded-md border border-paper/20 px-3 py-1.5 text-xs font-medium text-paper hover:bg-paper/10">
        Sign out
      </button>
    </form>
  );
}