/**
 * HR email transport.
 *
 * A deliberately small, local Resend wrapper rather than a shared package.
 *
 * WHY NOT @caistech/email-send: those packages live on a private GitHub
 * Packages registry that the destination repo will not be able to reach, so
 * depending on one would make the module unliftable. This inverts the usual
 * portfolio "@caistech first" rule for this module only, on purpose. Roughly
 * eighty lines of transport is a cheaper price than an undeployable handover.
 *
 * WHAT IT IS NOT: a template library. Templates belong with the feature that
 * sends them. This file only addresses, footers and delivers.
 *
 * COMPLIANCE POSTURE: everything HR sends is transactional employment mail to
 * the company's own staff — a leave approval, an invite, a role change. It
 * carries the sender identification footer, and deliberately carries NO
 * unsubscribe link: an employee cannot opt out of being told their leave was
 * approved. That is the correct reading, not an oversight.
 *
 * The identifying entity is the EMPLOYER's (Lingopure Pte Ltd), never Corporate
 * AI Solutions or Global Buildtech. This module is operated by the client for
 * its own staff; putting the builder's entity on it would be wrong on the same
 * grounds a white-label product carries the distributor's details.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend-verified sending domain (lingopure.com is verified in Resend).
 *
 * Overridable so the destination environment can point at the client's own
 * verified domain without touching code.
 */
const DEFAULT_FROM =
  process.env.HR_EMAIL_FROM ?? "LingoPure <noreply@lingopure.com>";

export type HrEmailSender = {
  /** Legal entity shown in the footer. The employer's, not the builder's. */
  entity: string;
  registrationNumber?: string | null;
  postalAddress?: string | null;
  contactEmail?: string | null;
};

export type HrEmailInput = {
  to: string;
  subject: string;
  /** Body HTML, without the wrapper or footer — this file adds both. */
  bodyHtml: string;
  /** Plain-text alternative. Always sent; spam filters penalise HTML-only. */
  bodyText: string;
  sender: HrEmailSender;
  replyTo?: string;
};

export type HrEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

function footerHtml(sender: HrEmailSender): string {
  const parts = [sender.entity];
  if (sender.registrationNumber) parts.push(`Reg. ${sender.registrationNumber}`);
  if (sender.postalAddress) parts.push(sender.postalAddress);
  if (sender.contactEmail) parts.push(sender.contactEmail);
  return `
    <hr style="border:none;border-top:1px solid #ede8dc;margin:32px 0 16px" />
    <p style="font-size:12px;line-height:1.6;color:#8fa3b1;margin:0">
      ${parts.map(escapeHtml).join(" &middot; ")}
    </p>
    <p style="font-size:12px;line-height:1.6;color:#8fa3b1;margin:8px 0 0">
      You are receiving this because you are a member of staff. This is a
      notification about your employment and cannot be unsubscribed from.
    </p>`;
}

function footerText(sender: HrEmailSender): string {
  const parts = [sender.entity];
  if (sender.registrationNumber) parts.push(`Reg. ${sender.registrationNumber}`);
  if (sender.postalAddress) parts.push(sender.postalAddress);
  if (sender.contactEmail) parts.push(sender.contactEmail);
  return (
    `\n\n---\n${parts.join(" · ")}\n` +
    `You are receiving this because you are a member of staff. This is a ` +
    `notification about your employment and cannot be unsubscribed from.\n`
  );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Minimal branded shell. Table-free, inline-styled: the two things every mail client agrees on. */
function wrap(bodyHtml: string, sender: HrEmailSender): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f6fb">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:
       -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       font-size:16px;line-height:1.6;color:#0d1117;background:#ffffff">
    ${bodyHtml}
    ${footerHtml(sender)}
  </div>
</body></html>`;
}

/**
 * Send one email.
 *
 * Never throws. A notification failing must not roll back the approval or the
 * employee creation that triggered it — the state change is the thing that
 * matters, and a bounced email is recoverable by resending. Callers get a
 * result they can surface or log.
 *
 * The API key is read AT SEND TIME, not at module scope. A module-scope read
 * runs during `next build` page-data collection, where the value is absent, and
 * bakes in "unconfigured" for the lifetime of the deployment.
 */
export async function sendHrEmail(input: HrEmailInput): Promise<HrEmailResult> {
  // The integration harness creates real employees with @example.test addresses
  // and drives the real approval paths, which now send real notifications.
  // Without this, every test run would hand Resend a batch of undeliverable
  // addresses — noise in the provider's logs at best, and a bounce rate that
  // damages the sending domain's reputation at worst. The harness already sets
  // this flag to enable the client seam, so there is nothing extra to remember.
  if (process.env.HR_TEST_HARNESS === "1") {
    return { ok: true, id: "suppressed-in-test-harness" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: wrap(input.bodyHtml, input.sender),
        text: input.bodyText + footerText(input.sender),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // Surface Resend's own message. "The domain is not verified" is
      // actionable; "email failed to send" costs an hour of guessing.
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${response.status}: ${detail.slice(0, 500) || response.statusText}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: payload?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
