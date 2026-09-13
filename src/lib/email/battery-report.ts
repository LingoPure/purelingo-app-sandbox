/**
 * Battery-complete report email (Resend).
 *
 * The "taste → report → book a demo" bridge: a learner who finishes the
 * Phase 0b battery (voice discovery + 4 tasks) receives a compact personal
 * report — their LP-18 profile across the four battery skills — plus a
 * Book-a-demo CTA so their organisation can explore the full service.
 */

import { scoreToLp18 } from "@/lib/scoring/rubric";

const FROM_ADDRESS = "LingoPure <noreply@updates.corporateaisolutions.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ReportSkill = {
  label: string;
  score: number;
};

const cefrPalette: Record<string, string> = {
  A1: "#9b5c22",
  A2: "#b0762e",
  B1: "#c8973a",
  B2: "#2e8b6c",
  C1: "#1f6f54",
  C2: "#155a43",
};

function bandFor(score: number): { band: string; color: string } {
  const lp = scoreToLp18(score); // e.g. B1.3
  const cefr = lp.split(".")[0] ?? "B1";
  return { band: lp, color: cefrPalette[cefr] ?? "#c8973a" };
}

export async function sendBatteryReportEmail(opts: {
  to: string;
  name?: string | null;
  company?: string | null;
  origin: string;
  skills: ReportSkill[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi there,";
  const companyLine = opts.company
    ? ` Thanks for representing ${escapeHtml(opts.company)}.`
    : "";
  const overall = Math.round(
    opts.skills.reduce((sum, s) => sum + s.score, 0) / Math.max(opts.skills.length, 1)
  );
  const overallBand = bandFor(overall);

  const skillRows = opts.skills
    .map((s) => {
      const b = bandFor(s.score);
      const pct = Math.max(0, Math.min(100, Math.round((s.score / 1000) * 100)));
      return `
        <tr>
          <td style="padding:6px 0;color:#0d1117;font-size:13px;width:46%;">${escapeHtml(s.label)}</td>
          <td style="padding:6px 0;">
            <div style="background:#f3f6fb;border-radius:4px;height:8px;width:100%;">
              <div style="background:${b.color};border-radius:4px;height:8px;width:${pct}%;"></div>
            </div>
          </td>
          <td style="padding:6px 0 6px 12px;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;font-weight:600;white-space:nowrap;">${b.band}</td>
        </tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:21px;font-weight:400;">Your English profile is ready</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">${greeting}${companyLine}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Here&rsquo;s how your conversational discovery and the four task scores land:</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:10px 14px;background:#f3f6fb;border-radius:8px;">
                <div style="color:#8fa3b1;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Overall band</div>
                <div style="color:${overallBand.color};font-family:ui-monospace,SFMono-Regular,monospace;font-size:22px;font-weight:700;">${overallBand.band}</div>
              </td>
            </tr>
            ${skillRows}
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 10px;">
          <a href="${escapeHtml(opts.origin)}/book-a-demo" style="display:inline-block;background:#c8973a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">Book a demo — see LingoPure for your team</a>
        </td></tr>
        <tr><td style="padding:0 28px 18px;">
          <p style="margin:0;color:#6e777d;font-size:12px;line-height:1.5;">A short walkthrough of the full service: conversation practice, the 2K intelligence journey, curriculum, teacher-led sessions and team reporting.</p>
        </td></tr>
        <tr><td style="padding:14px 28px;background:#f3f6fb;border-top:1px solid #ede8dc;color:#8fa3b1;font-size:11px;line-height:1.5;">
          Questions? Reach us at info@lingopure.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const bandLines = opts.skills
    .map((s) => `  ${s.label}: ${bandFor(s.score).band} (${Math.round((s.score / 1000) * 100)}/100)`)
    .join("\n");

  const text = [
    `${greeting}${companyLine}`,
    ``,
    `Here's how your conversational discovery and the four task scores land:`,
    ``,
    `Overall band: ${overallBand.band}`,
    bandLines,
    ``,
    `Book a demo — see LingoPure for your team: ${opts.origin}/book-a-demo`,
    ``,
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
        subject: `Your English profile is ready — LingoPure`,
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