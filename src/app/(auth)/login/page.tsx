// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { login, requestMagicLink } from "./actions";
import { getDict } from "@/lib/i18n";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirectTo?: string;
    error?: string;
    message?: string;
  }>;
}) {
  const { redirectTo, error, message } = await searchParams;
  const { t } = await getDict();

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-navy">{t("login.heading")}</h1>
      <p className="mb-6 text-sm text-mute">{t("login.lead")}</p>

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

      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
        <Field label={t("login.fieldEmail")} name="email" type="email" required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{t("login.fieldPassword")}</span>
          <PasswordInput name="password" required minLength={6} autoComplete="current-password" />
        </label>
        <Link
          href="/forgot-password"
          className="-mt-1 self-end text-xs font-medium text-navy hover:underline"
        >
          Forgot password?
        </Link>
        <SubmitButton
          pendingLabel="Signing in…"
          className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-70"
        >
          {t("login.submit")}
        </SubmitButton>
      </form>

      {/* Returning students invited via magic link don't have a password.
          This second form lets them request a fresh sign-in link without
          having to ask their employer admin to re-invite them. */}
      <div className="mt-8 border-t border-cream pt-6">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          No password yet?
        </p>
        <p className="mb-3 text-sm text-mute">
          If you arrived via an invite link from your employer, you can sign in
          again by getting a fresh link in your email.
        </p>
        <form action={requestMagicLink} className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
          <Field label="Email" name="email" type="email" required />
          <SubmitButton
            pendingLabel="Sending link…"
            className="rounded-md border border-navy/30 bg-paper px-4 py-2.5 text-sm font-medium text-navy hover:bg-mist disabled:opacity-70"
          >
            Email me a sign-in link →
          </SubmitButton>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-mute">
        {t("login.signupPrompt")}{" "}
        <Link href="/signup" className="font-medium text-navy hover:underline">
          {t("login.signupLink")}
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
      />
    </label>
  );
}
