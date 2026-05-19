# Naive Tester Remediation — lingo-pure-ai

**Source report:** `C:\Users\denni\naive-tester-reports\2026-05-19-1711\lingo-pure-ai.md`
**Tester:** Megumi, CPO, multinational manufacturer (~430 heads VN+PH) — 18 minutes on site
**Date generated:** 2026-05-19
**Status of this document:** Plan only — no fixes executed.

---

## 1. Summary of tester verdict

The hero copy and the named integrations (TrackTest, ClassIn) land cleanly with the target buyer persona. Strategy on the homepage is "the right copy" for an HR/CPO buyer. The CPO walked away on conversion because **the primary "Get started" CTA bounces off-domain into an unrelated Vercel project** (`f2-k-fund-tokenisation-admin-consol.vercel.app/login`, then a 429 rate-limit), and because **there is no public-facing employer/pricing surface** that lets a procurement-conscious evaluator put a number in front of their COO.

Net conversion from the walkthrough: **0%**. The cause is one fatal trust break at the first interaction + a missing buyer-side page; neither is a deep product gap.

---

## 2. Findings validation (against the repo)

| Tester finding | Validated against repo | Verdict |
|---|---|---|
| Hero copy strong ("Close your team's English gap, and prove it") | `src/app/page.tsx` lines 37–40 render `t("home.headline")` + `t("home.lead")` | Confirmed — keep |
| Three-pillar block names Voice Discovery / ClassIn / TrackTest credibly | `src/app/page.tsx` lines 57–73 — three `FeatureCard`s with exactly those titles | Confirmed — keep |
| "Strategic Demo" framing dominates / footer one-liner | `src/app/page.tsx` line 78: `LingoPure · Strategic Platform Demo · 2026` | Confirmed — separate fix (tracked here as observation, not in scope of this remediation) |
| Mobile rendering clean at 375px | Hero uses `text-5xl md:text-6xl`, pillar grid `grid-cols-1 md:grid-cols-3` | Confirmed — keep |
| "Get started" CTA goes to `/signup` | `src/app/page.tsx` line 43: `<Link href="/signup">` | **Local code is correct.** The off-domain bounce reported by the tester is a deployment-level routing/alias collision, not a source-code defect |
| `/signup` and `/login` route to LingoPure pages | `src/app/(auth)/signup/page.tsx` and `src/app/(auth)/login/page.tsx` exist and render LingoPure auth forms | Confirmed local — production routing is the issue, not the code |
| `/employer` only reachable via login | `src/app/employer/` has only `(authed)/*` pages + `/employer/login` — no public landing | Confirmed |
| `/pricing` returns 404 | No `src/app/pricing/` directory exists | Confirmed |
| Routing bleed to `f2-k-fund-tokenisation-admin-consol.vercel.app` and `aiftis-demo.vercel.app` | Cannot validate from this repo — cross-project Vercel alias issue | Confirmed at the deployment layer; outside this repo |

Conclusion: every tester observation is reproducible against the repo. The high-value remediation items are local to this repo even when the **root cause** of a symptom (e.g. the routing bleed) lives elsewhere.

---

## 3. What this document covers vs defers

| Item | In scope here | Why |
|---|---|---|
| Routing bleed (`/signup` → `f2k-fund-tokenisation-admin-consol`, `/admin` → `aiftis-demo`) | **Deferred** | Per task brief. Root cause is a Vercel-project alias collision under the shared CAS Vercel account; fix is at the deployment layer, not in this repo. Tracked separately. |
| "Get started" CTA destination | **In scope** | Even though the bounce symptom is deployment-side, the CTA *target* is a local-repo concern. We verify the href is correct, document the contract, and add a deployment smoke-check step so the next deploy of this repo cannot regress on it. |
| Public `/employer` page with price band | **In scope** | Pure page work, fully owned by this repo. Single biggest conversion lift Megumi identified. |
| `/pricing` 404 | **In scope (lightweight)** | Either build `/pricing` or route it to `/employer#pricing`. Either way it's a local fix. |
| "Strategic Demo" banner / footer ambiguity / entity disclosure | **Out of scope** | Flagged by tester; tracked as separate trust-signal work. |
| Cohort dashboard screenshot, CEFR before/after, six-dimension rubric explainer, walkthrough video | **Out of scope** | Belongs on the `/employer` page added here, but the asset production (real cohort data, screenshots, Loom) is a separate workstream. This plan defines the *page* and leaves slots; assets land in a follow-up. |

