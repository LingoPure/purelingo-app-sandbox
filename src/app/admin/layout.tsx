import { redirect } from "next/navigation";
import Link from "next/link";
import { getContentEditor } from "@/lib/content/auth";
import { AdminSignOut } from "./admin-sign-out";

export const metadata = { title: "Content admin · LingoPure" };

/**
 * Content-admin chrome. Gated on a content-editor role (global, from
 * public.content_editors) — a normal user or student who reaches /admin is
 * bounced to login. Persistent nav + Sign Out on every /admin route.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const editor = await getContentEditor();
  if (!editor) redirect("/login?next=/admin");
  const isAdmin = editor.role === "admin";

  const links = [
    { href: "/admin/content", label: "Content" },
    ...(isAdmin ? [{ href: "/admin/editors", label: "Editors" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-mist md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-cream bg-paper px-4 py-4 md:w-60 md:border-b-0 md:border-r md:py-6">
        <div className="mb-6 flex items-center justify-between md:block">
          <Link href="/admin" className="font-serif text-xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute md:mt-1">
            Content admin · {editor.role}
          </p>
        </div>
        <nav className="flex gap-1 md:flex-1 md:flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-mute transition hover:bg-mist hover:text-navy"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-2 border-t border-cream pt-2 md:mt-0">
          <AdminSignOut />
        </div>
      </aside>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
