import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listHolidaysInYear, groupHolidays, listOverridesInYear } from "@/lib/hr/holidays";
import { getOrgPolicy, getOrgTimezone } from "@/lib/hr/policy";
import { todayInTimeZone, yearOf } from "@/lib/hr/dates";
import { getHrI18n } from "@/lib/hr/i18n";
import { PageHeader, Panel, PanelHeader, EmptyState } from "../ui";
import {
  AddHolidayForm,
  DeleteHolidayButton,
  OverrideForm,
  RemoveOverrideButton,
} from "./holiday-forms";

export const metadata = { title: "Public holidays · LingoPure People" };

/**
 * Public holiday administration. Super Admin only.
 *
 * Scoped to one year at a time, because that is how the task actually arrives:
 * Vietnam publishes the following year's holiday schedule each autumn, and Tết
 * moves with the lunar calendar so it has to be re-entered annually rather than
 * repeating itself.
 */
export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/holidays");
  if (identity.role !== "super_admin") redirect("/hr/calendar");

  const [timezone, policy, { t, locale }] = await Promise.all([
    getOrgTimezone(identity.orgId),
    getOrgPolicy(identity.orgId),
    getHrI18n(),
  ]);
  const today = todayInTimeZone(timezone);

  const { year: yearParam } = await searchParams;
  const parsed = Number(yearParam);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : yearOf(today);

  const [holidays, overrides] = await Promise.all([
    listHolidaysInYear(identity.orgId, year),
    listOverridesInYear(identity.orgId, year),
  ]);

  const groups = groupHolidays(holidays);
  const defaultDate = year === yearOf(today) ? today : `${year}-01-01`;

  return (
    <>
      <PageHeader title={t("holidays.title")}>
        {t("holidays.intro", { days: policy.holidayNoticeDays })}
      </PageHeader>

      <nav aria-label={t("holidays.changeYear")} className="mb-6 flex items-center gap-3">
        <Link
          href={`/hr/holidays?year=${year - 1}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-navy hover:bg-mist"
        >
          ← {year - 1}
        </Link>
        <span className="font-serif text-lg text-navy">{year}</span>
        <Link
          href={`/hr/holidays?year=${year + 1}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-navy hover:bg-mist"
        >
          {year + 1} →
        </Link>
      </nav>

      <AddHolidayForm defaultDate={defaultDate} />

      <Panel className="mb-6">
        <PanelHeader title={t("holidays.inYear", { year })}>
          {groups.length === 0
            ? t("holidays.noneYet")
            : t("holidays.summary", { days: holidays.length, groups: groups.length })}
        </PanelHeader>

        {groups.length === 0 ? (
          <EmptyState title={t("holidays.emptyTitle", { year })}>
            {t("holidays.emptyBody")}
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-cream">
            {groups.map((group) => (
              <li
                key={`${group.nameEn}-${group.startDate}`}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-navy">{locale === "vi" && group.nameVi ? group.nameVi : group.nameEn}</p>
                  {group.nameVi && group.nameVi !== group.nameEn ? (
                    <p className="text-sm text-mute">
                      {locale === "vi" ? group.nameEn : group.nameVi}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-mute">
                    {group.startDate === group.endDate
                      ? group.startDate
                      : `${group.startDate} → ${group.endDate} (${group.dates.length} days)`}
                    {group.isRecurring ? ` · ${t("holidays.sameDateEachYear")}` : ""}
                  </p>
                  {group.dates.some((d) => d.notifiedAt) ? (
                    <p className="mt-1 text-xs text-ai-green">{t("holidays.notified")}</p>
                  ) : null}
                </div>
                <DeleteHolidayButton
                  nameEn={group.nameEn}
                  startDate={group.startDate}
                  endDate={group.endDate}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <OverrideForm defaultDate={defaultDate} />

      <Panel>
        <PanelHeader title={t("holidays.overridesTitle", { year })}>
          {overrides.length === 0
            ? t("holidays.overridesNone")
            : t("holidays.overridesSummary", { count: overrides.length })}
        </PanelHeader>

        {overrides.length === 0 ? (
          <p className="text-sm text-mute">{t("holidays.overridesHint")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream">
            {overrides.map((override) => (
              <li
                key={override.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-navy">
                    {override.date} ·{" "}
                    {override.isWorkingDay ? t("holidays.everybodyWorks") : t("holidays.officeClosed")}
                  </p>
                  {override.note ? (
                    <p className="text-sm text-mute">{override.note}</p>
                  ) : null}
                </div>
                <RemoveOverrideButton date={override.date} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
