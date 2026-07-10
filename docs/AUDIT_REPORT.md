# AUDIT_REPORT.md — Admin Backend & ClassIn (Phase A)

**Repo:** `lingo-pure-ai` · **Date:** 10 July 2026 · **Phase A only — nothing scaffolded, no migrations, no files created beyond this report.**
Sources for A5 docs: [ClassIn API — EEO Docs](https://docs.eeo.cn/api/en/), [ClassIn LTI](https://www.classin.com/lti/), [ClassIn SDK](https://www.classin.com/sdk/), plus the ClassIn User Agreement + Privacy Policy reviewed earlier this session.

---

## 1. Assumptions tested

1. **"There is no admin backend in this repo."** — **Partially refuted.** There is **no marketing-content CMS / no-deploy content editor**, but two *domain* admin surfaces exist and are wired: the **employer cohort admin** (`employer_admins`, `/employer/(authed)/*`) and the **investor dataroom admin console** (`/investor/admin/*`), plus a service-role "admin UI" concept for roles/baselines (migration `0010` comment). None of them edits marketing content.
2. **"ClassIn is not integrated and its API surface has not been evaluated."** — **Partially refuted.** ClassIn is **scaffolded in code** (`lib/classin/{embed,token,api}.ts`, three `/api/classin/*` routes, `classin_sessions` table, an embed frame) with a deliberately **locked adapter shape**, but it is **not live**: every network path throws `ClassinUnavailableError` pending EEO credentials. The surface was evaluated at the *assumption* level (guessed host, guessed HMAC signing, guessed endpoints) — **not confirmed against EEO docs**, and the public docs contradict one assumption (see A5).

---

## 2. Findings A1–A7

### A1 — Repo baseline
- **Framework:** Next.js **16.2.4** (App Router, Turbopack), React **19.2.4**.
- **Language:** TypeScript **^5**, effectively full coverage (app, lib, content, scoring, API all `.ts/.tsx`).
- **Styling:** Tailwind **v4** with `@theme` custom-property tokens in `src/app/globals.css` (product app) **plus** a second scoped token block in `src/app/(marketing)/marketing.css` (`.mkt`, marketing pages). See A4.
- **Auth:** **Supabase Auth** (`@supabase/ssr`, email/password + magic link). `students.id` is FK to `auth.users.id`. **No single global role system and no `ADMIN_EMAILS` allowlist in this repo** — authorisation is *contextual*: `employer_admins.admin_role` ∈ {owner, hr, viewer}; investor operator-auth (`lib/investor/operator-auth.ts`) gates the investor admin console; service-role client (`lib/supabase/admin.ts`) for privileged writes.
- **Routes (grouped inventory):**
  - `(marketing)` group — `/` sales-flow homepage; `/for-companies`, `/for-individuals`, `/method`, `/book-a-demo`, `/company` (scaffold holding pages).
  - `/demo` — the original product landing (moved).
  - `(app)` — `/dashboard`, `/lessons`, `/lessons/[id]`, `/onboarding` (+ `/battery`, `/session`), `/settings`.
  - `(auth)` — `/login`, `/signup`, `/forgot-password`, `/reset-password`.
  - **Employer portal** — `/employer/login`, `/employer/(authed)` overview + `departments`, `roles` (+ new/discover/manual/[id]), `staff` (import/invite), `students`(+[id]), `teachers`(+[id]).
  - **Investor dataroom** — `/investor`, `/investor/login`, `/investor/(authed)` ask/documents/explore/nda/reports/settings; **admin console** `/investor/admin/login` + `(console)` overview/access-log/documents/investors/reports.
  - **Delivery** — `/classroom/[sessionId]` (+ `/transcribe`), `/exam/[id]`, `/lci-bridge`, `/languages`.
  - **Marketing/legal (app-styled)** — `/about`, `/contact`, `/pricing`, `/privacy`, `/terms`.
  - **API** — `api/convai/{token,webhook}`, `api/classin/{session-end,sync/[sessionId],sessions}`, `api/scoring/discovery`, `api/certifications/*`, `api/investor/*`, `api/cron/nudges`, `api/interpret`, etc.
- **Deploy:** Vercel (project slug `lingo-pure-ai`). **`NEXT_PUBLIC_CANVAS_MODE` EXISTS** and gates the marketing sales-flow **review canvas** (annotations, Spec/Clean toggle, "not the production site" demobar, empty-section gating). It is currently set to `true` on the deployed canvas.
- **Env vars (from code references — `.env*` was not readable this session, permission-denied):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_CANVAS_MODE`, `CLASSIN_APP_ID`, `CLASSIN_APP_SECRET`, `CLASSIN_EMBED_HOST`, plus ElevenLabs ConvAI, TrackTest and Resend keys.
- **Supabase region:** **Not discoverable from readable repo config** (`.env*` denied). Project ref per prior project notes is `nbvprbaumwmfczsfcyrv`. **Region must be confirmed in the Supabase dashboard — do not assume, do not change.** (This is a live compliance question given the ClassIn PRC-residency issue.)

### A2 — Admin backend: does anything exist?

| Finding | Location | Live / dead / partial | Assessment |
|---|---|---|---|
| Marketing-content CMS / no-deploy copy editor | — | **None** | No CMS dependency (`package.json`: no sanity/contentful/payload/strapi/tina/keystone/directus/decap). No `/admin`, `/cms`, `/studio`, `/manage` content route. **All marketing copy is in source files.** |
| Employer cohort admin | `employer_admins` (mig `0012`), `/employer/(authed)/*`, `lib/employer/*` | **Live (domain)** | Manages learners/teachers/roles/staff for a cohort. Roles owner/hr/viewer. Writes service-role; RLS self-select. **Learner data, not content.** |
| Investor dataroom admin console | `/investor/admin/(console)/*`, `lib/investor/operator-auth.ts` (migs `0020–0022`) | **Live (domain)** | Investors, documents, reports, access-log, NDA entitlement. **Confidential domain tool, not content.** |
| Roles/baselines admin UI (service-role) | mig `0010` comment | **Partial/aspirational** | "admin UI hits Supabase via the service-role key, not RLS-bound auth." Concept noted; no dedicated route found. |

**Bottom line:** no surface lets a non-engineer change *marketing content* without a code deploy. That gap is exactly what Phase B targets.

### A3 — Content layer: current state ⚠️ (brief is stale here)
- **`src/content/types.ts` exists but does NOT match the shape the brief describes.** It was refactored in the clean-view work (commit `39086b7`) down to just `BlockStatus` (`'ready' | 'confirm' | 'pending'`) and `Annotation` (`{label, note}`). The `ContentBlock<T> { id, status, annotation, data }` + per-section files (`content/home/hero.ts`, …) model the brief assumes **no longer exists** — those files were deleted.
- **Current content lives in one file: `src/content/home.ts`**, a single typed object with per-section keys. `status` sits on each section's **annotation** object (research status), and draft copy is shown as real text; genuinely-empty items are `EmptySlot`s; empty *sections* are gated out of clean view. Scaffold-page copy is passed as literal props from the route files (`/for-companies` etc.) via `ScaffoldPage`.
- **All content is in SOURCE. None is in the database.** (This is the crux for the Phase B decision — see §4.)
- **Hardcoded user-facing copy in components:** marketing section components are copy-free (read from `home.ts`); the **product app** externalises chrome copy through the i18n dictionary (`t()`), but the *learning content itself* (English is the subject) is intentionally in source. The only literal visitor strings outside `home.ts`/i18n are the scaffold route props (`title`/`intro` in the 5 `(marketing)/*/page.tsx` stubs) and small UI labels. An admin backend cannot edit any of these without a deploy while they remain in source.

### A4 — Design tokens: current state
- **Two token files, one per scope** (not the single file the brief assumes):
  1. `src/app/globals.css` `@theme` — product-app palette (navy/gold/teal/coral/paper/mute/line + mark/mark-bg + fonts).
  2. `src/app/(marketing)/marketing.css` `.mkt { … }` — marketing palette (ink/teal/go/paper/line/muted/mark…) + font-var mapping. **The hex in this file IS the token definition set** (expected), not leakage.
- **Violations (token leakage) — limited to the marketing homepage:** `src/app/(marketing)/page.tsx` has **15 inline `style={{}}` / hex occurrences** carried over from the faithful mockup port — mostly `maxWidth`/`margin` numeric values and section `borderTop: "1px solid var(--line)"`, **plus two literal greys `#7c8f92` and `#9fb4b7`** in the final-CTA microcopy. These are the items Minh must lift into tokens/classes before layering a template. App components use Tailwind token classes (no arbitrary `text-[#…]` found).

### A5 — ClassIn: code + documentation

**Code (in-repo):** **scaffolded, not live.**
- `lib/classin/token.ts` — HMAC-SHA256 SSO signing, explicitly a **placeholder** ("exact algorithm to be confirmed from EEO… when EEO confirms, only this file changes"); reads `CLASSIN_APP_ID`/`CLASSIN_APP_SECRET`.
- `lib/classin/embed.ts` — builds an **iframe URL** against a **guessed host** `https://www.eeo.cn/sdk/classroom` ("exact embed URL pattern… not yet known").
- `lib/classin/api.ts` — `fetchSessionAnalytics()` and `downloadRecording()` both **throw `ClassinUnavailableError`**; the returned *shape* is locked, the body is a TODO(EEO).
- `api/classin/session-end` — stamps `classin_sessions` completed; the analytics/recording/scoring sync is `TODO(step 7b)`.
- Schema: `classin_sessions` (mig `0004`: `recording_url`, `participation_data_json`, `transcribed_at`, `attended`, `duration_mins`); `students.classin_user_id`, `classin_class_id`.

**Documentation (public, `docs.eeo.cn/api/en/` + classin.com):**
1. **SDK embed —** docs expose **"Invoke the ClassIn Client from your System"** and **"Get The login Client Url"**, i.e. **launch/deep-link into the ClassIn client is documented; in-app iframe embedding of a live classroom is *not stated*.** ⚠️ This **contradicts the repo's assumption** (`embed.ts` builds an iframe). Treat in-app embed as unconfirmed/likely-unsupported until EEO confirms.
2. **LTI / analytics API —** endpoints **"Class Detail Data" / "Class Related Data"** exist; the LTI page markets attendance, hand-raising, collected answers, analytics and one-click download. **The structured signal set, granularity (session/learner/event), pull-vs-push and latency are *not stated* on the pages reviewed** — requires the detailed API reference / EEO confirmation.
3. **Recording download / per-speaker —** only **"Get Course Live Replay And Player Address"** (a replay/player URL) is documented. **Whether a download endpoint exists, and critically whether audio is separable per-speaker or only a single mixed classroom track, is NOT documented.** → **This is a Phase-B blocker; requires written confirmation from EEO.** (The repo assumes a single `recordingUrl` — i.e. a mixed track — but this is unconfirmed.)
4. **Enrolment API —** **documented and possible:** `Add/Edit Student`, `Add/Edit Teacher`, `Create Course`, `Create Class (single/multiple)`, `Add Students And Audit Course`.
5. **Terms / residency (from the ClassIn User Agreement + Privacy Policy):** **Data residency = mainland China (PRC)** — personal information is transferred to and stored in the PRC (Privacy Policy §IV.2/VI.1), even though the signing entity is EEO (Singapore). The **anonymisation clause** (Privacy Policy §VI.2/§III.3) lets EEO use **de-identified** data **indefinitely** and **share analyses with partners** — so the raw signal layer is non-exclusive the moment it is de-identified. IP in generated content vests in the user (User Agreement §VIII.1). **No bulk-export / data-return obligation**; account cancellation deletes records irretrievably. **Model-training** is not named explicitly; the de-identified-analysis/new-product clause is the nearest permission. **The operative document — the institutional/enterprise agreement + DPA — was NOT available and remains the key missing artifact; requires written confirmation from the EEO account contact.**

### A6 — Score row provenance ⚠️
- Score tables: `gap_scores` (mig `0001`) and `gap_score_history` (mig `0019`). Columns: `student_id`, `skill`, `score`, `target`, **`source`** (`discovery|lesson|session|exam`), timestamps.
- **`model_id`, `rubric_version`, `prompt_hash`, and `extraction_method` are ALL ABSENT** — zero matches across every migration. The scorer uses `claude-sonnet-4-6` + `rubric.ts`, but **none of the model/rubric/prompt identity is recorded on the row.** `source` is the only provenance.
- **Every existing score row lacks these columns.** (Urgent — flagged as **Minh's to fix, not mine**.)

### A7 — Audio retention
- **Discovery pipeline persists the TRANSCRIPT only.** `discovery_sessions.transcript_json` (+ per-turn `time_in_call_secs`) is stored via the ConvAI webhook; **no audio is persisted anywhere** — no audio/recording/storage references exist in `api/convai/*`.
- **Discard point:** the ElevenLabs ConvAI **post-call webhook handler** (`api/convai/webhook`). The call audio lives inside ElevenLabs; the webhook consumes the transcript and **drops any audio** (the code neither requests nor stores an audio URL).
- `classin_sessions.recording_url` exists as a *column* for classroom audio, but that path is the **un-implemented ClassIn sync** (A5) — so **today LingoPure retains zero audio of any kind.**

---

## 3. What I got wrong in this brief (repo wins — stated plainly)

1. **A3 content-layer shape is stale.** The brief describes `ContentBlock<T>{data,status}` per-section files. That model was replaced (commit `39086b7`) by a single `src/content/home.ts`; `content/types.ts` is now just `BlockStatus` + `Annotation`. **Adaptation:** Phase B must target `home.ts`'s actual shape (and the scaffold route literals), not the described one.
2. **Assumption 1 ("no admin backend") is too strong.** Two live *domain* admins exist (employer, investor). They are correctly out of Phase B scope, but a second *content* admin must not collide with them (shared auth/session, distinct RLS).
3. **Assumption 2 ("ClassIn not integrated / not evaluated") is too strong.** It is scaffolded with a locked adapter; the evaluation done in-repo is *assumption-level* and one assumption (iframe embed) is contradicted by the public docs.
4. **"One tokens file" is not the current reality** — there are two scoped token files (app `@theme`, marketing `.mkt`). Both are single-source per scope; the only leakage is `page.tsx` inline styles.
5. **Env / region not readable** this session (`.env*` permission-denied), so A1's env list is from code references and region is deferred to the dashboard, per the brief's own "report it, don't change it."

---

## 4. The architectural question Phase B turns on — files or rows?

**Recommendation: ROWS (a content table in Supabase), not files.**

The stated purpose is non-engineers changing copy **without a developer or a deploy**. A files backend (`home.ts`) forces a git commit + Vercel build per edit — engineering stays in the loop, publishes are minutes-slow, and every marketing editor needs repo write access. That fails the one problem Phase B exists to solve.

Rows deliver it directly: a `marketing_content` table mirroring the current typed shape (`section`, `block_key`, `status`, `en`, `vi`, `order`, asset refs), read by the public page with the source `home.ts` as seed/fallback. It gives, natively, the four things the brief marks non-negotiable — **audit log** (append-only history table), **role-based access** (`admin`/`marketing`/`readonly` via RLS), **preview** (render the real component from row data), and **per-block VI** — and it fits the repo's existing Supabase + auth. Crucially, B1's "touch content, not the instrument" becomes an **RLS boundary**: the content role can reach only content tables, never `gap_scores`/`discovery_sessions`/learner data.

The files alternative (a git-CMS like Decap/Tina) still triggers a build per publish and needs per-editor git identity — weaker on every axis. **Rows.**

---

## GATE — stopping here

Phase A complete. **I have not scaffolded anything, created no migrations, and changed no configuration or region.** Phase B (admin backend + `CLASSIN_INTEGRATION_SPEC.md`) awaits your explicit go. When you approve, the first thing I'll want confirmed alongside it: the Supabase **region**, and that the rows-not-files decision above is the one you want.
