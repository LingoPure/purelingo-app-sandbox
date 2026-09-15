/**
 * Resend email wrapper for nudges.
 *
 * Best-effort: if RESEND_API_KEY isn't set we log + return false so the
 * cron can mark the row "skipped" rather than "failed". The "from"
 * address is the same noreply we use for Supabase auth emails so the
 * brand stays consistent.
 */

const FROM_ADDRESS = "LingoPure <noreply@lingopure.com>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://lingo-pure-ai.vercel.app";

export async function sendNudgeEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
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
        subject: input.subject,
        html: htmlTemplate(input.subject, input.body),
        text: `${input.body}\n\n${APP_URL}/dashboard`,
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

function htmlTemplate(subject: string, body: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:22px;font-weight:400;">${escapeHtml(subject)}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 20px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;">Open LingoPure →</a>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          You're receiving this because you have an active LingoPure account. This is a strategic platform demo — not the production lingopure.com service.
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
