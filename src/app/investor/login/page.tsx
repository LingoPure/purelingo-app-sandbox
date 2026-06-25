// @explanatory-header-exempt — auth surface (sign-in is self-explanatory by web convention)
import type { Metadata } from "next";
import Link from "next/link";
import { investorLogin, investorMagicLink } from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

export const metadata: Metadata = {
  title: "Investor sign-in · LingoPure",
};

export default async function InvestorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirectTo?: string }>;
}) {
  const { error, message, redirectTo } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-cream bg-paper p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">
            Investor Dataroom
          </p>
          <h1 className="mt-1 font-serif text-2xl text-navy">Sign in</h1>
          <p className="mt-1 text-sm text-mute">
            Access is by invitation. Use the email LingoPure invited you with.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-md border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal">
            {message}
          </div>
        )}

        <form action={investorLogin} className="flex flex-col gap-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Password</span>
            <PasswordInput name="password" required minLength={6} autoComplete="current-password" />
          </label>
          <Link
            href="/forgot-password"
            className="-mt-1 self-end text-xs font-medium text-navy hover:underline"
          >
            Forgot password?
          </Link>
          <button
            type="submit"
            className="mt-2 min-h-[44px] rounded-md bg-navy px-4 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            Sign in
          </button>
        </form>

        <div className="mt-8 border-t border-cream pt-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            No password yet?
          </p>
          <p className="mb-3 text-sm text-mute">
            If you were invited by email, get a one-time sign-in link.
          </p>
          <form action={investorMagicLink} className="flex flex-col gap-3">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@firm.com"
              className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-md border border-navy/30 bg-paper px-4 text-sm font-medium text-navy hover:bg-mist"
            >
              Email me a sign-in link →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
