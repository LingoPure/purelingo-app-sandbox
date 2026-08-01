/**
 * @machine-callable
 *
 * Daily public-holiday reminder. Called by Vercel Cron, never by a browser.
 *
 * WHY THE MARKER MATTERS. A session-refresh middleware redirects anything
 * without a session, and a Next matcher normally runs on everything — so a
 * scheduled route is 307'd to /login unless it is explicitly excluded. A
 * redirect is not an error: nothing throws, nothing logs, the caller often
 * follows it to a 200 HTML page, and the feature simply never runs while
 * looking perfectly healthy from outside. `@machine-callable` is what lets
 * `portfolio-gate-audit-machine-routes` fail the build if the matcher ever
 * starts capturing this path.
 *
 * Verified by hand for this route, because the audit cannot run here yet: this
 * repo's `@caistech/portfolio-gate` is 0.3.0 and the audit needs >= 0.10.0 (the
 * bump lives on the unmerged `chore/gate-machine-routes` branch). The middleware
 * only redirects paths matching PROTECTED_PREFIXES, and `/api/hr/...` matches
 * none of them — note in particular that the `/hr` prefix added for the HR
 * pages does NOT match, because this path begins `/api/hr`.
 *
 * WHAT IT DOES. Finds holidays landing inside the org's notice window that have
 * not been announced, emails active staff in their own language, and stamps
 * `notified_at`.
 *
 * IDEMPOTENCE is the `notified_at IS NULL` predicate, not a date comparison.
 * Vercel Cron can fire more than once, and a retry after a partial failure must
 * not tell everyone about Tết twice.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInTimeZone, type DateOnly } from "@/lib/hr/dates";
import { sendHrEmail, escapeHtml, type HrEmailSender } from "@/lib/hr/email/send";
import type { HrLocale } from "@/lib/hr/types";

// Reads a live table and sends mail; must never be prerendered or cached.
export const dynamic = "force-dynamic";

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Vercel Cron sends its own header; an operator triggering by hand sends a
 * bearer token. Anything else is refused — this route emails the whole company.
 */
function isAuthorised(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type OrgRow = { id: string; name: string; legal_entity: string | null; registration_number: string | null; timezone: string };
type HolidayRow = { id: string; date: string; name_en: string; name_vi: string };
type StaffRow = { email: string; first_name: string; locale: HrLocale | null };

export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = adminClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "config error" },
      { status: 500 }
    );
  }

  const { data: orgs, error: orgError } = await supabase
    .from("hr_organisations")
    .select("id, name, legal_entity, registration_number, timezone");

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const summary: Array<Record<string, unknown>> = [];

  for (const org of (orgs ?? []) as unknown as OrgRow[]) {
    const { data: policyRow } = await supabase
      .from("hr_org_policy")
      .select("holiday_notice_days, default_locale")
      .eq("org_id", org.id)
      .maybeSingle();

    const policy = policyRow as unknown as
      | { holiday_notice_days: number; default_locale: HrLocale }
      | null;
    const noticeDays = policy?.holiday_notice_days ?? 7;
    const defaultLocale: HrLocale = policy?.default_locale ?? "vi";

    // "Today" in the ORG's timezone. Vercel runs UTC, and a cron firing at
    // 23:00 UTC is already tomorrow in Ho Chi Minh City — so a UTC "today"
    // would send the reminder a day late, every day.
    const today = todayInTimeZone(org.timezone);
    const horizon = addDays(today, noticeDays);

    const { data: dueRows } = await supabase
      .from("hr_public_holidays")
      .select("id, date, name_en, name_vi")
      .eq("org_id", org.id)
      .is("notified_at", null)
      .gte("date", today)
      .lte("date", horizon)
      .order("date");

    const due = (dueRows ?? []) as unknown as HolidayRow[];
    if (due.length === 0) {
      summary.push({ org: org.name, today, due: 0 });
      continue;
    }

    const { data: staffRows } = await supabase
      .from("hr_employees")
      .select("email, first_name, locale")
      .eq("org_id", org.id)
      .eq("status", "active");

    const staff = (staffRows ?? []) as unknown as StaffRow[];

    const sender: HrEmailSender = {
      entity: org.legal_entity || org.name,
      registrationNumber: org.registration_number,
      postalAddress: process.env.HR_EMAIL_POSTAL_ADDRESS ?? null,
      contactEmail: process.env.HR_EMAIL_CONTACT ?? null,
    };

    // Consecutive dates sharing a name are one holiday to a human. Tết is one
    // announcement, not five.
    const groups = groupConsecutive(due);

    let sent = 0;
    let failed = 0;
    for (const person of staff) {
      const locale = person.locale ?? defaultLocale;
      const copy = noticeCopy(locale, person.first_name, groups);
      const result = await sendHrEmail({
        to: person.email,
        subject: copy.subject,
        bodyHtml: copy.html,
        bodyText: copy.text,
        sender,
      });
      if (result.ok) sent++;
      else failed++;
    }

    // Stamped only after the send loop. Stamping first would mean a mail outage
    // silently consumed the announcement and nobody ever heard about the
    // holiday. Stamped even on partial failure, because the alternative is
    // re-mailing everyone who already received it.
    if (sent > 0) {
      await supabase
        .from("hr_public_holidays")
        .update({ notified_at: new Date().toISOString() })
        .in("id", due.map((h) => h.id));
    }

    summary.push({
      org: org.name,
      today,
      holidays: groups.map((g) => g.nameEn),
      recipients: staff.length,
      sent,
      failed,
    });
  }

  return NextResponse.json({ ok: true, summary });
}

