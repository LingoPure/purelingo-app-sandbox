/**
 * Leave notifications.
 *
 * THE CONTRACT: notifying must never break the thing it is notifying about.
 * Every function here swallows its failures and logs them. An approval that
 * succeeded and then rolled back because Resend was briefly down would be far
 * worse than an approval nobody was emailed about — the state change is the
 * thing that matters, and a missed email is recoverable by telling someone.
 *
 * THE RECIPIENT'S LANGUAGE, NOT THE ACTOR'S. Each recipient's locale is
 * resolved individually, so an English-preferring manager approving leave for a
 * Vietnamese-preferring employee produces a Vietnamese email. This is the easy
 * thing to get wrong and an invisible one: the approver never sees the mail.
 *
 * WHO GETS WHAT comes from the requirement's own table. Recipients are
 * deduplicated by employee id, because a Super Admin who is also somebody's
 * assigned manager appears twice in the raw lists and should not be emailed
 * twice about one event.
 */

import { hrServiceClient } from "./deps";
import { sendHrEmail, escapeHtml, type HrEmailSender } from "./email/send";
import { localeForEmployee, translatorFor, type HrLocale } from "./i18n";
import type { HrLeaveRequest, HrRole } from "./types";

type Recipient = {
  employeeId: string;
  email: string;
  firstName: string;
  locale: HrLocale;
};

type RequestContext = {
  request: HrLeaveRequest;
  /** The person the leave belongs to. */
  subjectName: string;
  subjectEmployeeId: string;
  leaveTypeName: { en: string; vi: string };
  /** Who acted, for "approved by X". */
  actorName?: string;
  baseUrl?: string;
};

/** How many days, phrased for the locale. Vietnamese has no plural form. */
function days(count: number, locale: HrLocale): string {
  if (locale === "vi") return `${count} ngày`;
  return `${count} ${count === 1 ? "day" : "days"}`;
}

function leaveTypeIn(locale: HrLocale, name: { en: string; vi: string }): string {
  return locale === "vi" ? name.vi : name.en;
}

/**
 * The employer's identity for the footer. Never the builder's — this module is
 * operated by the client for its own staff.
 */
async function senderFor(orgId: string): Promise<HrEmailSender> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_organisations")
    .select("name, legal_entity, registration_number")
    .eq("id", orgId)
    .maybeSingle();

  const org = data as unknown as {
    name: string;
    legal_entity: string | null;
    registration_number: string | null;
  } | null;

  return {
    entity: org?.legal_entity || org?.name || "LingoPure",
    registrationNumber: org?.registration_number ?? null,
    postalAddress: process.env.HR_EMAIL_POSTAL_ADDRESS ?? null,
    contactEmail: process.env.HR_EMAIL_CONTACT ?? null,
  };
}

async function toRecipient(employeeId: string): Promise<Recipient | null> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_employees")
    .select("id, email, first_name, status")
    .eq("id", employeeId)
    .maybeSingle();

  const row = data as unknown as {
    id: string;
    email: string;
    first_name: string;
    status: string;
  } | null;

  // A deactivated employee keeps their history but stops receiving mail. Their
  // address may already have been reassigned or closed.
  if (!row || row.status === "deactivated") return null;

  return {
    employeeId: row.id,
    email: row.email,
    firstName: row.first_name,
    locale: await localeForEmployee(row.id),
  };
}

/** Everyone who should hear about something happening to `employeeId`. */
async function approversFor(
  employeeId: string,
  orgId: string
): Promise<Recipient[]> {
  const service = hrServiceClient();

  const [{ data: subject }, { data: superAdmins }] = await Promise.all([
    service.from("hr_employees").select("manager_id").eq("id", employeeId).maybeSingle(),
    service
      .from("hr_employees")
      .select("id")
      .eq("org_id", orgId)
      .eq("hr_role", "super_admin")
      .eq("status", "active"),
  ]);

  const managerId = (subject as unknown as { manager_id: string | null } | null)?.manager_id;
  const ids = new Set<string>();
  if (managerId) ids.add(managerId);
  for (const row of (superAdmins ?? []) as unknown as Array<{ id: string }>) {
    ids.add(row.id);
  }
  // Nobody is notified about their own action.
  ids.delete(employeeId);

  const resolved = await Promise.all([...ids].map(toRecipient));
  return resolved.filter((r): r is Recipient => r !== null);
}

/**
 * Send with one retry.
 *
 * A single retry covers the common case — a transient network blip or a brief
 * provider wobble — without turning a sustained outage into a queue of retries
 * holding a request handler open. Anything beyond that is logged for a human,
 * and the resend controls in the UI are the recovery path.
 */
