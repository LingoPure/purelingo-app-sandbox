// @explanatory-header-exempt — auth surface (password flows are self-explanatory by web convention)
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-navy">Reset your password</h1>
      <p className="mb-6 text-sm text-mute">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

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

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-mute">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
