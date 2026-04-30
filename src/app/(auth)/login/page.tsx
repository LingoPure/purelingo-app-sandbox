import Link from "next/link";
import { login } from "./actions";
import { getDict } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
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

      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
        <Field label={t("login.fieldEmail")} name="email" type="email" required />
        <Field
          label={t("login.fieldPassword")}
          name="password"
          type="password"
          required
          minLength={6}
        />
        <button
          type="submit"
          className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          {t("login.submit")}
        </button>
      </form>

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
