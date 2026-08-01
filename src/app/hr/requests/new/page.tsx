import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listLeaveTypes, getOrgTimezone } from "@/lib/hr/policy";
import { todayInTimeZone } from "@/lib/hr/dates";
import { getHrI18n } from "@/lib/hr/i18n";
import { PageHeader } from "../../ui";
import { RequestForm } from "./request-form";

export const metadata = { title: "Request leave · LingoPure People" };

export default async function NewRequestPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/requests/new");

  const [leaveTypes, timezone, { t, locale }] = await Promise.all([
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
    getHrI18n(),
  ]);

  // "Today" in the organisation's timezone, not the server's. Vercel runs UTC,
  // and for seven hours of every day that is yesterday in Ho Chi Minh City —
  // which would default the form to a date already in the past.
  const today = todayInTimeZone(timezone);

  // Leave type names come from the database in both languages, so they are
  // picked by locale rather than translated — a Super Admin can add a new type
  // and it will have no dictionary key.
  const types = leaveTypes.map((type) => ({
    id: type.id,
    name: locale === "vi" ? type.nameVi : type.nameEn,
    deductsBalance: type.deductsBalance,
  }));

  return (
    <>
      <PageHeader title={t("newRequest.title")}>{t("newRequest.intro")}</PageHeader>

      <p className="mb-6">
        <Link href="/hr/requests" className="text-sm text-navy underline underline-offset-4">
          ← {t("newRequest.back")}
        </Link>
      </p>

      <RequestForm
        employeeId={identity.employeeId}
        leaveTypes={types}
        today={today}
        labels={{
          leaveType: t("newRequest.leaveType"),
          noBalanceSuffix: t("newRequest.noBalanceSuffix"),
          firstDay: t("newRequest.firstDay"),
          lastDay: t("newRequest.lastDay"),
          halfDaySingle: t("newRequest.halfDay"),
          halfDayFirst: t("newRequest.firstDayHalf"),
          halfDayLast: t("newRequest.lastDayHalf"),
          halfDayHint: t("newRequest.halfDayHint"),
          fullDay: t("newRequest.fullDay"),
          morningOnly: t("newRequest.morningOnly"),
          afternoonOnly: t("newRequest.afternoonOnly"),
          reason: t("newRequest.reason"),
          reasonHint: t("newRequest.reasonHint"),
          submit: t("newRequest.submit"),
          submitting: t("newRequest.submitting"),
          balanceAfter: t("newRequest.balanceAfter"),
          balanceFrom: t("newRequest.balanceFrom"),
          noDeduct: t("newRequest.noDeduct"),
          day: t("common.day"),
          days: t("common.days"),
        }}
      />
    </>
  );
}
