/**
 * Plan-ready report email (Resend).
 *
 * Two audiences, one email, branched on `isRealProgramme`:
 *  - Real (employer-admin-created learner): this IS their actual
 *    programme. The email says so plainly and closes on a
 *    "Start your programme" CTA into their own dashboard.
 *  - Demo (public self-setup path, ISS-064/065): a free self-assessment /
 *    lead-gen sample, not something the recipient has signed up for — the
 *    generated "programme" is a preview, and the email closes on a
 *    Book-a-call CTA (/book-a-demo) rather than implying enrolment.
 * Fires once per student, guarded by students.plan_report_sent_at (0059).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillProfile, PlanPhase } from "@/lib/plan/plan-delivery";

const FROM_ADDRESS = "LingoPure <noreply@lingopure.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function skillRowsHtml(skills: SkillProfile[]): string {
  return skills
    .map((s) => {
      const detail = s.assessed
        ? `${s.score}/1000${s.lp18Band ? ` · ${escapeHtml(s.lp18Band)}` : ""} — role gap ${s.roleFloorGap}, target gap ${s.targetGap}`
        : "Not yet assessed";
      return `<tr><td style="padding:4px 0;color:#0d1117;font-size:13px;">${escapeHtml(s.label)}</td><td style="padding:4px 0;color:#444d56;font-size:13px;text-align:right;">${detail}</td></tr>`;
    })
    .join("");
}

function skillLinesText(skills: SkillProfile[]): string {
  return skills
    .map((s) =>
      s.assessed
        ? `  - ${s.label}: ${s.score}/1000${s.lp18Band ? ` (${s.lp18Band})` : ""} — role gap ${s.roleFloorGap}, target gap ${s.targetGap}`
        : `  - ${s.label}: not yet assessed`
    )
    .join("\n");
}

function phasesHtml(phases: PlanPhase[]): string {
  return phases
    .map(
      (p, idx) => `
        <tr><td style="padding:14px 28px 2px;">
          <p style="margin:0;color:#0a2540;font-size:14px;font-weight:600;">${idx + 1}. ${escapeHtml(p.name)} <span style="color:#8fa3b1;font-weight:400;">(${escapeHtml(p.weeks)})</span></p>
          <ul style="margin:6px 0 4px;padding-left:18px;color:#0d1117;font-size:13px;line-height:1.6;">
            ${p.activities.map((a) => `<li>${escapeHtml(a.type)} — ${escapeHtml(a.frequency)}${a.skill !== "varies" && a.skill !== "all" ? ` (${escapeHtml(a.skill)})` : ""}</li>`).join("")}
          </ul>
          <p style="margin:0;color:#6e777d;font-size:12px;line-height:1.5;">${escapeHtml(p.rationale)}</p>
        </td></tr>`
    )
    .join("");
}

function phasesText(phases: PlanPhase[]): string {
  return phases
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.name} (${p.weeks})\n` +
        p.activities
          .map((a) => `   - ${a.type} — ${a.frequency}${a.skill !== "varies" && a.skill !== "all" ? ` (${a.skill})` : ""}`)
          .join("\n") +
        `\n   Why: ${p.rationale}`
    )
    .join("\n\n");
}

export async function sendPlanReportEmail(opts: {
  to: string;
  firstName: string;
  role: string;
  currentLevel: string;
  targetLevel: string;
  origin: string;
  skills: SkillProfile[];
  supportingSkills: SkillProfile[];
  phases: PlanPhase[];
  totalWeeks: number;
  /** Real employer-created learner (gets their actual programme) vs the
   *  public demo path (self-setup, gets the "sample, book a call" framing). */
  isRealProgramme: boolean;
  /** Operator wants to see every generated programme until confident the
   *  personalisation engine is producing correct output. Standing cc, not a
   *  one-off confirmation measure — remove only when told to. */
  cc?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const firstName = escapeHtml(opts.firstName);
  const role = escapeHtml(opts.role);
  const allSkills = [...opts.skills, ...opts.supportingSkills];
  const real = opts.isRealProgramme;

  const kicker = real ? "LingoPure" : "LingoPure &middot; Sample preview";
  const heading = real ? "Your programme is ready" : "Your sample programme is ready";
  const introPara = real
    ? `You've finished your assessment, and your personalised English programme is ready for your role as ${role} —
            you're currently around <strong>${escapeHtml(opts.currentLevel)}</strong>,
            aiming for <strong>${escapeHtml(opts.targetLevel)}</strong>.`
    : `You just finished a free self-assessment, and we've put together what a
            personalised English programme could look like for your role as ${role} —
            you're currently around <strong>${escapeHtml(opts.currentLevel)}</strong>,
            aiming for <strong>${escapeHtml(opts.targetLevel)}</strong>.`;
  const programmeHeading = real ? `Your ${opts.totalWeeks}-week programme` : `Sample ${opts.totalWeeks}-week programme`;
  const closingPara = real
    ? `<strong>This is your real programme</strong> — head to your dashboard whenever
            you're ready to start your first session.`
    : `<strong>This is a preview, not an active programme</strong> — nothing has
            been booked or charged. If it looks like something you or your team
            would use for real, the next step is a quick call.`;
  const ctaHref = real ? `${escapeHtml(opts.origin)}/dashboard` : `${escapeHtml(opts.origin)}/book-a-demo`;
  const ctaLabel = real ? "Start your programme" : "Book a call";
  const footerLine = real
    ? "You can also revisit your full programme any time from your LingoPure dashboard."
    : "You can also revisit your full sample programme any time from your LingoPure dashboard.";
  const subject = real ? "Your programme is ready — LingoPure" : "Your sample programme is ready — LingoPure";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d1117;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ede8dc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 4px;">
          <p style="margin:0;color:#c8973a;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">${kicker}</p>
          <h1 style="margin:6px 0 12px;color:#0a2540;font-family:Georgia,serif;font-size:21px;font-weight:400;">${heading}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">Hi ${firstName},</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">
            ${introPara}
          </p>
        </td></tr>
        <tr><td style="padding:14px 28px 4px;">
          <p style="margin:0 0 6px;color:#0a2540;font-size:14px;font-weight:600;">Your scores (out of 1000)</p>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ede8dc;">${skillRowsHtml(allSkills)}</table>
        </td></tr>
        <tr><td style="padding:16px 28px 0;">
          <p style="margin:0;color:#0a2540;font-size:14px;font-weight:600;">${programmeHeading}</p>
        </td></tr>
        ${phasesHtml(opts.phases)}
        <tr><td style="padding:14px 28px 0;">
          <p style="margin:0;color:#0d1117;font-size:14px;line-height:1.6;">
            ${closingPara}
          </p>
        </td></tr>
        <tr><td style="padding:18px 28px 10px;">
          <a href="${ctaHref}" style="display:inline-block;background:#c8973a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:0 28px 18px;">
          <p style="margin:0;color:#6e777d;font-size:12px;line-height:1.5;">${footerLine}</p>
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
    real
      ? `You've finished your assessment, and your personalised English programme is ready for your role as ${opts.role} — you're currently around ${opts.currentLevel}, aiming for ${opts.targetLevel}.`
      : `You just finished a free self-assessment, and we've put together what a personalised English programme could look like for your role as ${opts.role} — you're currently around ${opts.currentLevel}, aiming for ${opts.targetLevel}.`,
    ``,
    `YOUR SCORES (out of 1000)`,
    skillLinesText(allSkills),
    ``,
    programmeHeading.toUpperCase(),
    phasesText(opts.phases),
    ``,
    real
      ? `This is your real programme — head to your dashboard whenever you're ready to start your first session.`
      : `This is a preview, not an active programme — nothing has been booked or charged. If it looks like something you or your team would use for real, the next step is a quick call.`,
    ``,
    `${ctaLabel}: ${ctaHref}`,
    ``,
    footerLine,
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
        subject,
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

