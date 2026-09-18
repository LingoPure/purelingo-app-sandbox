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

## Brand tokens

| Token | Value | Use |
|---|---|---|
| Navy | `#0a2540` | wordmark, headings, primary button |
| Gold | `#c8973a` | the dot in the `LingoPure.` wordmark |
| Ink | `#14171c` | headings |
| Body | `#52565f` | paragraph text |
| Muted | `#8a8f99` | fallback link label, footer |
| Border | `#e6e8ee` | card border, rules |
| Page bg | `#f6f7f9` | behind the card |
| Button text | `#ffffff` | on navy |

The wordmark is `LingoPure` + a gold `.` — never a blue/navy two-tone.

## Preconditions (already satisfied in this project)

- `auth.site_url` = `https://purelingo-app-sandbox.vercel.app` (dashboard-only).
- `auth.additional_redirect_urls` includes `…vercel.app/**` and `localhost:3000/**`.
- `src/app/auth/callback/route.ts` handles `?token_hash=&type=` (verifyOtp) —
  it does. A PKCE-only callback would break these links; retrofit the callback
  **first** if you ever replace it.

## How to apply

Supabase Dashboard → **Authentication → Email Templates**, set each of the five
below (Subject + Message body), then Save. Re-test a *fresh* signup.

Every body is the same card; only the **headline, intro, CTA label, footer note,
`type` and `next`** change. Replace the two `LINK` occurrences per template —
the button `href` **and** the plain-text fallback — with the template's URL.

---

## 1. Confirm signup

**Subject**

```
Confirm your email address — LingoPure
```

**URL (both occurrences)**

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirm your LingoPure account</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e6e8ee;border-radius:12px;">
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#0a2540;">LingoPure<span style="color:#c8973a;">.</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14171c;">Confirm your email address</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#52565f;">Tap the button to confirm your email address and finish creating your LingoPure account.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background:#0a2540;">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Confirm email address</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#8a8f99;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#52565f;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding</p>
              <hr style="border:none;border-top:1px solid #e6e8ee;margin:0 0 20px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">You're receiving this because someone signed up for a LingoPure account with this email address. If that wasn't you, you can safely ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8f9fb;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">Powered by LingoPure — the AI language learning partner your team deserves.</p>
            </td>
          </tr>
        </table>
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

**URL (both occurrences)**

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your LingoPure sign-in link</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e6e8ee;border-radius:12px;">
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#0a2540;">LingoPure<span style="color:#c8973a;">.</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14171c;">Sign in to LingoPure</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#52565f;">Tap the button below to sign in. This link works on any device and expires shortly, so use it now.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background:#0a2540;">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to LingoPure</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#8a8f99;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#52565f;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard</p>
              <hr style="border:none;border-top:1px solid #e6e8ee;margin:0 0 20px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">You're receiving this because someone requested a sign-in link for this email address. If that wasn't you, you can safely ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8f9fb;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">Powered by LingoPure — the AI language learning partner your team deserves.</p>
            </td>
          </tr>
        </table>
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

**URL (both occurrences)**

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reset your LingoPure password</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e6e8ee;border-radius:12px;">
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#0a2540;">LingoPure<span style="color:#c8973a;">.</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14171c;">Reset your password</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#52565f;">Tap the button below to choose a new password. If you didn't request this, you can ignore this email and your password will stay the same.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background:#0a2540;">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#8a8f99;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#52565f;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password</p>
              <hr style="border:none;border-top:1px solid #e6e8ee;margin:0 0 20px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">You're receiving this because someone requested a password reset for this email address. If that wasn't you, you can safely ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8f9fb;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">Powered by LingoPure — the AI language learning partner your team deserves.</p>
            </td>
          </tr>
        </table>
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

**URL (both occurrences)**

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/onboarding
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>You've been invited to LingoPure</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e6e8ee;border-radius:12px;">
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#0a2540;">LingoPure<span style="color:#c8973a;">.</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14171c;">You've been invited</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#52565f;">You've been invited to join LingoPure. Accept the invitation to set up your account and get started.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background:#0a2540;">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/onboarding" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Accept invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#8a8f99;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#52565f;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/onboarding</p>
              <hr style="border:none;border-top:1px solid #e6e8ee;margin:0 0 20px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">You're receiving this because someone invited this email address to LingoPure. If that wasn't you, you can safely ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8f9fb;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">Powered by LingoPure — the AI language learning partner your team deserves.</p>
            </td>
          </tr>
        </table>
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

**URL (both occurrences)**

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings
```

**Message body**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirm your new email — LingoPure</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e6e8ee;border-radius:12px;">
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#0a2540;">LingoPure<span style="color:#c8973a;">.</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14171c;">Confirm your new email</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:#52565f;">Tap the button below to confirm this as your new LingoPure email address.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background:#0a2540;">
                    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Confirm new email</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#8a8f99;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#52565f;">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings</p>
              <hr style="border:none;border-top:1px solid #e6e8ee;margin:0 0 20px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">You're receiving this because someone requested an email change for this address. If that wasn't you, you can safely ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8f9fb;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f99;">Powered by LingoPure — the AI language learning partner your team deserves.</p>
            </td>
          </tr>
        </table>
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
