# PROJECT_STATE — LingoPure WOW Phase

**Updated:** 2026-09-14
**Scope doc:** `docs/WOW_PHASE_SCOPE.md` (approved + eng-reviewed; §11 locks all decisions)

## Session log — 2026-09-16 (C2 completion: evidence packets + responsive text pass)

### Session log — 2026-09-16 (C2 completion: evidence packets + responsive text pass)
- **Commit `4b4b6dd`** — escape apostrophe in `add-client-org.tsx` success copy (pre-existing JSX lint fix).
- **A1 journey evidence panel wired to real `buildEvidencePackets`** — replaced the telemetry-dims-based "Behavioural evidence" section with real evidence packets from `buildEvidencePackets(latest.analyses)`. Top 3 OBSERVED packets sorted by confidence+quality. Removed now-unused `highDims` variable.
- **Responsive text pass: all sub-12px CSS/JSX bumped to 12px minimum** — `telemetry.css` (eyebrow 10→12, pill 11→12, score-inner label 9→12, metric span 10→12, journey .when 9→12, journey .why 10→12, evidence .source 9→12, evidence p 11→12, evidence .change 11→12, timeline .tag 8→12). `learner-notes.tsx` (alert 11→12, empty-state 11→12, date 10→12). `radar.tsx` label `fontSize` 10.5→12. All three telemetry pages already had JSX-level sub-12px fixed in ac4ebd7; this pass covers the CSS and component layers.
- **`@caistech/discovery-agent`** already in `package.json` (`^0.1.0`) and wired: `DiscoverySession` client component in `onboarding/discovery-session.tsx`, `aria-discovery-config.ts` + `aria-discovery.ts` server-side, webhook route at `api/onboarding/discovery/webhooks/[all]`. Provision script at `scripts/provision-discovery-agent.ts`. §11 lock 4 voice surface is code-complete; live binding blocked on Thao promoting Dennis to ElevenLabs Admin (orphaned agent `agent_8701m2eyrep6exysepd25r16msst` needs webhook binding).
- **C2 is now COMPLETE.** All three telemetry pages (A1/A2/A3) render real engine data, responsive text floor enforced at 12px, evidence packets wired, A3 §7 org wiring done (teacher_report_context + relationship mapping from 77aecd4).

---

## Session log — 2026-09-14 late (LingoPure account swap: ElevenLabs + Resend)

### ElevenLabs — LingoPure workspace swap
- **`LINGOPURE_ELEVENLABS_API_KEY`** (`sk_752f3a...`) in `.env.development.local`; same value now set as `ELEVENLABS_API_KEY` in both `.env.local` + `.env.development.local`. Old buildtech key removed.
- **Seat:** Dennis (`mcmdennis@gmail.com`) is `workspace_lite_member` in the LingoPure ElevenLabs workspace — **cannot manage webhooks** (`403 webhooks_manage`).
- **Orphaned agent:** `agent_8701m2eyrep6exysepd25r16msst` ("LingoPure Discovery Agent") exists in the workspace, created by Dennis, but webhook **not bound**.
- **Blocker:** Thao must promote Dennis to **Admin** in ElevenLabs team settings (or create a new API key as owner). Then re-run provisioning with `existingAgentId: agent_8701m2eyrep6exysepd25r16msst`.
- **Re-provision command** (after role fix): load `.env.local` into env → `node --import tsx scripts/provision-discovery-agent.ts`. The `node --import tsx` is mandatory; see packaging bug below.
- Morgan (`NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID`) blanked + pending same resolution.

### `@caistech/elevenlabs-convai@0.9.0` packaging bug
- **`ERR_PACKAGE_PATH_NOT_EXPORTED`** when tsx resolves the package in CJS mode. Root: `exports` map has only `import`/`types` conditions — no `default`/`require` fallback.
- **Local fix:** added `"default": "./dist/index.js"` to all three export paths in `node_modules/@caistech/elevenlabs-convai/package.json`. Not durable (node_modules).
- **Canonical fix:** needs `cais-shared-services/packages/elevenlabs-convai/package.json` — add `"default"` to exports, bump version, reinstall.

### Resend — LingoPure key + domain swap
- **`RESEND_API_KEY`** swapped to LingoPure key (`re_XTq...`) in both env files; verified valid.
- **All 6 from-addresses flipped** from `noreply@updates.corporateaisolutions.com` → `noreply@lingopure.com` (5 `src/lib/email/*.ts` files + `src/lib/hr/email/send.ts` DEFAULT_FROM).
- **Config/docs updated:** `supabase/config.toml`, `.env.example`, `docs/TEST_PROTOCOL.md`.
- **Blocker:** applingopure Resend team has **zero verified domains** — Thao must verify `lingopure.com` in Resend (add domain → DNS records).

