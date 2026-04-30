import Link from "next/link";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getActiveLanguage } from "@/lib/i18n";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getActiveLanguage();
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-mist">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl text-navy">
          LingoPure<span className="text-gold">.</span>
        </Link>
        <LanguagePill current={lang} tone="dark" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-cream bg-paper p-8 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
