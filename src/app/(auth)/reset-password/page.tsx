// @explanatory-header-exempt — auth surface (password flows are self-explanatory by web convention)
import Link from "next/link";
import { PasswordForm } from "./password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-navy">Set a new password</h1>
      <p className="mb-6 text-sm text-mute">
        Choose a new password for your account, then sign in with it.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </div>
      )}

      <PasswordForm />

      <p className="mt-6 text-center text-sm text-mute">
        <Link href="/login" className="font-medium text-navy hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
