import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore the platform · LingoPure Investor Dataroom",
};

/**
 * A subtle bridge from the dataroom to the working consumer prototype, so an
 * investor can FEEL the product they're evaluating — walking it as a prospective
 * learner/employer would. Carries the honest caveat (prototype, not the live
 * lingopure.com) and a quiet credit to who built it.
 */
export default function InvestorExplorePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">
          Explore the platform
        </h1>
        <p className="max-w-prose text-base text-navy/70">
          The dataroom describes the product; this lets you feel it. Open the
          LingoPure experience and walk it the way a prospective learner or
          employer would — the voice-led discovery, the gap-scored learning, the
          cohort dashboards.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-cream bg-paper p-5 sm:p-6">
        <div className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-navy">
          <strong>Please note:</strong> this is a working <strong>prototype</strong>{" "}
          that demonstrates where LingoPure is heading — it is <strong>not</strong>{" "}
          the current live lingopure.com service. It exists to make the vision in
          this dataroom tangible.
        </div>

        <div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-md bg-navy px-5 text-base font-medium text-paper hover:bg-navy-deep"
          >
            Open the prototype →
          </a>
          <p className="mt-2 text-xs text-navy/50">Opens in a new tab — your dataroom stays here.</p>
        </div>

        <p className="max-w-prose border-t border-cream pt-4 text-sm text-navy/60">
          Built for LingoPure by{" "}
          <span className="text-navy">Dennis McMahon</span>, LingoPure&apos;s
          technical advisor, at{" "}
          <a
            href="https://corporate-ai-solutions.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy"
          >
            Corporate AI Solutions
          </a>
          {" "}— the same studio behind this dataroom. A sense of what&apos;s possible.
        </p>
      </div>
    </div>
  );
}
