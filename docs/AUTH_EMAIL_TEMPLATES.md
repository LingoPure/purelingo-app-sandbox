# Supabase Auth Email Templates — paste-ready (token_hash form)

**Status:** required fix. Without this, **every self-service email link dead-ends
on `/login?error=Missing verification code`.**

## Why

LingoPure issues its self-service emails with `createOtpIssuerClient()`
(`src/lib/supabase/otp.ts`), which sets `flowType: "implicit"`. Under implicit
flow Supabase's `/auth/v1/verify` returns the session in the URL **fragment**
(`#access_token=…`). `/auth/callback` is a **server** route, and a fragment is
never sent to the server — so it sees neither `?code=` nor `?token_hash=`, and
falls through to `Missing+verification+code` (`src/app/auth/callback/route.ts:100`).

The canonical portfolio pattern (`reference_auth_email_token_hash_canon`) is the
**self-contained `token_hash` form**, which `verifyOtp` exchanges with no
client-side state and therefore works on any device / browser / domain:

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<type>&next=<path>
```

> The shared `cais-shared-services/scripts/configure-email-templates.sh` still
> emits `{{ .ConfirmationURL }}` (PKCE-oriented) and must **not** be used for
> LingoPure — under the implicit issuer it produces the broken fragment link.

## Preconditions (already satisfied in this project)

- `auth.site_url` = `https://purelingo-app-sandbox.vercel.app` (dashboard-only).
- `auth.additional_redirect_urls` includes `…vercel.app/**` and `localhost:3000/**`.
- `src/app/auth/callback/route.ts` handles `?token_hash=&type=` (verifyOtp) —
  it does. A PKCE-only callback would break these links; retrofit the callback
  **first** if you ever replace it.

## How to apply

Supabase Dashboard → **Authentication → Email Templates**, set each of the five
below (Subject + Message body), then Save. Then re-test a *fresh* signup.

---

## 1. Confirm signup

**Subject**

```
Confirm your email address — LingoPure
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f3f6fb; margin:0; padding:32px 16px; color:#0a2540;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #ede8dc;">
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:600;line-height:1;margin:0 0 4px;color:#0a2540;">LingoPure</div>
          <div style="font-size:11px;color:#8a94a6;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 28px;">AI language learning</div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#0a2540;line-height:1.3;">Confirm your email address</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">Tap the button to confirm your email address and finish creating your LingoPure account.</p>
          <p style="margin:0 0 28px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">Confirm email address</a>
          </p>
          <p style="font-size:13px;color:#8a94a6;line-height:1.5;margin:0 0 24px;">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4a5568;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding</span></p>
          <hr style="border:none;border-top:1px solid #ede8dc;margin:0 0 20px;">
          <p style="font-size:12px;color:#8a94a6;line-height:1.5;margin:0;">You're receiving this because someone signed up for a LingoPure account with this email address. If that wasn't you, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Magic link / OTP

**Subject**

```
Your LingoPure sign-in link
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f3f6fb; margin:0; padding:32px 16px; color:#0a2540;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #ede8dc;">
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:600;line-height:1;margin:0 0 4px;color:#0a2540;">LingoPure</div>
          <div style="font-size:11px;color:#8a94a6;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 28px;">AI language learning</div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#0a2540;line-height:1.3;">Sign in to LingoPure</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">Tap the button below to sign in. This link works on any device and expires shortly, so use it now.</p>
          <p style="margin:0 0 28px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">Sign in to LingoPure</a>
          </p>
          <p style="font-size:13px;color:#8a94a6;line-height:1.5;margin:0 0 24px;">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4a5568;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard</span></p>
          <hr style="border:none;border-top:1px solid #ede8dc;margin:0 0 20px;">
          <p style="font-size:12px;color:#8a94a6;line-height:1.5;margin:0;">You're receiving this because someone requested a sign-in link for this email address. If that wasn't you, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3. Reset password (recovery)

**Subject**

