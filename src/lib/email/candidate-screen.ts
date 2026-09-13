/**
 * Candidate screen invite email (Resend).
 *
 * Sent by the employer console when a hiring manager invites a candidate to
 * take the LingoPure English screen. The single CTA is the magic-link that
 * lands them straight in the assessment (zero-form account).
 */

const FROM_ADDRESS = "LingoPure <noreply@updates.corporateaisolutions.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendCandidateScreenEmail(opts: {
  to: string;
  name?: string | null;
  company: string;
  roleName: string | null;
  actionLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const greeting = opts.name
    ? `Hi ${escapeHtml(opts.name)},`
    : "Hi there,";
  const roleLine = opts.roleName
    ? ` as part of the hiring process for the <strong>${escapeHtml(opts.roleName)}</strong> role`
    : " as part of the hiring process";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:21px;font-weight:400;">English screen for ${escapeHtml(opts.company)}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${greeting}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 12px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${escapeHtml(opts.company)} has invited you to take a short English assessment${roleLine}. It takes roughly 30 minutes — a conversational AI session followed by a listening and speaking task. There's nothing to prepare.</p>
        </td></tr>
        <tr><td style="padding:0 28px 22px;">
          <a href="${escapeHtml(opts.actionLink)}" style="display:inline-block;background:#c8973a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">Start the assessment</a>
        </td></tr>
        <tr><td style="padding:0 28px 16px;">
          <p style="margin:0;color:#6e777d;font-size:12px;line-height:1.5;">The link works for a limited time and is personal to you. If it has expired, ask the recruiter to send a new one.</p>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          Questions? Reach us at info@lingopure.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${greeting}`,
    ``,
    `${opts.company} has invited you to take a short English assessment${opts.roleName ? ` for the ${opts.roleName} role` : ""}. It takes roughly 30 minutes — a conversational AI session followed by a listening and speaking task.`,
    ``,
    `Start the assessment: ${opts.actionLink}`,
    ``,
    `The link works for a limited time and is personal to you.`,
    `— LingoPure`,
  ].join("\n");

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
        subject: `Your LingoPure screen for ${opts.company}`,
        html,
        text,
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