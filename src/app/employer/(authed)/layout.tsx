import Link from "next/link";
import { EmployerSignOut } from "../sign-out-button";

export default function EmployerAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <header className="border-b border-cream bg-navy text-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/employer" className="font-serif text-xl text-paper">
              LingoPure<span className="text-gold">.</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-gold">
                Employer
              </span>
            </Link>
            <nav className="hidden items-center gap-5 sm:flex">
              <NavLink href="/employer">Overview</NavLink>
              <NavLink href="/employer/students">Students</NavLink>
            </nav>
          </div>
          <EmployerSignOut />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
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
