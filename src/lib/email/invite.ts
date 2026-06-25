/**
 * Resend email wrapper for staff invites / magic-link sign-ins.
 *
 * Sends the action_link the admin generated in /api/employer/staff/invite
 * directly via Resend's REST API. We do this instead of relying on
 * Supabase Auth's own emailer because (a) the magiclink path doesn't
 * trigger an email at all, and (b) even when Supabase does email, the
 * verify URL it embeds bounces server-side callback handlers (hash-
 * fragment tokens). The action_link we send here points straight at
 * /auth/callback?token_hash=…&type=…&next=/onboarding so it works.
 *
 * Best-effort: returns ok=false when RESEND_API_KEY isn't set so the
 * caller can fall back to the copy-pasteable link in the admin UI.
 */

const FROM_ADDRESS = "LingoPure <noreply@updates.corporateaisolutions.com>";

export type InviteEmailInput = {
  to: string;
  inviteeName: string;
  employerName: string | null;
  actionLink: string;
  kind: "invite" | "magiclink";
};

export async function sendInviteEmail(
  input: InviteEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const subject =
    input.kind === "invite"
      ? `You're invited to LingoPure${
          input.employerName ? ` by ${input.employerName}` : ""
        }`
      : `Your LingoPure sign-in link`;
  const lead =
    input.kind === "invite"
      ? `${input.employerName ?? "Your team"} has invited you to LingoPure — a 20-25 minute AI voice discovery session calibrates your fluency to your role's target so every class after this is tailored to closing your gap.`
      : `Click below to sign in and continue your discovery session.`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: input.to,
        subject,
        html: htmlTemplate({
          inviteeName: input.inviteeName,
          subject,
          lead,
          actionLink: input.actionLink,
          kind: input.kind,
        }),
        text: `Hi ${input.inviteeName},\n\n${lead}\n\nOpen this link to begin (single use, ~1hr expiry):\n${input.actionLink}\n\n— LingoPure`,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Investor-dataroom invite — same canonical Resend transport + template as the
 * staff invite, with investor-appropriate copy. Best-effort: ok=false when
 * RESEND_API_KEY is unset so the caller can fall back to the copy-pasteable link.
 */
export async function sendInvestorInviteEmail(input: {
  to: string;
  inviteeName: string;
  firm: string | null;
  actionLink: string;
  deepDive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  const subject = "You're invited to the LingoPure investor dataroom";
  const access = input.deepDive
    ? " You'll have the main dataroom, and can unlock the confidential deep-dive board materials by accepting the NDA in-app."
    : " You'll have access to the main investor dataroom.";
  const lead = `You've been invited to review LingoPure in our investor dataroom — ask any question and get cited answers, generate reports, and browse the source documents.${access}`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: input.to,
        subject,
        html: htmlTemplate({
          inviteeName: input.inviteeName,
          subject,
          lead,
          actionLink: input.actionLink,
          kind: "invite",
          ctaLabel: "Open the dataroom",
        }),
        text: `Hi ${input.inviteeName},\n\n${lead}\n\nOpen this link to begin (single use, ~1hr expiry):\n${input.actionLink}\n\n— LingoPure`,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function htmlTemplate(input: {
  inviteeName: string;
  subject: string;
  lead: string;
  actionLink: string;
  kind: "invite" | "magiclink";
  ctaLabel?: string;
}): string {
  const ctaLabel =
    input.ctaLabel ?? (input.kind === "invite" ? "Start discovery session" : "Sign in");
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:22px;font-weight:400;">${escapeHtml(
            input.subject
          )}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Hi ${escapeHtml(
            input.inviteeName
          )},</p>
        </td></tr>
        <tr><td style="padding:8px 28px 20px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${escapeHtml(
            input.lead
          )}</p>
        </td></tr>
        <tr><td style="padding:0 28px 12px;">
          <a href="${input.actionLink}" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;">${ctaLabel} →</a>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <p style="margin:0;color:#8fa3b1;font-size:12px;line-height:1.5;">Single-use link, expires in roughly an hour. If the button doesn't work, copy this URL into your browser:<br/><span style="word-break:break-all;color:#5e7280;">${escapeHtml(
            input.actionLink
          )}</span></p>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          You're receiving this because someone at your organisation invited you to a LingoPure strategic platform demo. If this wasn't expected, ignore the email — the link expires on its own.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