---

## 4. Critical: "Get started" CTA — confirm and lock down

### Current state in the repo

- `src/app/page.tsx` line 42–47: primary CTA renders as `<Link href="/signup" …>`. Secondary CTA at line 48–53: `<Link href="/login" …>`. Header signup button at line 22–27: also `/signup`. **All three are relative paths to LingoPure pages.** No off-domain redirect anywhere in `page.tsx`, `next.config.ts`, the auth layout, or `src/lib/supabase/middleware.ts`.
- `src/app/(auth)/signup/page.tsx` exists and renders the LingoPure signup form. `src/app/(auth)/login/page.tsx` exists and renders the LingoPure login form (with magic-link request block per the auth-pattern global rule). Both are correct.
- `src/lib/supabase/middleware.ts` protects `/dashboard`, `/onboarding`, `/classroom`, `/profile`, `/lessons`, `/exam`, `/employer` — and on missing Supabase env vars, bounces to `/login` with an error param. It does NOT redirect off-domain under any code path.

### Verdict on the CTA href

**The href is already correct in source code: `/signup`.** No code change is required for the *target*. The Megumi-reported bounce to `f2k-fund-tokenisation-admin-consol.vercel.app` is happening at the Vercel routing layer (project alias collision under the shared CAS account), not in this repo's code.

### What we DO want to lock down locally

Because the symptom is severe and conversion-fatal, defend against three regression vectors at the source-code layer:

