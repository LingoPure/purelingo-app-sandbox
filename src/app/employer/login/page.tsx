import { LoginForm } from "./login-form";
import { LanguagePill } from "@/components/i18n/language-pill";
import { getDict } from "@/lib/i18n";

export default async function EmployerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const { lang, t } = await getDict();
  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <div className="flex justify-end px-6 pt-6">
        <LanguagePill current={lang} tone="light" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md rounded-lg border border-paper/10 bg-navy-deep p-8">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-gold">
            {t("emp.loginKicker")}
          </p>
          <h1 className="mb-2 font-serif text-3xl text-paper">
            {t("emp.loginHeading")}
          </h1>
          <p className="mb-6 text-sm text-mute">{t("emp.loginLead")}</p>
          <LoginForm
            redirectTo={redirectTo ?? "/employer"}
            fieldLabel={t("emp.loginField")}
            submitLabel={t("emp.loginSubmit")}
            submittingLabel={t("emp.loginSubmitting")}
          />
        </div>
      </div>
    </div>
  );
}