```
Reset your LingoPure password
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f3f6fb; margin:0; padding:32px 16px; color:#0a2540;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #ede8dc;">
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:600;line-height:1;margin:0 0 4px;color:#0a2540;">LingoPure</div>
          <div style="font-size:11px;color:#8a94a6;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 28px;">AI language learning</div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#0a2540;line-height:1.3;">Reset your password</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">Tap the button below to choose a new password. If you didn't request this, you can ignore this email and your password will stay the same.</p>
          <p style="margin:0 0 28px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">Reset password</a>
          </p>
          <p style="font-size:13px;color:#8a94a6;line-height:1.5;margin:0 0 24px;">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4a5568;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password</span></p>
          <hr style="border:none;border-top:1px solid #ede8dc;margin:0 0 20px;">
          <p style="font-size:12px;color:#8a94a6;line-height:1.5;margin:0;">You're receiving this because someone requested a password reset for this email address. If that wasn't you, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 4. Invite

> **Not used by the app.** LingoPure sends invites itself via
> `admin.generateLink()` + Resend (`src/lib/org/service.ts:532`), already in the
> token_hash form. Set this template anyway so an invite triggered from the
> Supabase dashboard isn't broken.

**Subject**

```
You've been invited to LingoPure
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f3f6fb; margin:0; padding:32px 16px; color:#0a2540;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #ede8dc;">
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:600;line-height:1;margin:0 0 4px;color:#0a2540;">LingoPure</div>
          <div style="font-size:11px;color:#8a94a6;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 28px;">AI language learning</div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#0a2540;line-height:1.3;">You've been invited</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">You've been invited to join LingoPure. Accept the invitation to set up your account and get started.</p>
          <p style="margin:0 0 28px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/onboarding" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">Accept invitation</a>
          </p>
          <p style="font-size:13px;color:#8a94a6;line-height:1.5;margin:0 0 24px;">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4a5568;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/onboarding</span></p>
          <hr style="border:none;border-top:1px solid #ede8dc;margin:0 0 20px;">
          <p style="font-size:12px;color:#8a94a6;line-height:1.5;margin:0;">You're receiving this because someone invited this email address to LingoPure. If that wasn't you, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 5. Change email address

> **Not used by the app** (no change-email flow). Set it anyway so a
> dashboard-triggered change isn't broken.

**Subject**

```
Confirm your new email — LingoPure
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f3f6fb; margin:0; padding:32px 16px; color:#0a2540;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #ede8dc;">
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:600;line-height:1;margin:0 0 4px;color:#0a2540;">LingoPure</div>
          <div style="font-size:11px;color:#8a94a6;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 28px;">AI language learning</div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#0a2540;line-height:1.3;">Confirm your new email</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">Tap the button below to confirm this as your new LingoPure email address.</p>
          <p style="margin:0 0 28px;">
            <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">Confirm new email</a>
          </p>
          <p style="font-size:13px;color:#8a94a6;line-height:1.5;margin:0 0 24px;">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4a5568;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings</span></p>
          <hr style="border:none;border-top:1px solid #ede8dc;margin:0 0 20px;">
          <p style="font-size:12px;color:#8a94a6;line-height:1.5;margin:0;">You're receiving this because someone requested an email change for this address. If that wasn't you, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## Verification

1. Sign up with a **fresh** address.
2. In the email, confirm the link shape is
   `https://purelingo-app-sandbox.vercel.app/auth/callback?token_hash=…&type=signup&next=/onboarding`
   (it must **not** be `https://<ref>.supabase.co/auth/v1/verify?token=…`).
3. Click it → you should land on `/onboarding` **already signed in**.
4. Repeat for a magic link (→ `/dashboard`) and a password reset
   (→ `/reset-password`).

## Known limitation — investor magic link

Because `{{ .SiteURL }}` is self-contained, the `next` in each template is
**static**. The investor magic-link actions pass a dynamic
`emailRedirectTo=…?next=/investor/ask`, which these templates ignore, so an
investor arriving by magic link lands on `/dashboard` instead of `/investor/ask`.

Investor **password** login is unaffected (it redirects directly via
`investorLogin`, not through the callback). To route investor magic links
correctly, either drop `investorMagicLink`, or teach
`src/app/auth/callback/route.ts` `postAuthTarget()` to detect investor
membership when `next` is absent.
