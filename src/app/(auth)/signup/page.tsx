// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { signup } from "./actions";
import { getDict } from "@/lib/i18n";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const { t } = await getDict();

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-navy">{t("signup.heading")}</h1>
      <p className="mb-6 text-sm text-mute">{t("signup.lead")}</p>

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

      <form action={signup} className="flex flex-col gap-4">
        <Field label={t("signup.fieldFullName")} name="fullName" type="text" required />
        <Field label={t("signup.fieldEmail")} name="email" type="email" required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{t("signup.fieldPassword")}</span>
          <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <SubmitButton
          pendingLabel="Creating account…"
          className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-70"
        >
          {t("signup.submit")}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-mute">
        {t("signup.loginPrompt")}{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          {t("signup.loginLink")}
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
