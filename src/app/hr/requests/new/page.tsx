import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrIdentity } from "@/lib/hr/auth";
import { listLeaveTypes, getOrgTimezone } from "@/lib/hr/policy";
import { todayInTimeZone } from "@/lib/hr/dates";
import { PageHeader } from "../../ui";
import { RequestForm } from "./request-form";

export const metadata = { title: "Request leave · LingoPure People" };

export default async function NewRequestPage() {
  const identity = await getHrIdentity();
  if (!identity) redirect("/login?next=/hr/requests/new");

  const [leaveTypes, timezone] = await Promise.all([
    listLeaveTypes(identity.orgId),
    getOrgTimezone(identity.orgId),
  ]);

  // "Today" in the organisation's timezone, not the server's. Vercel runs UTC,
  // and for seven hours of every day that is yesterday in Ho Chi Minh City —
  // which would default the form to a date already in the past.
  const today = todayInTimeZone(timezone);

  return (
    <>
      <PageHeader title="Request leave">
        Choose your dates and we will work out how many days it costs. Weekends
        and public holidays are not counted. Your manager is notified as soon as
        you submit, and nothing is deducted until they approve it.
      </PageHeader>

      <p className="mb-6">
        <Link href="/hr/requests" className="text-sm text-navy underline underline-offset-4">
          ← Back to my requests
        </Link>
      </p>

      <RequestForm
        employeeId={identity.employeeId}
        leaveTypes={leaveTypes}
        today={today}
      />
    </>
  );
}
