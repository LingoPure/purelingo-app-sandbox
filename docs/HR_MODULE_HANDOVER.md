# HR & Leave module — handover manifest

**What this is.** The exact procedure for lifting the HR module out of this repo
and into LingoPure's own. Written to be followed by someone who did not build it.

**The claim it makes:** every file below moves unchanged, one file is rewritten,
and nothing else needs editing. That claim is not a hope — `npm run test:hr:lift`
proves it on every run by copying the module into an empty scratch project,
replacing that one file, and typechecking. If it ever stops being true the build
goes red here, months before anyone attempts the real handover.

---

## 0. Before you start

This repo is a **build sandbox**. It shares a Supabase project and a deployment
with LingoPure's demo, investor dataroom and marketing site. The HR module was
kept isolated inside it on purpose, and two consequences follow:

- **No real employee data has ever been in this sandbox.** Everything under the
  demo organisation (`0e5f1a10-…-0000000000de`) is invented. The real roster and
  opening balances are loaded only in the destination, after step 6.
- **The destination decides its own data residency.** See §7 — it is the one
  decision that cannot be changed afterwards.

---

## 1. What moves

| Source | Destination | Notes |
|---|---|---|
| `src/lib/hr/**` | `src/lib/hr/**` | 20 files. Everything except `deps.ts` moves unchanged. |
| `src/app/hr/**` | `src/app/hr/**` | 17 files. The authenticated route group. |
| `src/app/api/hr/**` | `src/app/api/hr/**` | The holiday-notice cron. |
| `supabase/migrations/*_hr_*.sql` | the destination's migrations directory | 2 files — see §2 on renumbering. |
| `supabase/rollback/*_hr_*.down.sql` | wherever the destination keeps rollbacks | Never inside `migrations/`; the CLI would apply them. |
| `tests/hr/**` | `tests/hr/**` | Including the SQL verification suites. |
| `scripts/check-hr-portability.mjs` | `scripts/` | Keeps the contract enforced after the move. |
| `scripts/hr-db-verify.sh` | `scripts/` | |
| `scripts/hr-integration-test.sh` | `scripts/` | |
| `scripts/hr-lift-dryrun.sh` | `scripts/` | Still useful — the module may move again. |
| `scripts/hr-seed-demo.ts` | `scripts/` | Demo data only. Do not run it in production. |
| `docs/HR_MODULE_SPEC.md` | `docs/` | |
| `docs/HR_MODULE_QUESTIONS_FOR_THAO.md` | `docs/` | Answers become policy rows, §5. |

**What does NOT move:** anything else in this repo. The module has no foreign
key to a LingoPure table (except `auth.users`), imports nothing from
`src/lib/employer`, `src/lib/classin` or `src/lib/i18n`, and takes no
`@caistech/*` dependency — that last one deliberately, because those live on a
private registry the destination cannot reach.

## 2. Renumbering the migrations

Migrations are named `00NN_hr_MM_<topic>.sql`. The `00NN` prefix belongs to
*this* repo's sequence and will collide in the destination. The `_hr_MM_` part is
the module's own ordering and is what must survive.

Rename the prefix to the next free numbers in the destination, keeping `_hr_MM_`
order intact:

```
0027_hr_01_foundation.sql   ->  <next>_hr_01_foundation.sql
0029_hr_02_calendar.sql     ->  <next+1>_hr_02_calendar.sql
```

⚠️ **Two files must never share a numeric prefix.** The migration history table
keys on that number alone, so a duplicate can never be applied — it fails with
`duplicate key value violates unique constraint "schema_migrations_pkey"` on
every attempt, forever. That is not hypothetical: it is exactly why
`0023_conversation_context_completed.sql` sat unapplied in this repo long enough
for the bug it fixes to stay live in production. Check the destination's
directory before choosing numbers.

Both migrations are idempotent and apply to a completely empty database — no
dependency on any other migration in this repo, including the shared
`update_updated_at()` trigger, which is why the module ships its own
`hr_touch_updated_at()`.

## 3. Rewriting `deps.ts`

**This is the only file you edit.**

`src/lib/hr/deps.ts` is the module's single seam. It re-exports two Supabase
client factories and nothing else. Point them at whatever the destination uses:

```ts
export async function hrUserClient(): Promise<UserClient>   // carries the caller's session — RLS applies
export function hrServiceClient(): ServiceClient            // service role, bypasses RLS
```

Three things that must stay true, because the module's security rests on them:

1. **`hrUserClient` must carry the caller's session.** Every HR read goes through
   it, and the permission model lives in RLS. A service-role client here would
   silently delete the entire permission model while everything appeared to work.
2. **`hrServiceClient` must be server-only.** It bypasses RLS.
3. **Keep `__setHrTestClients` and its guards.** The integration suite needs the
   seam; the guards stop it being reachable in production.