1. **CTA href contract test.** Add a small unit/integration test asserting that the rendered homepage CTA `href` is exactly `/signup` (not `https://…`, not `/somewhere-else`). If a future edit accidentally hardcodes an absolute URL to a wrong host, the test fails before deploy. Test file slot: `tests/landing-ctas.test.tsx` (or the project's existing test convention — confirm with `package.json` scripts before placing).
2. **Post-deploy smoke probe.** Extend (or add) a probe script that, on each deploy, hits `/signup` and `/login` on the production hostname and asserts the response stays on `lingo-pure-ai.vercel.app` (or whatever the canonical host is) — i.e. the final URL after redirects must still be the LingoPure host. The pattern used by `scripts/probe-discovery-prod.ts` (referenced in the prior session context) is a fine template.
3. **Document the canonical hostname.** Add a `CANONICAL_HOST` constant or env var (e.g. `NEXT_PUBLIC_CANONICAL_HOST=https://lingo-pure-ai.vercel.app`) so the smoke probe has a single source of truth. The footer can also reference this for the "Visit the real LingoPure" link disambiguation that the tester flagged (out of scope here, but the constant pays for itself twice).

### Why this matters even though the root cause is deployment-side

The next time someone redeploys this repo, the Vercel routing collision might be cleared *or* might reassert itself. A passing smoke test on the production URL after each deploy is the only reliable way to know which side of the wall we landed on. Treating "the code is fine, the deployment is broken" as "no work needed in this repo" is exactly the failure mode that lets the regression sit for weeks.

### Acceptance criteria for the CTA item

- Test asserts `getByRole('link', { name: /get started/i }).href` ends with `/signup` on the landing page.
- Post-deploy probe hits the production homepage, follows the CTA, and asserts final URL hostname matches `CANONICAL_HOST`.
- Probe is wired into the deploy pipeline (or at minimum runnable as `npm run probe:prod` with the deployment URL).
- Manual verification step recorded in `docs/integration-status.md` (or equivalent) noting that after the deployment-layer alias fix lands, this probe confirms the local CTA target is intact.

---

## 5. High: publish a public `/employer` page with a price band

### Why

This is the single highest-leverage page Megumi called out. Three of six tools she's bought published this surface; three did not, and she bought none of the three that didn't. The page converts a CPO from "demo I can't use" into "demo I can show my COO" in one visit. No real product work is required to publish it — only marketing-grade copy and one number.

### Page contract

Route: `/employer` (publicly reachable — bypass the existing `/employer` middleware gate by using `/employer/(public)/page.tsx` route group, or move the gated routes to `/employer/admin/*` and free up `/employer` itself, or add `/employer` as an explicit public segment in `PROTECTED_PREFIXES` exemption logic). The cleanest of these three is a new route group for the public marketing page that sits at `/employer` — keeping authed admin pages where they are.

Required content (in this order, top to bottom):

1. **Explanatory header (NON-NEGOTIABLE per global rule).** 1–3 sentences answering: *What is this? What does the buyer do here? Why does it matter?* Example draft:
   > **For employers.** A measurable English-training programme for distributed teams, billed per learner per month. Move your cohort from CEFR A2 to B2 with a six-dimension gap score that updates after every lesson — and a TrackTest CEFR certificate at the end of the programme.
2. **Buyer-surface hero block.** One sentence on the procurement question ("How do you prove the spend moved the needle?"), then a CTA pair: "Book a 15-minute walkthrough" (primary) + "See sample cohort report" (secondary, links to a PDF or sample dashboard image).
3. **Price band.** Single tile or three-tier card with at minimum a **per-learner-per-month** number band. Acceptable forms (pick one — decision needed before publish):
   - "From $X / learner / month at 100+ seats. Talk to us for >250 seats."
   - Three tiers (Starter / Cohort / Enterprise) with seat counts and per-seat rates.
   - "From $X per learner per month — full pricing on request."
   The tester's hard stop was *no number anywhere*. Any number with a stated band is acceptable; absence is not.
4. **What HR sees.** Annotated cohort-dashboard screenshot (or, until the real screenshot is ready, a labelled illustrative mockup explicitly marked "Illustrative — pilot dashboard"). Show: CEFR distribution at start, midpoint, end; n; attrition; average hours engaged.
5. **The six-dimension rubric, named.** One-line definition for each of the six dimensions (Pronunciation / Intonation / Lexical range / Grammatical accuracy / Discourse / Fluency — or whatever the actual rubric is; confirm against `src/lib/scoring/rubric.ts` before writing copy). This converts the marketing claim "six-dimension gap score" into a credible procurement input.
6. **CEFR before/after evidence slot.** If a real pilot cohort exists, anonymised distribution chart. If none yet, an honest "Pilot cohorts in progress — sample report on request" block. Do NOT fabricate.
7. **Escalation logic in plain English.** Two sentences: when a learner stops engaging, what happens. (Email to learner, email to line manager, CC HR, auto-deactivate seat after N days — confirm against `src/lib/nudges/rules.ts` before writing copy.)
8. **TrackTest + ClassIn trust line.** One sentence each on what each does and why they're named — converts the homepage badges into procurement-grade context.
9. **CTA repeat at bottom.** Same primary/secondary as the top.

### Source data to lift from the codebase (don't reinvent)

- Six-dimension rubric definitions: `src/lib/scoring/rubric.ts` and `src/lib/scoring/session-rubric.ts`
- Escalation cadence: `src/lib/nudges/rules.ts` and `src/lib/nudges/email.ts`
- ClassIn integration scope: `src/lib/classin/embed.ts` (what the embedded classroom actually does)
- TrackTest certification scope: `src/lib/tracktest/eligibility.ts` and `src/lib/tracktest/sso.ts`

Reading these before writing copy avoids the marketing-claim-vs-actual-behaviour mismatch that triggers procurement red flags.

### Responsive requirement (NON-NEGOTIABLE)

Per the global responsive rule: page must work at ≤414px (Megumi explicitly checked iPhone-sized viewport on the homepage), through tablet, up to ≥1280px laptop. Tier cards stack vertically below `md:`. Dashboard screenshot uses `max-w-full` and the responsive image pattern.

### Acceptance criteria for the `/employer` item

- `GET /employer` returns 200 without auth on the canonical production host.
- Page renders an explanatory header at the top, a price band, and the six-dimension rubric named.
- Mobile (375px) renders single column, all CTAs reachable with thumb.
- All links resolve on the LingoPure host (re-runs the smoke probe from §4 against `/employer`).
- Page is linked from the homepage — at minimum a "For employers →" link in the header nav or near the hero.

---

## 6. Lightweight: `/pricing` 404 fix

Two acceptable resolutions, decision needed before implementation:

- **A:** Build a thin `/pricing` page that re-uses the price-band block from `/employer` (and links onward to `/employer` for the full buyer story). Lower-effort if the price band is already a component.
- **B:** Add a `redirect` rule for `/pricing → /employer#pricing` in `next.config.ts`. Acceptable if the price block on `/employer` has an `id="pricing"` anchor. Cleaner if we don't want two surfaces drifting.

Default recommendation: **Option B** — single source of truth, no copy drift. Add the anchor on the `/employer` price block and a `redirects()` entry in `next.config.ts`.

### Acceptance criteria

- `GET /pricing` returns either a 200 page or a 308 redirect to `/employer#pricing`.
- Anchor target exists and scrolls to the price band.

---

## 7. Sequencing and effort

| Step | Owner | Effort | Blocks next? |
|---|---|---|---|
| 1. Decide price-band number(s) | Product | 30 min (decision, not work) | Yes — blocks page copy |
| 2. Confirm six-dimension rubric labels against `src/lib/scoring/rubric.ts` | Eng | 15 min | Blocks page copy |
| 3. Build public `/employer` page route + content | Eng | 4–6 hr | Blocks /pricing redirect anchor |
| 4. Add `/pricing` redirect to `next.config.ts` | Eng | 10 min | No |
| 5. Add landing CTA href contract test | Eng | 30 min | No |
| 6. Add post-deploy smoke probe asserting CTA stays on canonical host | Eng | 1 hr | No |
| 7. Link `/employer` from the homepage header | Eng | 15 min | No |
| 8. Deploy + run smoke probe + capture before/after screenshots | Eng | 30 min | Yes — gates "done" |
| 9. Re-test as Megumi (or run `/naive-tester` again) | QA | 30 min | Yes — gates "done" |

**Total focused work:** ~7–9 hours of engineering once the price-band decision is made. Two-day push as Megumi predicted ("a focused two-day push fills every gap").

---

## 8. Deferred work (logged here so it isn't lost)

1. **Routing bleed at the Vercel layer.** `/signup`, `/login`, `/admin` bouncing off-domain. Root cause: Vercel project alias collision under the shared CAS account. Fix lives in Vercel project configuration, not this repo. Out of scope of this remediation. Tracked separately — note in cross-project memory once the bootstrap automation owner triages it.
2. **"Strategic Demo" banner / footer ambiguity.** Tester flagged trademark-risk perception. Either disambiguate the relationship to `lingopure.com` in one sentence near the banner, or remove the banner entirely if the product is no longer positioned as a demo. Decision needed at product/legal level before any code change.
3. **Entity name + contact in footer.** B2B procurement blocker. Add company name, address, contact email, privacy link. ~30 min once the entity decision is made (LingoPure entity vs CAS umbrella vs other).
4. **Cohort dashboard screenshot / pilot CEFR data / walkthrough Loom.** Asset production. Belongs on the `/employer` page slots defined in §5, lands in a follow-up workstream once real pilot data exists.

---

## 9. Definition of done

This remediation is complete when:

- Public `/employer` page is live with an explanatory header, a price band, and the six-dimension rubric named, on the canonical LingoPure host.
- `/pricing` resolves (either a page or a redirect to `/employer#pricing`).
- Landing CTA href contract test passes in CI.
- Post-deploy smoke probe asserts `/`, `/signup`, `/login`, and `/employer` all resolve on `CANONICAL_HOST` (no off-domain bounce).
- A re-run of `/naive-tester` against the production URL no longer reports "the CTA goes nowhere" or "no price anywhere" as blockers.
- This document is referenced from `docs/integration-status.md` or the project state file so the next session knows the routing-bleed item is deferred (not forgotten).

---

*Generated as part of the 2026-05-19 naive-tester remediation pass. No fixes executed in this document — plan only.*
