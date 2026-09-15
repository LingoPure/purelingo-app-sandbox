/**
 * Resend emails for the Book-a-demo corporate intake.
 *
 * Two parallel sends on every successful submission:
 * 1. Alert to LP sales — the full org briefing so a proposal can be prepared.
 * 2. Ack to the booker — confirmation with next-steps framing.
 *
 * Best-effort: ok=false when RESEND_API_KEY is unset.
 */

import type { DemoBookingInput } from "@/app/(marketing)/book-a-demo/schema";

const FROM_ADDRESS = "LingoPure <noreply@lingopure.com>";
const SALES_EMAIL_DEFAULT = "dennis@corporateaisolutions.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tableRow(label: string, value: string | number | null | undefined) {
  if (!value) return "";
  return `<tr><td style="padding:4px 0;color:#6e777d;font-size:13px;vertical-align:top;width:140px">${escapeHtml(label)}</td><td style="padding:4px 0;color:#151617;font-size:13px">${escapeHtml(String(value))}</td></tr>`;
}

function salesAlertHtml(b: DemoBookingInput, submittedAt: string): string {
  const c = b.contact;
  const o = b.organisation;
  const s = b.schedule;
  const orgRows =
    tableRow("Company", o.company) +
    tableRow("Industry", o.industry) +
    tableRow("Size", o.companySize) +
    tableRow("HQ market", o.hqMarket) +
    tableRow("Target learners", o.targetLearners) +
    tableRow("Roles / depts", o.learnerRoles) +
    tableRow("CEFR levels", o.englishLevels.join(", ")) +
    tableRow("Current training", o.currentTraining) +
    tableRow("Current provider", o.currentProvider) +
    tableRow("Learning goals", o.goals.join(", ")) +
    tableRow("Why now", o.whyNow) +
    tableRow("Start timeline", o.startTimeline) +
    tableRow("Decision timeframe", o.decisionTimeframe) +
    tableRow("Rep referral", o.repReferralEmail);
  const scheduleRows =
    tableRow("Preferred date", s.preferredDate) +
    tableRow("Preferred time", s.preferredTime) +
    tableRow("Timezone", s.timezone) +
    tableRow("Notes", s.notes);

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure · New Booking</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:22px;font-weight:400;">Demo request from ${escapeHtml(o.company)}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">A senior decision-maker has requested a staff-led walkthrough of the full LingoPure service offering.</p>
        </td></tr>

        <tr><td style="padding:12px 28px 0;"><h2 style="margin:0;color:#0a2540;font-family:Georgia,serif;font-size:15px;font-weight:400;">Contact</h2></td></tr>
        <tr><td style="padding:4px 28px 12px;"><table cellspacing="0" cellpadding="0">${tableRow("Name", `${c.firstName} ${c.lastName}`)}${tableRow("Title", c.jobTitle)}${tableRow("Email", c.email)}${tableRow("Phone", c.phone)}${tableRow("Preferred contact", c.preferredContact)}</table></td></tr>

        <tr><td style="padding:12px 28px 0;"><h2 style="margin:0;color:#0a2540;font-family:Georgia,serif;font-size:15px;font-weight:400;">Organisation</h2></td></tr>
        <tr><td style="padding:4px 28px 12px;"><table cellspacing="0" cellpadding="0">${orgRows}</table></td></tr>

        <tr><td style="padding:12px 28px 0;"><h2 style="margin:0;color:#0a2540;font-family:Georgia,serif;font-size:15px;font-weight:400;">Preferred schedule</h2></td></tr>
        <tr><td style="padding:4px 28px 12px;"><table cellspacing="0" cellpadding="0">${scheduleRows}</table></td></tr>

        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          Submitted ${escapeHtml(submittedAt)} · Source: ${escapeHtml(b.source)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function salesAlertText(b: DemoBookingInput): string {
  const c = b.contact;
  const o = b.organisation;
  return [
    `New demo request from ${o.company}`,
    ``,
    `Contact: ${c.firstName} ${c.lastName} · ${c.jobTitle} · ${c.email} · ${c.phone || "N/A"} · Preferred: ${c.preferredContact}`,
    `Company: ${o.company} · ${o.industry} · ${o.companySize} · ${o.hqMarket}`,
    `Learners: ${o.targetLearners} (${o.learnerRoles})`,
    `CEFR: ${o.englishLevels.join(", ")}`,
    `Goals: ${o.goals.join(", ")}`,
    `Training now: ${o.currentTraining}${o.currentProvider ? ` (${o.currentProvider})` : ""}`,
    `Why now: ${o.whyNow}`,
    `Timeline: ${o.startTimeline} · Decision: ${o.decisionTimeframe}`,
    o.repReferralEmail ? `Rep referral: ${o.repReferralEmail}` : "",
    ``,
    `Schedule: ${b.schedule.preferredDate} ${b.schedule.preferredTime} ${b.schedule.timezone}`,
    b.schedule.notes ? `Notes: ${b.schedule.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function ackHtml(b: DemoBookingInput): string {
  const name = b.contact.firstName;
  const dateLine =
    b.schedule.preferredDate && b.schedule.preferredTime
      ? `Your preferred date is <strong>${escapeHtml(b.schedule.preferredDate)}</strong> at <strong>${escapeHtml(b.schedule.preferredTime)}</strong> (${escapeHtml(b.schedule.timezone)}). We'll confirm within one business day.`
      : `We'll reach out within one business day to confirm a time.`;
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:22px;font-weight:400;">We've received your request</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
        </td></tr>
        <tr><td style="padding:8px 28px 12px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Thank you for your interest in LingoPure. A member of our team will walk you through the full service offering — what it looks like for <strong>${escapeHtml(b.organisation.company)}</strong> specifically, the assessment and reporting depth, and a tailored proposal for your team.</p>
        </td></tr>
        <tr><td style="padding:0 28px 16px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${dateLine}</p>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          If you have questions in the meantime, reply to this email or reach us at info@lingopure.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ackText(b: DemoBookingInput): string {
  const name = b.contact.firstName;
  const dateLine =
    b.schedule.preferredDate && b.schedule.preferredTime
      ? `Preferred date: ${b.schedule.preferredDate} ${b.schedule.preferredTime} (${b.schedule.timezone}). We'll confirm within one business day.`
      : `We'll reach out within one business day to confirm a time.`;
  return [
    `Hi ${name},`,
    ``,
    `Thank you for your interest in LingoPure. A member of our team will walk you through the full service offering for ${b.organisation.company} and provide a tailored proposal.`,
    ``,
    dateLine,
    ``,
    `— LingoPure`,
  ].join("\n");
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendDemoBookingAlert(
  b: DemoBookingInput,
  salesEmail?: string,
): Promise<{ ok: boolean; error?: string }> {
  const to = salesEmail || process.env.LP_SALES_EMAIL || SALES_EMAIL_DEFAULT;
  const submittedAt = new Date().toISOString();
  return sendResendEmail({
    to,
    subject: `[LingoPure] Demo request — ${b.organisation.company}`,
    html: salesAlertHtml(b, submittedAt),
    text: salesAlertText(b),
  });
}

export async function sendDemoBookingAck(
  b: DemoBookingInput,
): Promise<{ ok: boolean; error?: string }> {
  return sendResendEmail({
    to: b.contact.email,
    subject: `LingoPure — your demo request for ${b.organisation.company}`,
    html: ackHtml(b),
    text: ackText(b),
  });
}