`scripts/hr-lift-dryrun.sh` contains a working reference implementation written
against plain `@supabase/supabase-js`.

## 4. Environment

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | user-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only; never expose |
| `RESEND_API_KEY` | yes | all notifications |
| `HR_EMAIL_FROM` | recommended | defaults to this repo's verified sender — **change it** |
| `HR_EMAIL_POSTAL_ADDRESS` | recommended | identification footer |
| `HR_EMAIL_CONTACT` | recommended | identification footer |
| `HR_PUBLIC_URL` | recommended | absolute links in emails; falls back to `VERCEL_URL` |
| `CRON_SECRET` | yes | authorises manual cron triggers |
| `HR_TEST_HARNESS` | never in production | enables the test seam and suppresses email |

**Supabase Auth** in the destination needs: the app origin in the redirect
allowlist, custom SMTP configured (the built-in mailer is rate-limited to a
couple of messages an hour), and `/auth/callback` reachable — the invite flow
depends on it.

## 5. Wiring into the host app

Three host-app edits, all outside the module:

1. **Route protection.** Add `/hr` to whatever the destination uses for
   session-gated prefixes. In this repo that is `PROTECTED_PREFIXES` in
   `src/lib/supabase/middleware.ts`. Without it, a missing Supabase env renders
   a page that then talks to a null client.
2. **Post-login routing.** `src/app/(auth)/login/actions.ts` sends a signed-in
   user who resolves to an HR employee to `/hr` instead of the host's default
   destination. LingoPure staff are not learners; without it, every sign-in
   after the invitation strands them somewhere meaningless. **On the destination
   subdomain this branch should be deleted** — there, `/login` lands on `/hr`
   unconditionally.
3. **The cron.** Register `/api/hr/cron/holiday-notice` on a daily schedule. In
   this repo that is `vercel.json`. ⚠️ **The route must be excluded from any
   session-refresh middleware.** A middleware redirect on a cron route is not an
   error — nothing throws, nothing logs, the caller follows the 307 to a login
   page, and the job silently never runs. The route carries a
   `@machine-callable` marker and `tests/hr/machine-routes.test.ts` asserts it is
   not captured; keep both.

## 6. Loading the real data

**Only after everything above.** In order:

1. **Confirm the policy.** Every leave rule is a column in `hr_org_policy`,
   currently holding the *recommended defaults* from
   `docs/HR_MODULE_QUESTIONS_FOR_THAO.md` — not confirmed answers. Working
   pattern, accrual, carry-over, over-balance behaviour, notice period,
   self-cancellation. Each is one `UPDATE`. **Getting these wrong miscounts
   people's leave, silently.**
2. **Create the organisation** and its policy row.
3. **Load the roster** (Thao doc F5). Emails, roles, reporting lines.
4. **Load opening balances** (F6) — annual and sick already taken this year —
   with `npm run hr:import-balances`. Skip only if going live on 1 January,
   which is why F7 asks about the date: a January start removes this step
   entirely.
5. **Remove the demo organisation** if it was ever seeded there:
   `npm run hr:seed -- --wipe`.

## 7. Data residency — decide before step 6

Employee sick-leave records are health data. Under Vietnam's personal-data regime
that is sensitive personal data, and storing it outside Vietnam is a
cross-border transfer with its own obligations. **A Supabase project's region
cannot be changed after creation**, so this is a decision, not a setting: making
it before the first row is free, and afterwards it is a migration of live HR
records.

Not legal advice — a question for LingoPure's Vietnamese counsel. Flagged here
because the cheap moment to ask is now.

## 8. Verifying the move

Run all five in the destination. Each is independent.

```bash
npm run check:hr              # portability contract — only deps.ts imports outward
npm run test:hr:lift          # the dry-run lift, from the destination this time
npm run test:hr               # 67 unit tests — day count, dates, i18n, guards
npm run test:hr:db            # 32 assertions on a throwaway Postgres
npm run test:hr:integration   # 24 tests against real RLS with real user JWTs
```

Then by hand, because no automated test covers them:

- sign in as each of the three roles and confirm the nav differs
- submit, approve and cancel one request; confirm the balance returns exactly
- confirm the approval email arrives in the recipient's language, not the
  approver's
- open the calendar as a Staff member and confirm no leave reasons are visible

## 9. What is not finished

Stated so it is not discovered later:

- **48 strings remain hardcoded in English** in three Super Admin-only client
  forms (`add-member-form.tsx`, `member-admin.tsx`, `holiday-forms.tsx`). Every
  surface staff or a manager reaches is fully localised.
- **Medical certificate upload is out of scope** by explicit decision. It changes
  the data-protection posture and needs a deliberate yes.
- **Every `hr_org_policy` value is provisional** until Thao confirms — see §6.1.
- **Seniority accrual is not automated.** Vietnamese labour law adds a day per
  five years of service; the schema supports a per-person allowance so it is a
  data question, but nothing computes it.
