import Link from "next/link";
import type { T } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n/dictionary";
import { LanguagePill } from "@/components/i18n/language-pill";
import { navBlock } from "@/content/home/chrome";

/** Marketing top nav. Structural chrome; collapses on mobile to the
 *  language pill + primary CTA (full link set returns at sm+). */
export function Nav({ t, lang }: { t: T; lang: LanguageCode }) {
  const data = navBlock.data!;
  return (
    <header className="border-b border-cream bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="font-serif text-2xl text-navy">
          LingoPure<span className="text-gold">.</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {data.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-mute hover:text-navy"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguagePill current={lang} tone="dark" />
          <Link
            href={data.ctaHref}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            {t(data.ctaKey)}
          </Link>
        </div>
      </div>
    </header>
  );
}
