# PROJECT_STATE — LingoPure WOW Phase

**Updated:** 2026-09-13
**Scope doc:** `docs/WOW_PHASE_SCOPE.md` (approved + eng-reviewed; §11 locks all decisions)

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
| **C1. Org model (additive)** | DONE | `supabase/migrations/0038_org_model_additive.sql` (organisations, organisation_memberships, organisation_departments, platform_admins; `current_org_role`, `org_is_owner_or_hr`, `org_employer_id`, `org_can_view_student`, `dept_can_view_student` SECURITY DEFINER; RLS per table). FK fix applied (teachers.id). Org RLS DB-verify: `tests/org/org-rls-verify.sql` + `scripts/org-db-verify.sh` — **9/9 assertions PASS** (`npm run test:org:db`). |
| **C1. platform_admins bootstrap** | DONE | `src/lib/platform-admin.ts` canonical gate (ADMIN_EMAILS first-time sync, table owns after) · `scripts/seed-platform-admins.ts` idempotent bootstrap (`npm run admin:seed-platform`) |
| **C2. Dan dashboards → React** | IN PROGRESS | `e068562` — telemetry kit + A1/A2/A3 (see below) |
| C3–C7 | PENDING | See §8 of scope doc |

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

## Environment
- Win32 / PowerShell 7 shell. Tests: `npm run test:curriculum` (node:test + tsx; `@/` path alias resolves).
- Unrelated pre-existing changes in tree: `src/middleware.ts` → `src/proxy.ts` migration in flight (Next 16), `tree.py`, BPO gate fixtures.