---

## Session log — 2026-09-14 (battery report email, marketing i18n toggle, OmniRoute fix, test docs)
- **Battery-complete report email** (`af828c1`) — migration 0048 (`students.battery_report_sent_at`), `src/lib/emails/battery-report.ts`, `src/lib/scoring/lp18.ts`, trigger `battery_report_on_complete`. Fires once when all 4 battery tasks complete (4-skill completeness + `sent_at` guard). Email: personalised name + target, overall LP-18 band + 6 skill bars, "Book a demo" CTA to `/book-a-demo`. Resend transport, no-reply from address, HTML + text fallback. Taste → report → demo bridge.
- **Marketing i18n — functional EN/VI toggle** (`71c66b2`, pushed both remotes). `src/lib/i18n/dictionary.ts` rebuilt to prod-aligned copy: **67 EN + 67 VI `mkt.*` keys, full parity**, per-section granularity. New: `src/components/marketing/i18n-context.tsx` (client `t()` with EN fallback, cookie `lp_lang`), `src/components/marketing/promo-copy.ts` (server-safe `MarketingHomeCopy` resolver). `Nav.tsx` consumes context + `LanguagePill` (cookie toggle via `/api/i18n/lang`, `router.refresh`). `Footer.tsx` server-side `getDict()`. `HomeView.tsx` + homepage + preview render `lang`. **Verified live:** `lp_lang=vi` → `<html lang="vi">` + VI hero/nav/footer, EN h1 gone; default → EN → `lang="en"`. Font note: Lato lacks `vietnamese` subset in this Next version — VI body diacritics fall back to system; Montserrat + JetBrains Mono carry VI subsets. Landing pages (`/for-companies`, `/for-individuals`, `/method`) keep nav/footer translated; body copy EN until content validated.
- **OmniRoute `lingopure-ai` combo 500 root-caused** — the `POST /api/lessons/[id]/submit` 500 was **not** app code: env routes Claude via `ANTHROPIC_BASE_URL=http://localhost:20128/v1` (OmniRoute bridge, model `lingopure-ai`). App error `401 "Missing API key" / invalid_api_key` was **DeepSeek's verbatim schema** (primary step rejecting in 193ms). Combo test proved it: DeepSeek error → Gemini fallback OK (7838ms). Fix is in OmniRoute dashboard (DeepSeek account key `acct f263b66c`, or promote Gemini to primary). Logged in bug knowledge base via Mnemo `bug-memory.mjs remember`. HLD.md:197 documents the bridge as optional.
- **Test protocol + functionality docs** (`b0c020d`, pushed both remotes) — `docs/TEST_PROTOCOL.md` + `.docx`, `docs/FUNCTIONALITY_WORKFLOWS.md` + `.docx`, generator `scripts/generate-docs.mjs` (`docx` npm package, devDependency). Audience: Thao, Dan, Shamni. Test protocol = 10 sections, tick-box checklists (Student/Employer/Investor/Marketing/Assessment/Email/Mobile), bug-report format, sign-off sheet. Functionality doc = exec summary + architecture + 3 packages + 6 portals page-by-page + assessment/scoring + integrations + role-matrix/env/db appendices. Regenerate .docx with `node scripts/generate-docs.mjs`.

