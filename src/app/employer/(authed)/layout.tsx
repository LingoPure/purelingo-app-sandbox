import Link from "next/link";
import { redirect } from "next/navigation";
import { EmployerSignOut } from "../sign-out-button";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { loadEmployerAdmin } from "@/lib/employer/auth";

export default async function EmployerAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authorise: must be a Supabase-authenticated user AND have a row in
  // employer_admins. Middleware already ensured the user is signed in;
  // here we check they're allowed to see the employer dashboard at all.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/employer");
  }
  const admin = await loadEmployerAdmin(supabase, user.id);
  if (!admin) {
    redirect("/dashboard?error=not_admin");
  }

  const { lang, t } = await getDict();
  const navItems: MobileNavItem[] = [
    { href: "/employer", label: t("emp.navOverview"), exact: true },
    { href: "/employer/students", label: t("emp.navStudents") },
    { href: "/employer/roles", label: "Roles" },
    { href: "/employer/teachers", label: "Teachers" },
    { href: "/employer/departments", label: "Departments" },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/employer" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
              <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-gold sm:inline">
                {t("emp.brandTag")}
              </span>
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
            <LanguagePill current={lang} tone="light" />
            <div className="hidden sm:block">
              <EmployerSignOut />
            </div>
            <MobileNav
              items={navItems}
              tone="light"
              signOut={<EmployerSignOut />}
            />
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
  href,
  children,
}: {
  href: string;
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
