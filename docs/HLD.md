# High-Level Design (HLD) — LingoPure

> **Document type:** Architecture reference (living document)
> **Repo:** `caistech/LingoPureAI` (primary) + `LingoPure/purelingo-app-sandbox` (mirror)
> **Status:** `PARTIALLY VERIFIED — 2026-09-16` (C0–C7 build sequence complete; verified against deployed code where marked `[V]`; see §11)
> **Owner:** Dennis McMahon (technical lead)
> **Audience:** Minh (ongoing dev), Dennis (review)
> **Companion doc:** `docs/LLD.md` (implementation detail)

---

## How to read this document (verification convention)

This HLD describes **what the system is and how the major pieces fit together**. It is reference, not instruction.

| Marker | Meaning |
|---|---|
| `[A]` ASSERTED | Drafted from brief / memory / inference. **Not** checked against the codebase. |
| `[V]` VERIFIED | Confirmed against deployed code. Cites the file/path/migration. |
| `[?]` GAP | Unknown or contested. Needs investigation before it can be asserted. |

Where this HLD and any brief disagree, **deployed code wins** — the disagreement is flagged, not silently resolved.

> **Context — this is a strategic demo, not the production consumer service.** LingoPure.com is marketing-only today; this repo is the working platform demo (voice discovery → scored learning → certification, plus an investor dataroom and an employer console). Several surfaces are deliberately single-tenant / founder-provisioned. `[A]` (project memory `project_lingopureai_context`).

---

## How to reuse this file as a template (portfolio-wide)

Same convention as the MMC HLD: copy `docs/HLD.md` + `docs/LLD.md`, replace the header + §3 identifiers, reset markers to `[A]`, and re-run the verification pass against *that* repo. Keep section headings identical across repos. Any PR that adds/changes a route, a webhook, a migration, an external integration, or an AI-routing decision **updates the relevant HLD/LLD entry as part of its Definition of Done** — a new claim lands `[A]` and the same PR promotes it to `[V]` with the file it wrote.

---

## 1. System overview & purpose

`[V]` LingoPure is an **AI-first business-English platform for B2B teams in Vietnam / Southeast Asia**. A learner does a **voice discovery session** (a spoken AI conversation), which is **AI-scored against a fixed rubric** into a CEFR-aligned **LP-18 / LP-1000 profile** across six skill dimensions; that profile drives targeted micro-lessons and live classes, with progress re-measured and CEFR certification via TrackTest. *(Verified by the scoring engine `src/lib/scoring/score-discovery.ts` + `rubric.ts`, the `gap_scores`/`gap_score_history` schema in `supabase/migrations/0001,0011,0019`, and the surfaces under `src/app/(app)/`.)*

`[V]` Around that core sit: a **row-backed marketing site + content admin**, an **employer cohort console**, an **investor dataroom** (cited RAG Q&A + reports + voice), a **live-classroom** surface (ClassIn, scaffolded), and a **live interpreter** (LCI Bridge). *(Verified by the route inventory in §3.)*

`[V]` **The proprietary derived layer** (transcripts, LP-scores, profiles, longitudinal history) lives in **LingoPure's own Supabase (Tokyo)** — not on any vendor platform. `[V]` (memory `project_lingopure_deploy_gate`; ClassIn is a scaffolded external source only — §5.2).

---

## 2. Architecture (component view)

```mermaid
flowchart TB
    User([Learner / Employer admin / Investor / Operator])

    subgraph Edge["Vercel — Next.js 16.2.4 App Router"]
        UI[Web UI: marketing, discovery, dashboard, dataroom, admin]
        API[Route handlers / server actions]
    end

    subgraph Async["Event-driven (no job orchestrator)"]
        WH[ConvAI post-call webhook → scoring]
        CRON["/api/cron/nudges (scheduled)"]
    end

    subgraph Data["Supabase — Tokyo (nbvprbaumwmfczsfcyrv, ap-northeast-1)"]
        PG[(Postgres + RLS · 50 migrations)]
        VEC[(pgvector: dataroom_chunks, HNSW)]
        OBJ[(Storage: dataroom docs, marketing-assets)]
    end

    subgraph AI["Model providers"]
        ANTH[Anthropic Claude — scoring, translation, dataroom answers]
        OAI[OpenAI — embeddings 1536 + Whisper STT]
        EL[ElevenLabs ConvAI — voice agents]
    end

    subgraph Ext["External services"]
        TT[TrackTest — CEFR certification]
        RESEND[Resend — email/invites]
        CLASSIN[ClassIn / EEO — live classroom · SCAFFOLDED]
        SAYFIX[SayFix — bug widget]
    end

    User --> UI --> API
    API --> PG
    API --> OBJ
    API --> ANTH
    API --> OAI
    API --> EL
    API --> RESEND
    API --> TT
    EL -- post-call webhook --> WH --> ANTH
    WH --> PG
    CRON --> RESEND
    API -. embed/token .-> CLASSIN
```