async function deliver(
  recipient: Recipient,
  subject: string,
  html: string,
  text: string,
  sender: HrEmailSender,
  event: string
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await sendHrEmail({
      to: recipient.email,
      subject,
      bodyHtml: html,
      bodyText: text,
      sender,
    });
    if (result.ok) return;
    if (attempt === 2) {
      console.error(
        `[hr/notify] ${event} → ${recipient.email} failed after 2 attempts: ${result.error}`
      );
    }
  }
}

function button(label: string, url: string): string {
  return (
    `<p style="margin:28px 0"><a href="${url}" ` +
    `style="background:#0a2540;color:#ffffff;padding:14px 24px;border-radius:8px;` +
    `text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** A request was submitted → the assigned manager and every Super Admin. */
export async function notifyRequestSubmitted(ctx: RequestContext): Promise<void> {
  try {
    const sender = await senderFor(ctx.request.orgId);
    const recipients = await approversFor(ctx.subjectEmployeeId, ctx.request.orgId);
    const url = ctx.baseUrl ? `${ctx.baseUrl}/hr/approvals` : null;

    await Promise.all(
      recipients.map(async (recipient) => {
        const { t, locale } = translatorFor(recipient.locale);
        const vars = {
          name: ctx.subjectName,
          days: days(ctx.request.requestedDays, locale),
          type: leaveTypeIn(locale, ctx.leaveTypeName),
          from: ctx.request.startDate,
          to: ctx.request.endDate,
        };

        const lines = [t("email.submitted.lead", vars)];
        if (ctx.request.reason) {
          lines.push(t("email.submitted.reason", { reason: ctx.request.reason }));
        }

        const html =
          `<p>${escapeHtml(t("email.greeting", { name: recipient.firstName }))}</p>` +
          lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
          (url ? button(t("email.submitted.cta"), url) : "");
        const text =
          `${t("email.greeting", { name: recipient.firstName })}\n\n` +
          lines.join("\n\n") +
          (url ? `\n\n${t("email.submitted.cta")}: ${url}\n` : "\n");

        await deliver(
          recipient,
          t("email.submitted.subject", { name: ctx.subjectName }),
          html,
          text,
          sender,
          "request.submitted"
        );
      })
    );
  } catch (error) {
    console.error("[hr/notify] request.submitted failed:", error);
  }
}

/** A request was approved → the person who asked for it. */
export async function notifyRequestApproved(
  ctx: RequestContext & { balanceAfter: number | null }
): Promise<void> {
  try {
    const sender = await senderFor(ctx.request.orgId);
    const recipient = await toRecipient(ctx.subjectEmployeeId);
    if (!recipient) return;

    const { t, locale } = translatorFor(recipient.locale);
    const lines = [
      t("email.approved.lead", {
        days: days(ctx.request.requestedDays, locale),
        type: leaveTypeIn(locale, ctx.leaveTypeName),
        from: ctx.request.startDate,
        to: ctx.request.endDate,
        decider: ctx.actorName ?? "",
      }),
    ];
    if (ctx.balanceAfter !== null) {
      lines.push(
        t("email.approved.balance", {
          balance: days(ctx.balanceAfter, locale),
          type: leaveTypeIn(locale, ctx.leaveTypeName),
        })
      );
    }

    const url = ctx.baseUrl ? `${ctx.baseUrl}/hr/requests` : null;
    const html =
      `<p>${escapeHtml(t("email.greeting", { name: recipient.firstName }))}</p>` +
      lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
      (url ? button(t("email.cta.openSystem"), url) : "");
    const text =
      `${t("email.greeting", { name: recipient.firstName })}\n\n` +
      lines.join("\n\n") +
      (url ? `\n\n${url}\n` : "\n");

    await deliver(recipient, t("email.approved.subject"), html, text, sender, "request.approved");
  } catch (error) {
    console.error("[hr/notify] request.approved failed:", error);
  }
}

/** A request was declined → the person who asked for it, with the reason. */
export async function notifyRequestDeclined(
  ctx: RequestContext & { reason: string | null }
): Promise<void> {
  try {
    const sender = await senderFor(ctx.request.orgId);
    const recipient = await toRecipient(ctx.subjectEmployeeId);
    if (!recipient) return;

    const { t, locale } = translatorFor(recipient.locale);
    const lines = [
      t("email.declined.lead", {
        days: days(ctx.request.requestedDays, locale),
        type: leaveTypeIn(locale, ctx.leaveTypeName),
        from: ctx.request.startDate,
        to: ctx.request.endDate,
        decider: ctx.actorName ?? "",
      }),
    ];
    if (ctx.reason) lines.push(t("email.declined.reason", { reason: ctx.reason }));
    lines.push(t("email.declined.balance"));

    const html =
      `<p>${escapeHtml(t("email.greeting", { name: recipient.firstName }))}</p>` +
      lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
    const text =
      `${t("email.greeting", { name: recipient.firstName })}\n\n` + lines.join("\n\n") + "\n";

    await deliver(recipient, t("email.declined.subject"), html, text, sender, "request.declined");
  } catch (error) {
    console.error("[hr/notify] request.declined failed:", error);
  }
}

/**
 * Approved leave was cancelled → the requester AND the assigned manager.
 *
 * The manager is on this one because they had planned around the absence. A
 * cancellation nobody told them about is how two people end up booked off the
 * same week.
 */
export async function notifyRequestCancelled(
  ctx: RequestContext & { wasApproved: boolean }
): Promise<void> {
  try {
    if (!ctx.wasApproved) return; // Withdrawing a pending request concerns nobody else.

    const sender = await senderFor(ctx.request.orgId);
    const subject = await toRecipient(ctx.subjectEmployeeId);
    const approvers = await approversFor(ctx.subjectEmployeeId, ctx.request.orgId);

    const seen = new Set<string>();
    const recipients = [...(subject ? [subject] : []), ...approvers].filter((r) => {
      if (seen.has(r.employeeId)) return false;
      seen.add(r.employeeId);
      return true;
    });

    await Promise.all(
      recipients.map(async (recipient) => {
        const { t, locale } = translatorFor(recipient.locale);
        const lines = [
          t("email.cancelled.lead", {
            from: ctx.request.startDate,
            to: ctx.request.endDate,
            days: days(ctx.request.requestedDays, locale),
            type: leaveTypeIn(locale, ctx.leaveTypeName),
            actor: ctx.actorName ?? "",
          }),
          t("email.cancelled.restored"),
        ];

        const html =
          `<p>${escapeHtml(t("email.greeting", { name: recipient.firstName }))}</p>` +
          lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
        const text =
          `${t("email.greeting", { name: recipient.firstName })}\n\n` +
          lines.join("\n\n") +
          "\n";

        await deliver(
          recipient,
          t("email.cancelled.subject", { from: ctx.request.startDate }),
          html,
          text,
          sender,
          "request.cancelled"
        );
      })
    );
  } catch (error) {
    console.error("[hr/notify] request.cancelled failed:", error);
  }
}

/** A role changed → the affected person, and every Super Admin. */
export async function notifyRoleChanged(input: {
  orgId: string;
  employeeId: string;
  before: HrRole;
  after: HrRole;
  actorName: string;
  baseUrl?: string;
}): Promise<void> {
  try {
    const sender = await senderFor(input.orgId);

    const subject = await toRecipient(input.employeeId);
    const service = hrServiceClient();
    const { data: superAdmins } = await service
      .from("hr_employees")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("hr_role", "super_admin")
      .eq("status", "active");

    const adminRecipients = await Promise.all(
      ((superAdmins ?? []) as unknown as Array<{ id: string }>)
        .filter((row) => row.id !== input.employeeId)
        .map((row) => toRecipient(row.id))
    );

    const seen = new Set<string>();
    const recipients = [
      ...(subject ? [subject] : []),
      ...adminRecipients.filter((r): r is Recipient => r !== null),
    ].filter((r) => {
      if (seen.has(r.employeeId)) return false;
      seen.add(r.employeeId);
      return true;
    });

    await Promise.all(
      recipients.map(async (recipient) => {
        const { t } = translatorFor(recipient.locale);
        const lines = [
          t("email.roleChanged.lead", {
            before: t(`role.${input.before}`),
            after: t(`role.${input.after}`),
            actor: input.actorName,
          }),
          t("email.roleChanged.what"),
        ];

        const html =
          `<p>${escapeHtml(t("email.greeting", { name: recipient.firstName }))}</p>` +
          lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
        const text =
          `${t("email.greeting", { name: recipient.firstName })}\n\n` +
          lines.join("\n\n") +
          "\n";

        await deliver(
          recipient,
          t("email.roleChanged.subject"),
          html,
          text,
          sender,
          "role.changed"
        );
      })
    );
  } catch (error) {
    console.error("[hr/notify] role.changed failed:", error);
  }
}
