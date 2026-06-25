# Testing — LingoPure (auth + QA accounts)

How automated testers (`/naive-tester`, `/qa`, `/voice-auditor`) and humans authenticate
against LingoPure. Closes PRODUCT_STANDARDS gap **G5** for the investor portal; the student +
employer portals are documented as they adopt the same scheme.

> Passwords live in the password manager — **never** committed here or pasted into a report.

---

## Audiences

LingoPure is a multi-audience app (one Supabase project, role by table membership):

| Audience | Entry | Authed home | Role table |
|---|---|---|---|
| Student (end user) | `/login` | `/dashboard` | `students` (auto-created on signup) |
| Employer admin | `/login?redirectTo=/employer` | `/employer` | `employer_admins` |
| **Investor** | `/investor/login` | `/investor/ask` | `investors` (invite-only) |

---

## Investor portal — QA accounts (Phase 3)

Investors are **invite-provisioned** (no open signup). The QA investor reuses the **canonical shared
QA user-agent** (PRODUCT_STANDARDS §9.5) — `QA_TEST_USER_EMAIL` / `QA_TEST_USER_PASSWORD`, which live
in `cais-shared-services/.secrets/qa-secrets.json` (`dennis@factory2key.com.au`). Seed it as a
LingoPure investor with one command (reads the shared password from that file; never prints it):

```bash
node scripts/seed-qa-investor.mjs              # main-tier QA investor (no NDA → main dataroom only)
node scripts/seed-qa-investor.mjs --tier restricted   # pre-granted deep-dive, to test restricted retrieval
```

This makes `dennis@factory2key.com.au` (the canonical `QA_TEST_USER_*`) an active investor with its
password synced to the shared QA password — so testers/CI use the **same creds as every other repo**.
(`scripts/invite-investor.mjs` remains for provisioning *real* investors by email / magic-link.)

### Mode A — type the real login form (default; also tests the auth path)
1. Go to `/investor/login`.
2. Enter `QA_TEST_USER_EMAIL` + password (testers **type**, never DOM-inject — React ignores injected values).
3. Land on `/investor/ask`.

### Mode B — inject a real session cookie (skip the flaky form for deep surface testing)
Use the shared session-minter (consume, don't fork):
```bash
node ../cais-shared-services/scripts/qa-session.mjs --url "$NEXT_PUBLIC_SUPABASE_URL" \
  --email "$QA_TEST_USER_EMAIL" --password "$QA_TEST_USER_PASSWORD"
# emits the @supabase/ssr cookie (auto-matched to the installed @supabase/ssr major).
```
Set that cookie on the browser context, then navigate to `/investor/ask`.

> **/browse caveat:** the headless `/browse` renderer can crash hydrating heavy Next pages
> (memory `reference_browse_headless_renderer_crash`). Use a **headed** browser for naive-tester on
> the investor portal.

### What the investor QA pass must assert
- `/investor/login` → sign in → reaches **`/investor/ask`** (a real user home, distinct from `/admin`/`/employer`) — guards the §8.5 facade (#43).
- A non-investor user (a plain student account) hitting `/investor/ask` is **redirected away** (no `investors` row).
- `/api/investor/ask` returns a cited answer; main-tier sees **only main** sources.
- The NDA gate: `/investor/nda` → accept → tier flips to `restricted` → deep-dive sources now appear.

---

## Programmatic verification (no browser)

- `node scripts/retrieval-test.mjs` — index state + cited retrieval + tier-gate (zero restricted leak on main-only).
- `node scripts/answer-test.mjs "question" [tiers]` — the Phase-2 answer core (grounded, cited) on the live index.

---

## Pending (other audiences / later phases)
- Student + employer QA accounts under the same `QA_TEST_*` scheme (when those flows are next touched).
- `QA_TEST_ADMIN_EMAIL` / `_PASSWORD` for an operator-admin agent once the investor grant-admin UI lands (Phase 3b).
- Vercel preview deploys: add a Protection-Bypass-for-Automation token if deployment protection is on.