/** Dennis wants visibility into every generated programme while he confirms
 *  the personalisation engine is producing correct output — a standing
 *  review cc, not the earlier one-off delivery-confirmation measure. Uses
 *  the canonical operator sender address, not a personal inbox. */
const OPERATOR_REVIEW_CC = ["dennis@corporateaisolutions.com"];

/**
 * Fire the "your sample programme is ready" email exactly once per student,
 * guarded by students.plan_report_sent_at. Best-effort: a failed/duplicate
 * send must never break the caller's own page render.
 */
export async function sendPlanReadyEmailOnce(
  supabase: SupabaseClient,
  studentId: string,
  plan: {
    firstName: string;
    role: string;
    currentLevel: string;
    targetLevel: string;
    skills: SkillProfile[];
    supportingSkills: SkillProfile[];
    phases: PlanPhase[];
    totalWeeks: number;
    isRealProgramme: boolean;
  },
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
    skills: plan.skills,
    supportingSkills: plan.supportingSkills,
    phases: plan.phases,
    totalWeeks: plan.totalWeeks,
    isRealProgramme: plan.isRealProgramme,
    origin,
    cc: OPERATOR_REVIEW_CC,
  });
  if (result.ok) {
    await supabase
      .from("students")
      .update({ plan_report_sent_at: new Date().toISOString() })
      .eq("id", studentId);
  }
}
