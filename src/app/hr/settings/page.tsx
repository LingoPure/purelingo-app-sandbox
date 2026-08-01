import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getOwnEmployee, displayName } from "@/lib/hr/employees";
import { getHrI18n } from "@/lib/hr/i18n";
import { PageHeader, Panel, PanelHeader, RolePill, StatusPill } from "../ui";
import { LanguageForm, PasswordForm } from "./settings-forms";

export const metadata = { title: "Settings · LingoPure People" };

/**
 * Your own account.
 *
 * Everyone reaches this, regardless of role. Profile details are read-only
 * here: name, job title, manager and role are HR records, not preferences, and
 * letting someone edit their own reporting line would quietly break who
 * approves their leave. Language and password are yours to change.
 */
export default async function HrSettingsPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/settings");

  const [me, { t }] = await Promise.all([getOwnEmployee(), getHrI18n()]);
  if (!me) redirect("/login?next=/hr/settings");

  const languageLabels = {
    title: t("settings.languageTitle"),
    intro: t("settings.languageIntro"),
    field: t("settings.displayLanguage"),
    companyDefault: t("common.companyDefault"),
    save: t("settings.saveLanguage"),
    saving: t("common.saving"),
  };

  const passwordLabels = {
    title: t("settings.passwordTitle"),
    intro: t("settings.passwordIntro"),
    newPassword: t("settings.newPassword"),
    confirmPassword: t("settings.confirmPassword"),
    submit: t("settings.updatePassword"),
    working: t("settings.updating"),
    show: t("settings.showPassword"),
    hide: t("settings.hidePassword"),
  };

  return (
    <>
      <PageHeader title={t("settings.title")}>{t("settings.intro")}</PageHeader>

      <Panel className="mb-6">
        <PanelHeader title={t("settings.detailsTitle")} />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">{t("settings.name")}</dt>
            <dd className="mt-1 text-ink">{displayName(me)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">
              {t("settings.workEmail")}
            </dt>
            <dd className="mt-1 break-all text-ink">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">{t("settings.role")}</dt>
            <dd className="mt-1">
              <RolePill role={me.hrRole} t={t} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">{t("settings.status")}</dt>
            <dd className="mt-1">
              <StatusPill status={me.status} t={t} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">
              {t("settings.jobTitle")}
            </dt>
            <dd className="mt-1 text-ink">{me.jobTitle ?? t("common.none")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">
              {t("settings.department")}
            </dt>
            <dd className="mt-1 text-ink">{me.department ?? t("common.none")}</dd>
          </div>
        </dl>
      </Panel>

      <LanguageForm current={me.locale} labels={languageLabels} />
      <PasswordForm labels={passwordLabels} />
    </>
  );
}
