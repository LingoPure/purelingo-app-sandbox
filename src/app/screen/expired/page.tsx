export default function ScreenExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb] px-4 py-12">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#ede8dc] bg-white shadow-sm">
        <div className="border-b border-[#ede8dc] px-8 py-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#c8973a]">
            LingoPure
          </p>
          <h1 className="mt-2 font-serif text-2xl text-[#0a2540]">Invitation expired</h1>
        </div>
        <div className="px-8 py-7">
          <p className="text-sm leading-relaxed text-[#0d1117]">
            This screen invitation is no longer active. Ask the recruiter to send you a fresh
            link.
          </p>
        </div>
      </div>
    </main>
  );
}