type HolidayGroup = { nameEn: string; nameVi: string; from: DateOnly; to: DateOnly };

function groupConsecutive(rows: HolidayRow[]): HolidayGroup[] {
  const groups: HolidayGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.nameEn === row.name_en && addDays(last.to, 1) === row.date) {
      last.to = row.date as DateOnly;
    } else {
      groups.push({
        nameEn: row.name_en,
        nameVi: row.name_vi,
        from: row.date as DateOnly,
        to: row.date as DateOnly,
      });
    }
  }
  return groups;
}

function formatRange(from: string, to: string): string {
  return from === to ? from : `${from} – ${to}`;
}

function noticeCopy(
  locale: HrLocale,
  firstName: string,
  groups: HolidayGroup[]
): { subject: string; html: string; text: string } {
  const name = escapeHtml(firstName);

  if (locale === "vi") {
    const items = groups
      .map((g) => `<li>${escapeHtml(g.nameVi)} — ${formatRange(g.from, g.to)}</li>`)
      .join("");
    return {
      subject:
        groups.length === 1
          ? `Sắp tới: ${groups[0].nameVi}`
          : `Các ngày nghỉ lễ sắp tới`,
      html:
        `<p>Chào ${name},</p>` +
        `<p>Nhắc bạn về ngày nghỉ lễ sắp tới:</p>` +
        `<ul>${items}</ul>` +
        `<p>Những ngày này không trừ vào phép năm của bạn.</p>`,
      text:
        `Chào ${firstName},\n\nNhắc bạn về ngày nghỉ lễ sắp tới:\n` +
        groups.map((g) => `- ${g.nameVi} — ${formatRange(g.from, g.to)}`).join("\n") +
        `\n\nNhững ngày này không trừ vào phép năm của bạn.\n`,
    };
  }

  const items = groups
    .map((g) => `<li>${escapeHtml(g.nameEn)} — ${formatRange(g.from, g.to)}</li>`)
    .join("");
  return {
    subject:
      groups.length === 1 ? `Coming up: ${groups[0].nameEn}` : `Upcoming public holidays`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>A reminder about the public holiday coming up:</p>` +
      `<ul>${items}</ul>` +
      `<p>These do not come out of your annual leave.</p>`,
    text:
      `Hi ${firstName},\n\nA reminder about the public holiday coming up:\n` +
      groups.map((g) => `- ${g.nameEn} — ${formatRange(g.from, g.to)}`).join("\n") +
      `\n\nThese do not come out of your annual leave.\n`,
  };
}