## Session log — 2026-09-13 (landing palette, LP-18 dashboard telemetry, discovery-agent split)
- **Landing palette synced to live lingopure.com brand tokens** (`src/app/(marketing)/marketing.css`, commit `d6fe9e1`). Extracted the real palette from the live site's compiled CSS: warm cream bg `#f8f5ec` / card `#fffdf7` / ink `#151617` / muted `#6e777d` / border `#d8d2c4` / **amber accent `#fbae17`** (this is the "yellow" Dennis perceived, not the teal/green from the old remap). Dark (internal/portals) variant: surface `#181914`, text `#f7f5ed`, gold `#ffba3e`.
- **LP-18 CEFR telemetry surfaced on student dashboard** (`src/lib/scoring/rubric.ts` + `src/app/(app)/dashboard/page.tsx`, commit `b54e273`). Added `scoreToLp18()` (18 micro-bands across the 0–1000 scale: A1.1→C2.3) and now render `score · LP-18 · CEFR` on each ScoreBar + LP-18 on the Now/Target badges. The granular LLM scoring is the thing that supersedes the old single-number scoring; display now matches.
- **`aria-discovery` split client-safe vs server-only** (`aria-discovery-config.ts` + `aria-discovery.ts`, commit `5926438`) — fixing the `supabaseKey is required` runtime error. Client widget imports **config only**; service-role Supabase client + ElevenLabs deps live behind `import "server-only"` (added `server-only` dep). Security: the service key never reaches a client bundle.
- **Session route hardened + agent id wired** (`e94974e`). `startSession()` was throwing (`existingAgentId` never passed) and the route returned an empty 500 that the client couldn't `.json()`. Now `aria-discovery.ts` passes `ELEVENLABS_AGENT_ID`, the route returns JSON errors, and `DiscoverySession` surfaces them.
- **Deferred to Minh (live-config blocker):** at `localhost` the Aria livekit call joins, then the ElevenLabs agent errors (`Cannot read properties of undefined (reading 'error_type')` — vendor SDK crash after the agent's error frame). Diagnosis: agent was provisioned against the **prod app URL/allowlist**, so `npm run dev` isn't the right host to test the live voice path. The working list is: `ELEVENLABS_AGENT_ID` (set), `ELEVENLABS_WEBHOOK_SECRET`, live Supabase (current project paused), Vercel reconnect → then production smoke test, not localhost. Sandbox remains valid for everything except live voice.

## Build sequence (C0–C7) and current position

| Step | Status | Delivered |
|---|---|---|
| **C0. Curriculum Engine** | DONE | `suppabase/migrations/0037_curriculum_engine.sql` (curricula, curriculum_lessons, lesson_completions, tutor_feedback, curriculum_resets, all RLS + append-only triggers) · `src/lib/curriculum/curriculum-engine.ts` (CUR-ENGINE-v1.0.0, deterministic skill-gap/plan/reset) · `tests/curriculum/curriculum-engine.test.ts` (10/10 pass via `npm run test:curriculum`) |
| **C1. Org model (additive)** | DONE | `suppabase/migrations/0038_org_model_additive.sql` (organisations, organisation_memberships, organisation_departments, platform_admins; `current_org_role`, `org_is_owner_or_hr`, `org_employer_id`, `org_can_view_student`, `dept_can_view_student` SECURITY DEFINER; RLS per table). FK fix applied (teachers.id). Org RLS DB-verify: `tests/org/org-rls-verify.sql` + `scripts/org-db-verify.sh` — **9/9 assertions PASS** (`npm run test:org:db`). |
| **C1. platform_admins bootstrap** | DONE | `src/lib/platform-admin.ts` canonical gate (ADMIN_EMAILS first-time sync, table owns after) · `scripts/seed-platform-admins.ts` idempotent bootstrap (`npm run admin:seed-platform`) |
| **C2. Dan dashboards → React** | DONE | `e068562` — telemetry kit + A1/A2/A3 (see below) |
| **C3. Org onboarding wizard** | DONE | `src/lib/org/service.ts` (createOrganisation, selectPackage, setDepartments, allocateStaff, assignTeachers, advanceBaseline, advanceCurriculumAndComplete) · `src/components/org/onboarding/wizard.tsx` (7-step wizard: Package → Departments → Staff → Teachers → Baseline → Curriculum → Done) · `src/app/api/org/[orgId]/onboarding/route.ts` (GET bundle + POST 6 actions) · `src/lib/org/onboarding.ts` (state machine + SERVICE_PACKAGES + PACKAGE_DEPARTMENTS) · tests/org/onboarding-service.test.ts (3/3 pass) |
| C4–C7 | PENDING | See §8 of scope doc |

## Key decisions locked (§11 of scope doc)
- Kira org pattern ADDITIVE (no rename, no `persons` table — memberships anchor `auth.users.id`)
- No C0-less dashboards — dynamic reset is the product spine
- Voice = DiscoveryWidget on discovery/onboarding only; classroom voices bespoke
- Billing display-only (synthetic `subscriptions`), departments fixed-nominated set, `platform_admins` canonical with ADMIN_EMAILS bootstrap
- **C2 visual direction: faithful dark telemetry** (Dan's #071019 + cyan/orange/green accents) rendered as dark panels inside the existing (app) light chrome — confirmed by owner 2026-09-12; scoped classes only (`text-t-*` / `.t-card` etc.), never global.

## C2 telemetry pages (committed e068562)
- `src/components/telemetry/telemetry.css` — scoped dark theme; token utilities added to `globals.css` `@theme` (`--color-t-*` → `text-t-*/bg-t-*/border-t-*`).
- `src/components/telemetry/score-ring.tsx`, `radar.tsx` — server-safe SVG (no client deps), dark palette.
- `src/components/telemetry/learner-notes.tsx` — client widget over `learner_notes` (migration 0039).
- `src/lib/2k/journey-data.ts` — `listCompletedAssessments` / `loadResultHistory` / `loadLatestPipeline`; single data path via `loadPipelineResult`.
- **A1** `(app)/dashboard/journey` — LP-1000 ring, narrative state, one-improvement next action, 4D timeline + band-climb journey grid, radar, behavioural evidence, three multi-impact focus behaviours, drift alerts, timing-aware recommendation, streak/XP, My notes. Linked from `/dashboard` (Journey view CTA) when the learner has scores.
- **A2** `(app)/assessment/results/[id]` — Section 1 where-you-stand / 2 what-holds-score-back (telemetry + diagnosis + contradictions) / 3 how-to-reach-next. Linked from the assessment-result phase (`assessment-runner.tsx`).
- **A3** `(app)/teacher/students/[id]/report` — 1 assessment run / 2 12D telemetry+trajectory / 3 diagnosis & recommendation / 4 decision trace / 5 audit·lineage·snapshot. `org_can_view_student` gate + self-view fallback.
- C2 todo: C1-additional — A3 deeper §7 org wiring (teacher→student assignment link, not just `org_can_view_student`), responsive QA on the three pages, evidence-packet panel using real `buildEvidencePackets` output.

## Notes / gotchas
- `0014` teachers PK is `id` (not `teacher_id`) — 0037 uses `teachers(id)`.
- 2K result renders inline in `assessment-runner.tsx`; the dedicated result page (`/assessment/results/[id]`) now exists and is linked from the result phase.
- `@caistech/discovery-agent` NOT yet in package.json — add when wiring voice (C2 discovery surface, §11 lock 4).
- **LLM env split:** `.env.local` = sandbox Supabase (`uovbwccvxgdghqvlpuql`, prod-bound); `.env.development.local` = local Supabase (`localhost:54321`) + `ANTHROPIC_BASE_URL=http://localhost:20128/v1` (OmniRoute bridge, combos by account acct-IDs). Unset base URL → traffic goes straight to Anthropic.
- **Lesson submit 500 signature:** error body `"Missing API key"` with `code: invalid_api_key` is a provider above the bridge rejecting (193ms fast-fail), not the gateway and not app code. Check the combo step authz first.
- **Admin testing account:** `dennis@factory2key.com.au` / `Logoinabc123` (ABC Manufacturer org admin persona, `src/lib/seed/abc-personas.ts`).
- **Pushed commits:** `af828c1` battery-report email, `71c66b2` i18n toggle, `b0c020d` docs — all on `origin` + `lingopure`. No push key needed (already authenticated).
- Two untracked PNGs remain in `docs/` from prior screenshot work (`Lingopurelanding screenshot.png`, `lingopureinternalphoebe.png`) — deliberately uncommitted.

## Environment
- Win32 / PowerShell 7 shell. Tests: `npm run test:curriculum` (node:test + tsx; `@/` path alias resolves).
- Unrelated pre-existing changes in tree: `src/middleware.ts` → `src/proxy.ts` migration in flight (Next 16), `tree.py`, BPO gate fixtures.
- One WIP stash remains: `stash@{0}` "WIP from prior session: demo banner + prod site_url + auth/callback route" — but it actually contains only a `@caistech/elevenlabs-convai` 0.1.4→0.1.5 bump (label is misleading). Drop or keep as is; not needed for the current build.
- `.env.local` (sandbox): VERCEL_OIDC_TOKEN, RESEND_API_KEY (LingoPure `re_XTq...`), OPENAI_API_KEY, ANTHROPIC_API_KEY, both Supabase keys, ELEVENLABS_API_KEY (LingoPure `sk_752f3a...`), ELEVENLABS_AGENT_ID (blank — orphaned `agent_8701m2eyrep6exysepd25r16msst` needs binding), ELEVENLABS_WEBHOOK_SECRET (blank), EMPLOYER_DEMO_PASSWORD, HEYGEN_API_KEY, SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID (blank), LINGOPURE_RESEND_API_KEY, LINGOPURE_ELEVENLABS_API_KEY.
- `.env.development.local` (local dev): local Supabase (`localhost:54321`), same LingoPure keys as above, ANTHROPIC_BASE_URL/module pointing at OmniRoute bridge on localhost:20128, CONVAI_TOOL_SECRET, LINGOPURE_LINGOPURE_SANDBOX_* vars.