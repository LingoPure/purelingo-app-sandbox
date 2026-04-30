import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-mist px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-serif text-2xl text-navy">
          LingoPure<span className="text-gold">.</span>
        </Link>
        <div className="rounded-xl border border-cream bg-paper p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
