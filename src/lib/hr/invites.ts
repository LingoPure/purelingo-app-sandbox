/**
 * Employee invitations.
 *
 * An employee record is created first and invited second, so by the time the
 * invite goes out the person already exists in `hr_employees` with
 * `status='invited'` and no `auth_user_id`. Until they accept,
 * `hr_current_employee()` resolves them by email — so if they happen to sign in
 * another way, they are still recognised as themselves rather than as a
 * stranger with no HR identity.
 *
 * THE LINK. We call `auth.admin.generateLink` for the token, then build our OWN
 * `/auth/callback?token_hash=…` URL rather than using the `action_link` Supabase
 * hands back. That is not stylistic. For `magiclink` and `invite` types Supabase
 * redirects with the tokens in a URL HASH FRAGMENT, and a fragment is never sent
 * to the server — so a server-side callback route sees nothing and drops the
 * user at /login with no explanation. Passing `token_hash` as a query parameter
 * lets the route consume it with `verifyOtp()` and set the session cookie
 * properly. This is the same conclusion `src/lib/employer/invite-link.ts`
 * reached; it is repeated here rather than imported because the module must not
 * depend on LingoPure code.
 */

import { hrServiceClient } from "./deps";
import { requireHrSuperAdmin, HrAuthError } from "./auth";
import { getEmployee, writeAudit, displayName } from "./employees";
import { sendHrEmail, escapeHtml, type HrEmailSender } from "./email/send";
import type { HrEmployee, HrLocale } from "./types";

export type InviteResult = {
  employee: HrEmployee;
  /** Always returned, so a Super Admin can deliver it by hand if mail fails. */
  actionLink: string;
  emailDelivery: "sent" | "failed";
  emailError: string | null;
};

/** Where an invited employee lands after accepting. */
const POST_ACCEPT_PATH = "/hr";

/**
 * Create-or-reuse the auth user, mint a link, email it, stamp `invited_at`.
 *
 * Safe to call repeatedly — that is the "resend invitation" button. Each call
 * mints a fresh token, so an older link stops working, which is the behaviour
 * you want if the first one leaked into the wrong inbox.
 */
export async function inviteEmployee(
  employeeId: string,
  origin: string
): Promise<InviteResult> {
  const actor = await requireHrSuperAdmin();
  const employee = await getEmployee(employeeId);
  if (!employee) throw new HrAuthError("No such employee", 403);

  if (employee.status === "deactivated") {
    throw new HrAuthError("Cannot invite a deactivated employee", 403);
  }

  const service = hrServiceClient();
  const email = employee.email.toLowerCase();

  const authUserId = await ensureAuthUser(email);

  // Link the auth user to the employee row now rather than at acceptance. If we
  // waited, an employee who signs in through some other route would be matched
  // only by the email fallback, which is a bootstrap path and not meant to be
  // load-bearing forever.
  if (authUserId && employee.authUserId !== authUserId) {
    const { error } = await service
      .from("hr_employees")
      .update({ auth_user_id: authUserId })
      .eq("id", employee.id);
    if (error) {
      console.error("[hr/invites] auth link failed:", error.message);
    }
  }

  const actionLink = await mintActionLink(email, origin);

  const sender = await senderForOrg(actor.orgId);
  const orgName = sender.entity;
  const locale: HrLocale = employee.locale ?? (await defaultLocale(actor.orgId));
  const copy = inviteCopy(locale, displayName(employee), orgName, actionLink);

  const send = await sendHrEmail({
    to: email,
    subject: copy.subject,
    bodyHtml: copy.html,
    bodyText: copy.text,
    sender,
  });

  const { data } = await service
    .from("hr_employees")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", employee.id)
    .select("invited_at")
    .maybeSingle();

  await writeAudit(actor.employeeId, actor.orgId, "employee.invited", "hr_employees",
    employee.id, null, { email, delivery: send.ok ? "sent" : "failed" });

  return {
    employee: {
      ...employee,
      authUserId: authUserId ?? employee.authUserId,
      invitedAt: (data as { invited_at: string } | null)?.invited_at ?? employee.invitedAt,
    },
    actionLink,
    emailDelivery: send.ok ? "sent" : "failed",
    emailError: send.ok ? null : send.error,
  };
}

/**
 * Find or create the auth user for this address.
 *
 * `createUser` with `email_confirm: true` is deliberate: the Super Admin
 * asserting someone is an employee IS the verification. Making a new hire prove
 * they own their own work address adds a step and a failure mode without adding
 * any assurance.
 */
