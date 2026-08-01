import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { getTeamCalendar, monthBounds, shiftMonth, type CalendarDay } from "@/lib/hr/calendar";
import { getOrgTimezone } from "@/lib/hr/policy";
import { todayInTimeZone, isDateOnly, isoDayOfWeek } from "@/lib/hr/dates";
import { getHrI18n, type HrLocale, type HrTranslate } from "@/lib/hr/i18n";
import { PageHeader, Panel, EmptyState } from "../ui";

export const metadata = { title: "Team calendar · LingoPure People" };

/**
 * Month and weekday names.
 *
 * Not dictionary keys. Twenty-four entries that are pure data would bloat the
 * dictionary without ever varying by context, and Vietnamese month names are
 * regular ("Tháng 1" … "Tháng 12") so they are generated rather than listed.
 */
function monthNames(locale: HrLocale): string[] {
  if (locale === "vi") {
    return Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);
  }
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
}

function weekdayNames(locale: HrLocale): string[] {
  // ISO order: Monday first, matching hr_org_policy.working_days. Vietnamese
  // counts weekdays from Sunday as "Chủ nhật", then "Thứ hai" (second day) for
  // Monday — so the abbreviations are T2..T7 with CN for Sunday.
  return locale === "vi"
    ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

/**
 * Who is away, and when.
 *
 * Reads through `hr_team_availability` — a projection with no reason column in
 * its return type — so a Staff member can see that a colleague is unavailable
 * without seeing why. That is the requirement's exact split, and it is enforced
 * by the shape of the data, not by leaving a field out of the markup.
 *
 * Pending requests appear only for people who could act on them, which is why a
 * Staff member and their Manager can see different things on the same date.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/calendar");

  const [timezone, { t, locale }] = await Promise.all([
    getOrgTimezone(identity.orgId),
    getHrI18n(),
  ]);
  const today = todayInTimeZone(timezone);

  const { month } = await searchParams;
  const anchor = month && isDateOnly(`${month}-01`) ? `${month}-01` : today;
  const { from, to } = monthBounds(anchor);

  const days = await getTeamCalendar(from, to);
  const [year, monthIndex] = anchor.split("-").map(Number);
  const months = monthNames(locale);
  const monthLabel = `${months[monthIndex - 1]} ${year}`;

  const prev = shiftMonth(anchor, -1).slice(0, 7);
  const next = shiftMonth(anchor, 1).slice(0, 7);
  const busyDays = days.filter((d) => d.away.length > 0 || d.holidayName);

  return (
    <>
      <PageHeader title={t("calendar.title")}>{t("calendar.intro")}</PageHeader>

      <nav
        aria-label={t("calendar.changeMonth")}
        className="mb-6 flex items-center justify-between gap-3"
      >
        <Link
          href={`/hr/calendar?month=${prev}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-navy hover:bg-mist"
        >
          ← {months[(monthIndex + 10) % 12]}
        </Link>
        <h2 className="font-serif text-lg text-navy sm:text-xl">{monthLabel}</h2>
        <Link
          href={`/hr/calendar?month=${next}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-navy hover:bg-mist"
        >
          {months[monthIndex % 12]} →
        </Link>
      </nav>

      {/* Mobile: an agenda of days that actually have something on them.
          A 7-column month grid at 375px either overflows sideways or shrinks
          the text below readable size, and most days are empty anyway. */}
      <div className="md:hidden">
        {busyDays.length === 0 ? (
          <EmptyState title={t("calendar.emptyTitle")}>{t("calendar.emptyBody")}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {busyDays.map((day) => (
              <li key={day.date} className="rounded-lg border border-cream bg-paper p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-navy">
                    {day.date}
                    {day.date === today ? (
                      <span className="ml-2 text-xs text-gold">{t("common.today")}</span>
                    ) : null}
                  </span>
                  {day.holidayName ? (
                    <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
                      {day.holidayName}
                    </span>
                  ) : null}
                </div>
                {day.away.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {day.away.map((entry) => (
                      <li key={`${entry.requestId}-${day.date}`} className="text-sm">
                        <PersonBadge entry={entry} t={t} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop: a real month grid. */}
      <div className="hidden md:block">
        <MonthGrid days={days} today={today} weekdays={weekdayNames(locale)} t={t} />
      </div>

      <Panel className="mt-6">
        <p className="text-sm text-mute">
          <span className="mr-4">
            <Dot className="bg-ai-green" /> {t("calendar.legendApproved")}
          </span>
          <span className="mr-4">
            <Dot className="bg-gold" /> {t("calendar.legendPending")}
          </span>
          <span>
            <Dot className="bg-navy-soft" /> {t("calendar.legendHoliday")}
          </span>
        </p>
      </Panel>
    </>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${className}`}
    />
  );
}

function PersonBadge({
  entry,
  t,
}: {
  entry: CalendarDay["away"][number];
  t: HrTranslate;
}) {
  const pending = entry.status === "pending";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot className={pending ? "bg-gold" : "bg-ai-green"} />
      <span className={pending ? "text-mute" : "text-ink"}>
        {entry.firstName} {entry.lastName}
        {entry.isHalfDay ? (
          <span className="text-mute">
            {" "}
            ({entry.half === "am" ? t("calendar.morning") : t("calendar.afternoon")})
          </span>
        ) : null}
        {pending ? <span className="text-mute"> · {t("calendar.pending")}</span> : null}
      </span>
    </span>
  );
}

/**
 * Month grid.
 *
 * Leading blanks align the 1st under the right weekday. ISO day-of-week is
 * used throughout (Monday = 1), matching `hr_org_policy.working_days` — mixing
 * that with JavaScript's Sunday-is-0 is how a calendar ends up off by one.
 */
function MonthGrid({
  days,
  today,
  weekdays,
  t,
}: {
  days: CalendarDay[];
  today: string;
  weekdays: string[];
  t: HrTranslate;
}) {
  if (days.length === 0) return null;
  const leadingBlanks = isoDayOfWeek(days[0].date) - 1;

  return (
    <div className="overflow-hidden rounded-lg border border-cream bg-paper">
      <div className="grid grid-cols-7 border-b border-cream bg-mist/60 text-center">
        {weekdays.map((label) => (
          <div key={label} className="px-2 py-2 text-xs font-medium text-navy">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[104px] border-b border-r border-cream bg-mist/30" />
        ))}
        {days.map((day) => (
          <div
            key={day.date}
            className={`min-h-[104px] border-b border-r border-cream p-2 ${
              day.holidayName
                ? "bg-navy-soft/10"
                : day.isWorkingDay
                  ? ""
                  : "bg-mist/40"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span
                className={`text-sm ${
                  day.date === today ? "font-semibold text-gold" : "text-navy"
                }`}
              >
                {Number(day.date.slice(8))}
              </span>
            </div>
            {day.holidayName ? (
              <p className="mt-1 text-[11px] font-medium leading-tight text-navy-soft">
                {day.holidayName}
              </p>
            ) : null}
            <ul className="mt-1 flex flex-col gap-0.5">
              {day.away.slice(0, 3).map((entry) => (
                <li
                  key={`${entry.requestId}-${day.date}`}
                  className="truncate text-[11px] leading-tight"
                  title={`${entry.firstName} ${entry.lastName}`}
                >
                  <Dot className={entry.status === "pending" ? "bg-gold" : "bg-ai-green"} />
                  {entry.firstName}
                </li>
              ))}
              {day.away.length > 3 ? (
                <li className="text-[11px] text-mute">
                  {t("calendar.more", { count: day.away.length - 3 })}
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
