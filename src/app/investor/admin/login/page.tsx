// @explanatory-header-exempt — auth surface (operator sign-in)
import type { Metadata } from "next";
import Link from "next/link";
import { operatorLogin, operatorMagicLink } from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

export const metadata: Metadata = {
  title: "Operator console · LingoPure",
};

export default async function OperatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-cream bg-paper p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">
            Investor Dataroom · Operator Console
          </p>
          <h1 className="mt-1 font-serif text-2xl text-navy">Operator sign in</h1>
          <p className="mt-1 text-sm text-mute">
            Restricted to LingoPure operators. Investors should use the{" "}
            <Link href="/investor/login" className="font-medium text-navy hover:underline">
              investor sign-in
            </Link>
            .
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

        <form action={operatorLogin} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="min-h-[44px] rounded-md border border-cream bg-paper px-3 py-2 text-base focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Password</span>
            <PasswordInput name="password" required minLength={6} autoComplete="current-password" />
          </label>
          <Link
            href="/forgot-password"
            className="-mt-1 self-end py-1.5 text-sm font-medium text-navy hover:underline"
          >
            Forgot password?
          </Link>
          <button
            type="submit"
            className="mt-2 min-h-[44px] rounded-md bg-navy px-4 text-base font-medium text-paper hover:bg-navy-deep"
          >
            Sign in
          </button>
        </form>

        <div className="mt-8 border-t border-cream pt-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Prefer a link?
          </p>
          <form action={operatorMagicLink} className="flex flex-col gap-3">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="operator@corporateaisolutions.com"
              className="min-h-[44px] rounded-md border border-cream bg-paper px-3 py-2 text-base focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-md border border-navy/30 bg-paper px-4 text-base font-medium text-navy hover:bg-mist"
            >
              Email me a sign-in link →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