async function ensureAuthUser(email: string): Promise<string | null> {
  const service = hrServiceClient();

  const existing = await findAuthUserByEmail(email);
  if (existing) return existing;

  const { data, error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error) {
    // Lost a race, or the address exists outside our page window. Either way
    // the user exists now, so look again rather than failing the invite.
    const retry = await findAuthUserByEmail(email);
    if (retry) return retry;
    console.error("[hr/invites] createUser failed:", error.message);
    return null;
  }
  return data.user?.id ?? null;
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const service = hrServiceClient();
  // listUsers is paginated and has no server-side email filter in this SDK
  // version. Fine at LingoPure's scale; revisit if the auth pool grows large.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[hr/invites] listUsers failed:", error.message);
      return null;
    }
    const hit = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email
    );
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Mint a magic-link token and wrap it in a callback URL the server can read. */
async function mintActionLink(email: string, origin: string): Promise<string> {
  const service = hrServiceClient();
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=${POST_ACCEPT_PATH}` },
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(
      `[hr/invites] link generation failed: ${error?.message ?? "no hashed_token returned"}`
    );
  }

  return (
    `${origin}/auth/callback` +
    `?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=magiclink` +
    `&next=${encodeURIComponent(POST_ACCEPT_PATH)}`
  );
}

/** The employer's identity for the footer — never the builder's. */
async function senderForOrg(orgId: string): Promise<HrEmailSender> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_organisations")
    .select("name, legal_entity, registration_number")
    .eq("id", orgId)
    .maybeSingle();

  const org = data as {
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

async function defaultLocale(orgId: string): Promise<HrLocale> {
  const service = hrServiceClient();
  const { data } = await service
    .from("hr_org_policy")
    .select("default_locale")
    .eq("org_id", orgId)
    .maybeSingle();
  return ((data as { default_locale: HrLocale } | null)?.default_locale ?? "vi");
}

/**
 * Invite copy, in the recipient's language.
 *
 * Inline rather than in the i18n dictionary because issue #8 owns the full
 * bilingual notification set; this is the one message #5 needs, and it moves
 * there when the rest arrive.
 */
function inviteCopy(
  locale: HrLocale,
  name: string,
  orgName: string,
  link: string
): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(name);
  const safeOrg = escapeHtml(orgName);

  if (locale === "vi") {
    return {
      subject: `${orgName} — Kích hoạt tài khoản nghỉ phép của bạn`,
      html:
        `<p>Chào ${safeName},</p>` +
        `<p>${safeOrg} đã tạo tài khoản cho bạn trên hệ thống quản lý nghỉ phép. ` +
        `Tại đây bạn có thể gửi đơn xin nghỉ, xem số ngày phép còn lại và theo dõi ` +
        `các ngày lễ sắp tới.</p>` +
        `<p style="margin:28px 0"><a href="${link}" ` +
        `style="background:#0a2540;color:#ffffff;padding:14px 24px;border-radius:8px;` +
        `text-decoration:none;display:inline-block">Kích hoạt tài khoản</a></p>` +
        `<p style="font-size:14px;color:#8fa3b1">Nếu nút trên không hoạt động, ` +
        `hãy sao chép đường dẫn này vào trình duyệt:<br>${escapeHtml(link)}</p>`,
      text:
        `Chào ${name},\n\n${orgName} đã tạo tài khoản cho bạn trên hệ thống quản lý ` +
        `nghỉ phép. Tại đây bạn có thể gửi đơn xin nghỉ, xem số ngày phép còn lại và ` +
        `theo dõi các ngày lễ sắp tới.\n\nKích hoạt tài khoản:\n${link}\n`,
    };
  }

  return {
    subject: `${orgName} — Activate your leave account`,
    html:
      `<p>Hi ${safeName},</p>` +
      `<p>${safeOrg} has set up your account on the leave management system. ` +
      `You can use it to request leave, check how many days you have left, and ` +
      `see upcoming public holidays.</p>` +
      `<p style="margin:28px 0"><a href="${link}" ` +
      `style="background:#0a2540;color:#ffffff;padding:14px 24px;border-radius:8px;` +
      `text-decoration:none;display:inline-block">Activate your account</a></p>` +
      `<p style="font-size:14px;color:#8fa3b1">If the button does not work, copy ` +
      `this link into your browser:<br>${escapeHtml(link)}</p>`,
    text:
      `Hi ${name},\n\n${orgName} has set up your account on the leave management ` +
      `system. You can use it to request leave, check how many days you have left, ` +
      `and see upcoming public holidays.\n\nActivate your account:\n${link}\n`,
  };
}

/**
 * Called from the auth callback once someone signs in: link the auth user to
 * their employee row and flip `invited` to `active`.
 *
 * Idempotent, and safe for a non-employee to hit — it simply finds nothing.
 */
export async function acceptInviteForUser(
  authUserId: string,
  email: string
): Promise<HrEmployee | null> {
  const service = hrServiceClient();

  const { data } = await service
    .from("hr_employees")
    .select("id, status, auth_user_id")
    .or(`auth_user_id.eq.${authUserId},email.ilike.${email.toLowerCase()}`)
    .neq("status", "deactivated")
    .maybeSingle();

  const row = data as { id: string; status: string; auth_user_id: string | null } | null;
  if (!row) return null;

  const patch: Record<string, unknown> = {};
  if (row.auth_user_id !== authUserId) patch.auth_user_id = authUserId;
  if (row.status === "invited") {
    patch.status = "active";
    patch.invite_accepted_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) return getEmployee(row.id);

  const { error } = await service.from("hr_employees").update(patch).eq("id", row.id);
  if (error) {
    console.error("[hr/invites] accept failed:", error.message);
    return null;
  }
  return getEmployee(row.id);
}
