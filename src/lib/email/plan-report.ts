/**
 * Plan-ready sample report email (Resend).
 *
 * ISS-064/065: the discovery -> battery -> plan flow is a free
 * self-assessment / lead-gen sample, not the live enrolled product — the
 * generated "programme" is a preview, not something the student has signed
 * up for. This email says so explicitly and closes on a Book-a-call CTA
 * (the existing /book-a-demo page) rather than implying enrolment. Fires
 * once per student, guarded by students.plan_report_sent_at (0059).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const FROM_ADDRESS = "LingoPure <noreply@lingopure.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPlanReportEmail(opts: {
  to: string;
  firstName: string;
  role: string;
  currentLevel: string;
  targetLevel: string;
  origin: string;
  /** Temporary — cc while confirming the send is actually firing on the
   *  real path. Remove once confirmed; a proper per-plan admin notification
   *  is a separate, later piece of work. */
  cc?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const firstName = escapeHtml(opts.firstName);
  const role = escapeHtml(opts.role);

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">LingoPure &middot; Sample preview</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:21px;font-weight:400;">Your sample programme is ready</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Hi ${firstName},</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">
            You just finished a free self-assessment, and we've put together what a
            personalised English programme could look like for your role as ${role} —
            you're currently around <strong>${escapeHtml(opts.currentLevel)}</strong>,
            aiming for <strong>${escapeHtml(opts.targetLevel)}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:10px 28px 0;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">
            <strong>This is a preview, not an active programme</strong> — nothing has
            been booked or charged. If it looks like something you or your team
            would use for real, the next step is a quick call.
          </p>
        </td></tr>
        <tr><td style="padding:18px 28px 10px;">
          <a href="${escapeHtml(opts.origin)}/book-a-demo" style="display:inline-block;background:#c8973a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">Book a call</a>
        </td></tr>
        <tr><td style="padding:0 28px 18px;">
          <p style="margin:0;color:#6e777d;font-size:12px;line-height:1.5;">You can also revisit your full sample programme any time from your LingoPure dashboard.</p>
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
    `Hi ${opts.firstName},`,
    ``,
    `You just finished a free self-assessment, and we've put together what a personalised English programme could look like for your role as ${opts.role} — you're currently around ${opts.currentLevel}, aiming for ${opts.targetLevel}.`,
    ``,
    `This is a preview, not an active programme — nothing has been booked or charged. If it looks like something you or your team would use for real, the next step is a quick call.`,
    ``,
    `Book a call: ${opts.origin}/book-a-demo`,
    ``,
    `You can also revisit your full sample programme any time from your LingoPure dashboard.`,
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
        ...(opts.cc?.length ? { cc: opts.cc } : {}),
        subject: `Your sample programme is ready — LingoPure`,
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

/** Temporary — cc'd while confirming the send actually fires on the real
 *  student path (it previously didn't: ISS-064/065 was fixed inside an
 *  API route nothing on the real /plan page ever called). Remove this cc
 *  once confirmed; a real per-plan admin notification is separate, later
 *  work the operator asked for explicitly, not a default behaviour. */
const TEMP_CONFIRMATION_CC = ["mcmdennis@gmail.com"];

/**
 * Fire the "your sample programme is ready" email exactly once per student,
 * guarded by students.plan_report_sent_at. Best-effort: a failed/duplicate
 * send must never break the caller's own page render.
 */
export async function sendPlanReadyEmailOnce(
  supabase: SupabaseClient,
  studentId: string,
  plan: { firstName: string; role: string; currentLevel: string; targetLevel: string },
  origin: string
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("email, plan_report_sent_at")
    .eq("id", studentId)
    .maybeSingle();
  const row = student as { email?: string | null; plan_report_sent_at?: string | null } | null;
  if (!row?.email || row.plan_report_sent_at) return;

  const result = await sendPlanReportEmail({
    to: row.email,
    firstName: plan.firstName,
    role: plan.role,
    currentLevel: plan.currentLevel,
    targetLevel: plan.targetLevel,
    origin,
    cc: TEMP_CONFIRMATION_CC,
  });
  if (result.ok) {
    await supabase
      .from("students")
      .update({ plan_report_sent_at: new Date().toISOString() })
      .eq("id", studentId);
  }
}