> `[V]` **Sync/async boundary.** There is **no background-job orchestrator** (no Inngest/Stripe/HubSpot — confirmed absent from `package.json`). Heavy AI work runs in two places: (1) **the ElevenLabs ConvAI post-call webhook** (`src/app/api/convai/webhook/route.ts`) persists the transcript and triggers discovery scoring; (2) request-path server actions/routes call Claude/OpenAI inline (short calls). A **nudges cron** (`src/app/api/cron/nudges/route.ts`) fires reminder emails.

---

## 3. Modules (bounded contexts)

`[V]` Route inventory confirmed under `src/app/`:

| Module | Route(s) | Responsibility | Primary async / AI |
|---|---|---|---|
| **Marketing + content admin** | `(marketing)/` (`/`, `/for-companies`, `/for-individuals`, `/method`, `/book-a-demo`, `/company`, `/preview`); `/admin/*` | Public sales-flow site (canvas-reviewable) + row-backed content editing | — (see LLD §2) |
| **Voice discovery + scoring** | `(app)/onboarding/*` (`/`, `/session`, `/battery`); `api/convai/*` | Spoken AI assessment → LP-18/LP-1000 profile | ConvAI + Claude scoring |
| **Learner app** | `(app)/dashboard`, `/lessons`, `/lessons/[id]`, `/settings` | Gap radar, micro-lessons, plan, certifications | Claude (lesson eval) |
| **Live classroom** | `/classroom/[sessionId]` (+ `/transcribe`), `/exam/[id]` | Live class (ClassIn embed — scaffolded) + transcript/exam | Whisper (planned) |
| **Employer console** | `/employer/*` (login + `(authed)` overview/departments/roles/staff/students/teachers) | Cohort admin over a company's learners | — |
| **Investor dataroom** | `/investor` + `/investor/(authed)/*`; **admin** `/investor/admin/(console)/*` | Cited RAG Q&A, documents, reports, NDA-gated deep-dive, voice (Morgan) | OpenAI embeddings + Claude answers |
| **LCI Bridge** | `/lci-bridge`; `api/interpret` | Single-device turn-based live interpreter | Claude / STT |
| **i18n** | (cross-cutting) | 11-language UI dictionary + render-time translation | Claude Haiku |
| **Platform admin** | `/admin/*` (audit, content, editors, onboarding) | Operator console for org provisioning, content management, and RLS audit | — |
| **Org admin** | `/org/[slug]/*` (dashboard, departments, staff, students, teachers, billing, onboarding) | Multi-tenant portal for client organisations | — |
| **Teacher portal** | `/teacher/*` (students, notes) | Teacher-facing view of assigned students and notes | — |
| **Static/legal** | `/about`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/languages`, `/demo` | Marketing/legal + the original product landing (`/demo`) | — |

`[V]` Auth roles differ by context (§8): **learners** (`students`), **org-membership roles** (`organisation_memberships`: owner/hr/staff/student — the C1 canonical org model, `0038`), **teachers** (`teachers`, link to students via `student_teacher_assignments`, `0014`), **platform admins** (`platform_admins`, `0044`), **employer-admins** (`employer_admins`: owner/hr/viewer legacy cutover), **investor operators** (`ADMIN_EMAILS` allowlist), **content editors** (`content_editors`: admin/marketing/readonly). The gate layer is DB-side SECURITY DEFINER functions (`current_org_role`, `org_can_view_student`, `dept_can_view_student`, `org_is_owner_or_hr`, `platform_is_admin`) — see LLD §4.

---

## 4. Tech stack

`[V]` Pins from root `package.json` (npm; `"private": true`):

| Layer | Technology | Pin / detail |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | `next 16.2.4`, `react`/`react-dom 19.2.4`, `typescript ^5` |
| Server | Next.js route handlers / server actions | **Single Next.js app — no separate service, no Inngest/queue.** |
| Styling | Tailwind CSS v4 | `tailwindcss ^4` (`@theme` tokens in `globals.css`; scoped `.mkt` marketing tokens in `(marketing)/marketing.css`) |
| Database | Supabase Postgres (**Tokyo `ap-northeast-1`**) | `@supabase/supabase-js ^2.105.1`, `@supabase/ssr ^0.10.2`. Project `nbvprbaumwmfczsfcyrv`. **50 migrations** (`0001`–`0050`) |
| Vector / RAG | pgvector | `dataroom_chunks.embedding vector(1536)`, **HNSW** (`vector_cosine_ops`), RPC `match_dataroom_chunks` (`0020_investor_dataroom.sql:27,57,61,133`) |
| Object storage | Supabase Storage | dataroom document buckets; `marketing-assets` (public, created on demand by the upload route) |
| LLM (generation) | Anthropic (provider-agnostic via bridge) | `src/lib/llm/client.ts` centralizes construction. Honors `ANTHROPIC_BASE_URL` (OmniRoute/OpenRouter) and `ANTHROPIC_MODEL` env vars. `parseStructured` falls back to schema-injected prompt for free models. Defaults: **`claude-sonnet-4-6`** (scoring/lessons), **`claude-haiku-4-5-20251001`** (i18n) |
| LLM (embeddings + STT) | OpenAI | `openai ^6.35.0`; **`text-embedding-3-large`@1536** for dataroom RAG (`0020:46`, `lib/investor/retrieval.ts`); **Whisper** STT (`lib/transcription/whisper.ts`) |
| Voice (conversational) | ElevenLabs ConvAI | `@caistech/elevenlabs-convai ^0.4.0` + `@elevenlabs/client ^1.4.0` + `@elevenlabs/react ^1.3.0`. Discovery coach ("Aria"), investor voice ("Morgan") |
| Auth surface | `@caistech/corporate-components ^0.3.0` | shared auth components |
| Doc ingestion | `mammoth` (docx), `pdf-parse`/`pdf-lib` (PDF), `xlsx` | dataroom document extraction |
| Email | Resend | invites + nudges (`lib/email/invite.ts`, direct REST) |
| Certification | TrackTest | CEFR exams (`lib/tracktest/*`) `[A]` — files present, not deep-read this pass |
| Bug reporting | SayFix | `@caistech/sayfix-embed ^0.4.0` (suppressed on marketing routes) |
| Validation | Zod | `zod ^4.4.1` |
| Testing | Playwright | `@playwright/test ^1.59.1` (`tests/e2e/`) |
| Hosting | Vercel | slug `lingo-pure-ai`; `NEXT_PUBLIC_CANVAS_MODE` gates the marketing review canvas |

> `[V]` **AI routing.** LLM traffic is now centralized through `src/lib/llm/client.ts`. Production routes to Anthropic (`claude-sonnet-4-6`), but setting `ANTHROPIC_BASE_URL` (e.g. to OmniRoute or LiteLLM) and `ANTHROPIC_MODEL` instantly switches the entire scoring/lesson/translation stack to a free-model bridge. `parseStructured` handles the fallback from native structured output to schema-injected prompt generation for gateways that don't support Anthropic's `output_config`.

---

## 5. Key data flows

### 5.1 Voice discovery → LP-18/LP-1000 scoring `[V]` (the core loop — LLD §1)
1. Learner starts a spoken discovery session over **ElevenLabs ConvAI** (`onboarding/discovery-session.tsx`, token via `api/convai/token`).
2. On call end, the **post-call webhook** (`api/convai/webhook`) upserts `discovery_sessions` with `convai_conversation_id` + full `transcript_json` (per-turn `time_in_call_secs`) + `completed_at`.
3. `score-discovery.ts` sends the transcript to **Claude Sonnet 4.6** against `rubric.ts` (strict Zod schema) → **6 `gap_scores` rows** (`source='discovery'`, 0–1000 scale) + `profile_json`; also re-scorable idempotently via `POST /api/scoring/discovery`.
4. A structured **task battery** (`onboarding/battery`, mig `0016/0017`) refines canonical skill rows; `gap_score_history` (mig `0019`) logs the longitudinal series.

### 5.2 Live classroom (ClassIn) `[V] — SCAFFOLDED, not live`
`classroom/[sessionId]` builds a ClassIn SSO embed via `lib/classin/{token,embed}.ts`, but the analytics/recording adapter (`lib/classin/api.ts`) **throws `ClassinUnavailableError`** pending EEO credentials, and the session page shows a **sandbox notice** when `CLASSIN_APP_ID` is unset. Scheduling inserts a demo `classin_sessions` row. **No ClassIn data enters the scoring path yet.** *(See `docs/AUDIT_REPORT.md` §A5.)*

### 5.3 Investor dataroom (cited RAG) `[V]`
Documents are ingested (`mammoth`/`pdf-parse`) → chunked + embedded (OpenAI `text-embedding-3-large`@1536) into `dataroom_chunks`; investor questions run `match_dataroom_chunks` (cosine, HNSW) → Claude synthesises a **cited** answer (`lib/investor/{retrieval,answer,build-report}.ts`). NDA-gated deep-dive (mig `0021`); access logged (`dataroom_audit`, mig `0020`); voice via "Morgan" (`investor_voice_sessions`, mig `0022`).

### 5.4 Content editing (rows, not files) `[V]` (LLD §2)
`marketing_content` (draft/published) + `marketing_testimonials`/`marketing_logos` are overlaid onto the static `src/content/home.ts` by `getHomeContent()`; the public page reads published, `/preview` reads drafts, `/admin/*` edits with RLS + an append-only audit trigger.

---

## 6. External integrations

| Service | Purpose | Direction | Notes / verify |
|---|---|---|---|
| ElevenLabs ConvAI `[V]` | Conversational voice (discovery coach, investor Morgan) | Out + webhook | `@caistech/elevenlabs-convai ^0.4.0`; HMAC-verified webhook |
| Anthropic `[V]` | Scoring, translation, dataroom answers | Outbound | `@anthropic-ai/sdk ^0.91.1` |
| OpenAI `[V]` | Embeddings (1536) + Whisper STT | Outbound | `openai ^6.35.0` |
| Supabase `[V]` | Postgres + Auth + Storage (Tokyo) | Out | `nbvprbaumwmfczsfcyrv` |
| Resend `[V]` | Invites + nudge emails | Outbound | `lib/email/invite.ts` |
| TrackTest `[A]` | CEFR certification | Outbound | `lib/tracktest/*` (present; not deep-read) |
| ClassIn / EEO `[V]` | Live classroom | Out (planned) | **Scaffolded — not live** (§5.2) |
| SayFix `[V]` | Bug reporting widget | Out | suppressed on marketing/investor/lci routes |

---

## 7. Deployment & environments

`[V]` Vercel (slug `lingo-pure-ai`, prod `lingo-pure-ai.vercel.app`); Supabase **Tokyo `ap-northeast-1`** (`nbvprbaumwmfczsfcyrv`) for data/auth/storage; **AU/JP residency posture** — derived learner data resides in Japan, not the PRC (contrast the scaffolded ClassIn source). `NEXT_PUBLIC_CANVAS_MODE=true` on the deployed marketing canvas.
`[V]` Migrations are **CLI-driven** (`supabase db push --linked`); the shell `SUPABASE_ACCESS_TOKEN` holds a Vercel token — use the `sbp_` token at `~/.supabase-token` (memory `project_lingopure_deploy_gate`).
`[V]` **Two git remotes:** `origin` = `caistech/LingoPureAI` (primary), `lingopure` = `LingoPure/purelingo-app-sandbox` (mirror). Commits push to both.
`[V]` **Deployment blocker (2026-09-16):** the Vercel project is linked locally (`.vercel/project.json` → project `lingo-pure-ai`, org `corporate-ai-solutions`, team `team_hwN7IFtd2Fo3DCj9C67ZwI1t`) but **not live**. Thao must create the Vercel team + project so Dennis can set up the deployment; only then does production deploy. Once live: push `main` to whichever remote Vercel's git integration watches, set the full env set in the dashboard (the `@caistech` Vercel sensitive-env-var rule — no env file committed), and re-run the `test:org:db` harness against the live schema before first smoke. `VERCEL_OIDC_TOKEN` in `.env.local` is dev-scoped + expired — mint a fresh token for production.

### Local Development (Dry-Run)
`[V]` To run the full platform (including admin and portal surfaces) without touching hosted Supabase/Vercel:
1.  Start the local stack: `supabase start` (runs on `localhost:54321`).
2.  Create `.env.development.local` (gitignored) with local URLs/keys:
    ```text
    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    SUPABASE_URL=http://127.0.0.1:54321
    SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
    ANTHROPIC_BASE_URL=http://localhost:20128/v1  # OmniRoute bridge (optional)
    ANTHROPIC_MODEL=lingopure-ai                 # Bridge combo (optional)
    ANTHROPIC_API_KEY=<proxy-key>                # Bridge key (optional)
    ```
3.  Seed the sandbox: `npm run admin:seed-platform` (creates platform admins) + `npx tsx scripts/seed-abc-manufacturer.ts` (creates employer/roles/personas) + `npx tsx scripts/seed-abc-portal.ts` (creates org memberships/billing).
4.  Run the app: `npm run dev` (will use `.env.development.local` automatically in development).
5.  Browse `http://localhost:3000/admin` (platform console) or `/org/abc-manufacturer` (org portal).

---

## 8. Cross-cutting concerns

- **Auth & RBAC** `[V]` — Supabase Auth (`@supabase/ssr`); `getUser()` gate on every data route. **Separate role contexts** (no single enum): `students` (learners),`organisation_memberships` (owner/hr/staff/student — the C1 canonical org model, `0038`), `teachers` (`0014`, assignment-linked to students), `platform_admins` (`0044`, seeded from `ADMIN_EMAILS`), `employer_admins` (owner/hr/viewer, mig `0012`, legacy cutover), investor operators (`ADMIN_EMAILS` allowlist, `lib/investor/operator-auth.ts`), `content_editors` (admin/marketing/readonly, mig `0023`, resolved by `current_content_role()`).
- **Row-Level Security** `[V]` — RLS enabled across the schema; learner/telemetry tables scoped to `student_id = auth.uid()`; content/investor tables scoped to their role functions. The content-admin boundary ("touch content, not the instrument") is an RLS boundary — content editors have policies only on content tables. The org-model surfaces use DB-side SECURITY DEFINER gates (`org_can_view_student` / `current_org_role` / `dept_can_view_student` from `0038`, `platform_is_admin` from `0044`) so row counts are enforced by the database, not the UI — asserted continuously by the org-RLS DB-verify harness (`npm run test:org:db`, see LLD §4). A cross-org leak in `teacher_report_context` (`0040`) was found by that harness in the C7 pass and fixed by `0050`.
- **Storage** `[V]` — Supabase Storage for dataroom documents and the public `marketing-assets` bucket (2 MB image cap; created on demand by `api/admin/assets/upload`).
- **i18n** `[V]` — 11-language UI dictionary (`lib/i18n/dictionary.ts`), cookie/profile-driven active language; render-time Claude-Haiku translation for dynamic student-facing content (`lib/i18n/translate.ts`); marketing site is EN-only today (VI stored via the content admin for later).
- **Voice memory / security** `[V]` — ConvAI webhook verifies HMAC; identity is server-derived at connect (`conversation_id`), per the portfolio Voice Memory Standard.
- **Observability** `[?]` — no Sentry/analytics dependency in `package.json`; logging is `console`-level. (A gap vs. the MMC build, which wired Sentry + Vercel Analytics.)
- **Security / residency** `[V]` — Tokyo data residency; auth gate before data access; secrets via env (service-role never client-side); SayFix + ConvAI webhooks verify signatures.

---

## 9. Open items linked to this design

- `[V]` **ClassIn integration is scaffolded, not live** — needs EEO SDK credentials + confirmation of the embed shape, analytics granularity, and per-speaker recording (`docs/AUDIT_REPORT.md` §A5; `docs/CLASSIN_INTEGRATION_SPEC.md` is the intended next artifact). `classin_sessions` now has org/teacher read RLS (`0049`).
- `[V]` **Score-row provenance gap** — `gap_scores`/`gap_score_history` carry `source` but **no `model_id`/`rubric_version`/`prompt_hash`/`extraction_method`** (`AUDIT_REPORT.md` §A6).
- `[V]` **Audio retention** — discovery keeps the transcript only; **no audio persisted** (§A7).
- `[?]` Observability (Sentry/analytics) unwired; billing/multi-tenant Stripe not built (demo scope — synthetic `subscriptions`, `0041`); **production deployment blocked on Thao creating the Vercel team/project** (§7).
- `[A]` Content admin: live editor round-trip not yet exercised headlessly; next/image optimisation for uploaded assets deferred.
- `[V]` **Live voice path not production-tested** — Aria/Morgan require an ElevenLabs Agent++ binding (orphaned agent `agent_8701m2eyrep6exysepd25r16msst`) + Dennis promoted to workspace Admin; and a live Supabase (current project paused). MOTD target on `npm run dev` isn't the right host — production smoke required.

---

## 10. Verification checklist (status after the 2026-09-16 pass)

- [x] `[V]` Stack = Next.js 16.2.4 + Supabase (Tokyo) + ElevenLabs + Anthropic/OpenAI; **no Inngest/Stripe/queue** (package.json).
- [x] `[V]` Modules mapped to routes (§3); role contexts: students / org memberships (owner-hr-staff-student) / teachers / platform admins / employer admins / content editors / investor operators.
- [x] `[V]` Core loop: ConvAI discovery → webhook → Claude Sonnet 4.6 rubric → 6 `gap_scores` (0–1000) + `gap_score_history`.
- [x] `[V]` Investor RAG: pgvector 1536 + HNSW + `match_dataroom_chunks`; OpenAI embeddings; Claude cited answers.
- [x] `[V]` ClassIn scaffolded (throws `ClassinUnavailableError`); no audio retained; scores lack provenance columns.
- [x] `[V]` Content admin: rows overlay `home.ts`; draft/preview/publish; RLS + append-only audit.
- [x] `[V]` C0–C7 build sequence complete: curriculum engine (`0037` + `curriculum-engine.ts`), org model + onboarding wizard + platform/org/teacher portals, C7 auth+RLS wiring — org-RLS DB-verify harness PASSES (`npm run test:org:db`, 50 migrations applied, `teacher_report_context` leak closed by `0050`).
- [ ] `[?]` Live production deployment (blocked on Thao Vercel team); observability wiring; TrackTest integration depth — not code-tallied this pass.

---

## 11. Corrections summary (evidence the pass read the code)

**Confirmed (`[A]` → `[V]`):** stack pins; the discovery→scoring loop and its models; the six-skill 0–1000 rubric; investor pgvector RAG (1536/HNSW/`match_dataroom_chunks`) with OpenAI embeddings; role contexts (now incl. org memberships / teachers / platform admins — C1); Tokyo residency; the content-admin rows/overlay/RLS/audit; ClassIn scaffolded-not-live; no job orchestrator; **C0–C7 build sequence complete with the org-RLS gate layer as a DB-verified boundary** (cross-org report-context leak closed by `0050`).

**Differs from the MMC template (by design, not error):** no Inngest (async = ConvAI webhook + nudges cron); no Stripe/billing (demo scope — synthetic `subscriptions` `0041`); no central AI routing table (per-call-site models); no Sentry/analytics yet.

**Still `[?]`:** live production deploy (blocked on Thao — Vercel team/project); observability wiring; TrackTest integration depth (files present, not deep-read this pass); exact table/policy count of the C1 RLS layer (asserted behaviourally by the DB-verify harness rather than tallied).
