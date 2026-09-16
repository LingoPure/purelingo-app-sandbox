# Resend email domain verification — handoff to Thao

Target: verify `lingopure.com` in the **applingopure** Resend team so emails can send as `LingoPure <noreply@lingopure.com>`.

DNS for `lingopure.com` is hosted on **Wix** (`ns0.wixdns.net` / `ns1.wixdns.net`). Existing root MX (my.mailbux.com) and root SPF (mailwish + mailbux) stay untouched — the Resend records use the `send.lingopure.com` return-path subdomain, so nothing existing is disturbed.

## Step 1 — Add the domain in Resend

1. Log in to https://resend.com/domains (the **applingopure** team).
2. **Add Domain** → type `lingopure.com`.
3. Region: **us-east-1** (default). Leave Return-Path at the default (`send.lingopure.com`).
4. **Do NOT** toggle "Receiving" (it would hijack the root domain's existing mail — we only send).

## Step 2 — Add the 3 DNS records

Open the **Records** tab for the domain in Resend, and add the records shown there into Wix DNS (Domains → your domain → DNS Records). Copy-paste exactly, omit the `.lingopure.com` suffix, and do not use Wix's proxy setting for these records.

| Type | Host | Value |
|---|---|---|
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (priority `10`) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `_resend._domainkey` | paste the key Resend shows (takes a unique `p=...` value) |

## Step 3 — Verify

1. In Resend, click **Verify DNS Records**.
2. Normally green in ~15 min (can take up to 72h). Status should become **Verified** (all 3 records ticked).

## After verification

Nothing else needed on the LingoPure side — already wired:

- `RESEND_API_KEY` set in the app + Supabase Auth SMTP (`smtp.resend.com:465`, user `resend`).
- Sender is `LingoPure <noreply@lingopure.com>` (from-address flipped from the old `updates.corporateaisolutions.com` in all email modules).

Ping Dennis when the status shows **Verified** and a signup-confirmation email will be smoke-tested.