import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdentity, getOrgIdBySlug } from "@/lib/org/auth";
import { MobileNav, type MobileNavItem } from "@/components/nav/mobile-nav";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";
import { OrgSignOut } from "./sign-out-button";

export default async function OrgAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?message=" + encodeURIComponent("Please sign in to continue."));
  }

  const orgId = await getOrgIdBySlug(supabase, slug);
  if (!orgId) {
    notFound();
  }

  const identity = await getOrgIdentity(supabase, user, orgId);
  if (!identity) {
    notFound();
  }

  const { lang } = await getDict();

  const NAV = [
    { href: `/org/${slug}`, label: "Overview", exact: true },
    { href: `/org/${slug}/departments`, label: "Departments" },
    { href: `/org/${slug}/staff`, label: "Staff" },
    { href: `/org/${slug}/students`, label: "Students" },
    { href: `/org/${slug}/teachers`, label: "Teachers" },
    { href: `/org/${slug}/billing`, label: "Billing" },
  ];

  if (identity.isOwnerOrHr) {
    NAV.push({ href: `/org/${slug}/settings`, label: "Settings" });
  }

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
            <Link href="/dashboard" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              {NAV.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden font-mono text-[12px] uppercase tracking-[0.25em] text-gold sm:inline">
              {identity.orgName}
            </span>
            <span className="hidden rounded-full border border-paper/20 px-2 py-0.5 text-[12px] font-medium text-paper/70 sm:inline">
              {identity.role}
            </span>
            <LanguagePill current={lang} tone="light" />
            <div className="hidden sm:block">
              <OrgSignOut />
            </div>
            <MobileNav items={navItems} tone="light" signOut={<OrgSignOut />} />
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
      className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper/70 hover:text-paper"
    >
      {children}
    </Link>
  );
}