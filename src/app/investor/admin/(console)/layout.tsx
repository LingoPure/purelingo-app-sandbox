import Link from "next/link";
import { redirect } from "next/navigation";
import { OperatorSignOut } from "../operator-sign-out";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/investor/operator-auth";

/**
 * Operator console chrome + the ADMIN_EMAILS gate (§8.5). Reject is POST-auth:
 * a signed-in non-operator (or a logged-out user) is bounced to the operator
 * login — also the reject point for the magic-link path. This layout wraps the
 * (console) group only; /investor/admin/login sits outside it (no loop).
 */
export default async function OperatorConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/investor/admin/login");
  }
  if (!isOperator(user.email)) {
    redirect("/investor/admin/login?error=not_authorised");
  }

  const navItems: MobileNavItem[] = [
    { href: "/investor/admin/investors", label: "Investors" },
    { href: "/investor/admin/access-log", label: "Access log" },
    { href: "/investor/admin/documents", label: "Documents" },
    { href: "/investor/admin/reports", label: "Reports" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="sticky top-0 z-20 border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/investor/admin" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
              <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-gold sm:inline">
                Operator Console
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
            <span className="hidden max-w-[200px] truncate font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 sm:inline">
              {user.email}
            </span>
            <div className="hidden sm:block">
              <OperatorSignOut />
            </div>
            <MobileNav items={navItems} tone="light" signOut={<OperatorSignOut />} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
