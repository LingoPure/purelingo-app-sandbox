import Link from "next/link";
import type { T } from "@/lib/i18n";
import { footerBlock } from "@/content/home/chrome";

/** Marketing footer. The only place investor/board framing is allowed —
 *  a discreet "Company" link, per the brief's non-goals. */
export function Footer({ t }: { t: T }) {
  const data = footerBlock.data!;
  return (
    <footer className="border-t border-cream bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-serif text-xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <p className="mt-2 max-w-xs text-sm text-mute">{t(data.taglineKey)}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {data.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-mute hover:text-navy"
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <Link
            href={data.companyHref}
            className="text-sm text-mute/70 hover:text-navy"
          >
            {t(data.companyKey)}
          </Link>
        </nav>
      </div>
      <div className="border-t border-cream py-6">
        <p className="mx-auto max-w-6xl px-6 text-center font-mono text-xs uppercase tracking-widest text-mute">
          {t(data.rightsKey)}
        </p>
      </div>
    </footer>
  );
}
