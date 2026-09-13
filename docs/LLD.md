# Low-Level Design (LLD) — LingoPure

> **Document type:** Implementation reference (living document)
> **Repo:** `caistech/LingoPureAI`
> **Status:** `PARTIALLY VERIFIED — 2026-07-10` (§1 scoring + §2 content-admin verified; others outlined)
> **Owner:** Dennis McMahon · **Audience:** Minh (ongoing dev), Dennis (review)
> **Companion doc:** `docs/HLD.md` (architecture overview)

---

## How to read this document (verification convention)

Describes **how each feature is actually implemented** — schemas, endpoints, jobs, and the logic inside them. Marker convention as the HLD: `[A]` asserted · `[V]` verified against code (cites file) · `[?]` gap. Where code and a draft disagree, **code wins**.

> **Keep-it-current convention:** any PR that changes a route, server action, webhook, schema, or the logic/constants inside a documented feature **updates that feature's LLD block as part of its Definition of Done** — new lines land `[A]`, the same PR promotes implemented lines to `[V]` with file refs.

---

## 0. Feature entry template (copy per feature)

```markdown
## <Feature name>
**Module:** <Marketing/Content | Discovery/Scoring | Learner | Classroom | Employer | Investor | LCI | i18n>
**Status:** [A] / [V] / [?]

### Purpose
### Entry points        (routes / server actions / webhooks / crons)
### Data model          (tables / columns / config)
### Core logic          (step-by-step; every magic number marked until verified)
### External calls
### Confidence / flags surfaced to user
### Verify (Claude Code) (checks to promote [A] → [V])
```

---

## 1. Discovery scoring — LP-18 / LP-1000 engine

**Module:** Discovery / Scoring
**Status:** `[V]` — verified 2026-07-10 against the deployed engine.

### Purpose
`[V]` Turn a **spoken discovery-session transcript** into a **CEFR-aligned six-dimension skill profile** on a 0–1000 scale (the "LP-1000" rescale of the LP-18 framework), computed by **one AI rubric applied to every learner** — so placement is consistent by construction, not subject to teacher-to-teacher variance. *(Engine: `src/lib/scoring/score-discovery.ts`; rubric: `src/lib/scoring/rubric.ts`.)*

### Entry points `[V]`
- **ElevenLabs ConvAI post-call webhook** — `src/app/api/convai/webhook/route.ts`: upserts `discovery_sessions` (`convai_conversation_id`, `transcript_json`, `completed_at`), sets `students.discovery_status='complete'`, and triggers scoring.
- **Manual re-score** — `POST /api/scoring/discovery` (idempotent; reads `discovery_sessions.transcript_json`, re-runs the engine).
- Session start/token — `onboarding/discovery-session.tsx` + `api/convai/token`.

### Data model `[V]`
- **`discovery_sessions`** (`0001`, unique-convai in `0003`): `student_id`, `convai_conversation_id`, `transcript_json jsonb`, `profile_json jsonb`, `status`, `completed_at`.
- **`gap_scores`** (`0001`): `student_id`, `skill` (CHECK — exactly six values), `score` (0–1000 after `0011`), `target` (default 800), `source` (`discovery|lesson|session|exam`), `unique(student_id, skill)`.
- **`gap_score_history`** (`0019`): append-only longitudinal series `(student_id, skill, score, target, source, scored_at)`.
- **Battery** (`0016`/`0017`): structured Phase-0b task battery; `set-canonical.ts`/`reconcile.ts` mark battery-sourced skill rows canonical over voice-sourced ones.
- **The six canonical skills** (DB `CHECK` + `rubric.ts` `SKILL_KEYS`): `speaking_fluency`, `listening_comprehension`, `writing_formal`, `reading_intent`, `business_vocabulary`, `presentation_delivery`. **This is the single enforced taxonomy** — competing dimension lists in docs/forms are legacy.

### Core logic `[V]` — `scoreDiscoverySession` (`score-discovery.ts`)
1. Inputs: `studentId`, `conversationId`, `transcript` (array of `{role, message, time_in_call_secs?}`).
2. Model: **`claude-sonnet-4-6`** (`MODEL`, line 45) — chosen as "prescriptive rubric + strict schema, Opus overkill" (docstring).
3. Prompt: `SYSTEM_PROMPT` (`rubric.ts`) scores "Aria" (the AI coach) vs. the student across the whole transcript; explicitly reads **hesitation, self-correction, recovery** for `speaking_fluency`.
4. Output is forced through a **strict Zod schema** (`GapScoresSchema` — one `SubScore` per skill) via `anthropic.messages.parse(... output_config: zodOutputFormat)` — no free-text parsing.
5. Writes **6 `gap_scores` rows** (`source='discovery'`) + `profile_json` on the session; `setCanonicalGapScores` applies canonical/non-canonical precedence; baselines loaded via `loadBaselinesForStudent`.
6. Returns token usage (input/output/cache read/write) for observability.

### External calls `[V]`
- Anthropic `messages.parse` (one call per scoring). No OpenAI in this path. Persistence to Supabase (`gap_scores` + `discovery_sessions.profile_json`).

### Confidence / flags surfaced to user `[V]`
- Scores on a **0–1000 scale** (rationale in `0011`: a 100-pt scale "reads as noise"); CEFR bands `A1–C2` (`rubric.ts` `CEFR_BANDS`); per-skill `target` (default 800) drives the dashboard gap radar.
- **Degrade-don't-fake:** translation/scoring failures fall back rather than fabricate (`i18n/translate.ts` batch fallback; scoring surfaces typed errors).

### Known gaps `[V]`
1. **No score-row provenance** — rows lack `model_id`/`rubric_version`/`prompt_hash`/`extraction_method` (only `source`). *(`AUDIT_REPORT.md` §A6 — Minh's to fix.)*
2. **No audio retained** — transcript only; audio discarded at the ConvAI webhook (§A7).
3. **Discrete micro-signals** (latency-ms, hesitation, repair as individual rows) are *consumed* by the rubric but **not emitted** as rows — the "session layer" is unbuilt.

### Verify (Claude Code)
- [x] `[V]` `MODEL = claude-sonnet-4-6` (`score-discovery.ts:45`); output via strict Zod schema.
- [x] `[V]` 6 canonical skills = DB `CHECK` (`0001`) == `rubric.ts SKILL_KEYS`.
- [x] `[V]` 0–1000 scale (`0011`); `gap_score_history` append-only (`0019`).
- [x] `[V]` Webhook persists `transcript_json` + triggers scoring (`api/convai/webhook`).
- [ ] `[?]` Battery reconciliation edge cases (`reconcile.ts`) — not exhaustively traced.

---

## 2. Content admin — row-backed marketing content

**Module:** Marketing / Content
**Status:** `[V]` — built + verified 2026-07-10 (migrations `0023`–`0025`, applied to Tokyo).

### Purpose
`[V]` Let non-engineers edit the marketing site's copy, testimonials and client logos — with roles, invites, preview, publish and an audit trail — **without a developer or deploy**. Rows overlay the static `src/content/home.ts` (source = seed + fallback).

### Entry points `[V]`
- **Admin UI:** `/admin` (role-gated chrome), `/admin/content` (block editor), `/admin/testimonials`, `/admin/logos`, `/admin/audit`, `/admin/editors` (admin only).
- **Public/preview:** `(marketing)/page.tsx` (published), `(marketing)/preview/page.tsx` (drafts, gated).
- **APIs:** `POST /api/admin/content-editors/invite`; `PUT /api/admin/content` (save block draft) + `POST /api/admin/content/publish`; `/api/admin/testimonials` + `/api/admin/logos` (POST/PUT/DELETE); `POST /api/admin/assets/upload` (image upload, service-role).

### Data model `[V]`
- **`content_editors`** (`0023`): `role admin|marketing|readonly`, resolved by `current_content_role()` (by `user_id` OR email); RLS own-row read / admin read-all / **service-role writes**; two operator emails seeded as admins.
- **`marketing_content`** (`0024`): `(page, section, block_key)` unique; `en`/`vi` (published) + `draft_en`/`draft_vi` + `status ready|confirm|pending`. RLS: public read; **marketing/admin writes**.
- **`marketing_testimonials`** + **`marketing_logos`** (`0025`): structured items with `published` (draft/live) + `sort_order`; logos add `consent` (must be true to display). RLS: public sees published only; editors see all.
- **`marketing_content_audit`** (`0024`): append-only; fed by definer triggers `log_marketing_content_change` (scalar) + `log_marketing_list_change` (lists) — records field, old→new, who, when.
- **Config:** editable blocks manifest `src/content/editable.ts` (`EDITABLE_BLOCKS` + `getByPath`/`setByPath`).

### Core logic `[V]`
1. **Overlay** — `getHomeContent({draft?})` (`src/content/resolve.ts`): `structuredClone(home)`, fetch `marketing_content` rows for `page='home'`, and for each manifest-declared block `setByPath` the active value (published, or draft in preview). Un-edited blocks keep the source value. Also loads testimonials + logos (published for public, all for preview; logos always `consent=true`).
2. **Render** — `HomeView` renders the merged `home` + real testimonial cards + logo strip; section gating flips `empty→partial/complete` as lists fill. `/` = published, `/preview` = drafts.
3. **Save** — `PUT /api/admin/content` upserts `draft_en/draft_vi/status` (validated against the manifest); **Publish** copies `draft_*` → `en/vi` for all rows.
4. **Boundary** — content roles have RLS policies **only** on content tables; the learner/telemetry tables (`gap_scores`, `discovery_sessions`) are `student_id = auth.uid()`-scoped, so an editor reads nothing there ("touch content, not the instrument").
5. **Invites** reuse the employer/investor magic-link transport (`generateLink` → `/auth/callback?token_hash=…` → Resend).
6. **Image upload** — `api/admin/assets/upload` (service-role) ensures a public `marketing-assets` bucket, caps images at 2 MB, returns the public URL.

### Confidence / flags surfaced to user `[V]`
- Per-block **status** (`ready/confirm/pending`); the editor keeps the **"pending is intentionally empty"** rule visible. Testimonials/logos gate on **published** (+ **consent** for logos). Draft vs. live is explicit (Preview → Publish).

### Known gaps `[A]`
- Live editor round-trip not exercised headlessly (behind auth). Uploaded assets use plain `<img>` (next/image optimisation deferred). Draft columns are technically readable via anon on a noindexed site (marketing drafts — accepted).

### Verify (Claude Code)
- [x] `[V]` `current_content_role()` resolves by user_id OR email; RLS write = marketing/admin (`0023`/`0024`/`0025`).
- [x] `[V]` Overlay falls back to source (public `/` renders with zero rows — smoke-tested).
- [x] `[V]` Audit triggers log scalar + list changes append-only (`0024`/`0025`).
- [ ] `[?]` End-to-end save→preview→publish→live click-through (needs an authed session).

---

## 3. ClassIn integration adapter

**Module:** Classroom
**Status:** `[V]` — verified **scaffolded, not live**.

### Purpose
`[V]` Embed a live ClassIn classroom and, later, pull post-session analytics/recording — behind a **locked adapter shape** so only the adapter changes when EEO provides credentials.

### Entry points / logic `[V]`
- `lib/classin/token.ts` — HMAC-SHA256 SSO signing (**placeholder** algorithm, `CLASSIN_APP_ID/SECRET`).
- `lib/classin/embed.ts` — builds an iframe URL against a **guessed host** `eeo.cn/sdk/classroom` (public docs actually document *client-launch*, not iframe — a flagged discrepancy, `AUDIT_REPORT.md` §A5).
- `lib/classin/api.ts` — `fetchSessionAnalytics()` + `downloadRecording()` **throw `ClassinUnavailableError`**.
- `classroom/[sessionId]/page.tsx` — shows the **sandbox notice** ("ClassIn isn't connected in the sandbox") when creds are absent; scheduling inserts a demo `classin_sessions` row.

### Known gaps `[V]`
Per-speaker recording separability **not documented** by EEO; enrolment API is documented; the operative institutional agreement + DPA is missing. **No ClassIn data enters the scoring path.** Next artifact: `docs/CLASSIN_INTEGRATION_SPEC.md`.

---

## LLM Provider Abstraction
**Module:** Cross-cutting
**Status:** [V]

### Purpose
Allows the application to run on any Anthropic-compatible gateway (e.g., OmniRoute) by abstracting the SDK instantiation and handling fallback for structured-output support.

### Entry points
- `src/lib/llm/client.ts`: The central `anthropicClient()` factory reads `ANTHROPIC_BASE_URL` (proxy root), `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL` (the combo).

### Core logic
- **SDK Factory:** `anthropicClient()` creates a standard SDK instance but overrides `baseURL` if `ANTHROPIC_BASE_URL` is set, making the app provider-agnostic.
- **Parsing Fallback:** The shared `parseStructured` helper detects if a gateway rejects `output_config` (the Anthropic-native structured output). If rejection occurs, it falls back to:
    1. Executing `messages.create` without `output_config`.
    2. Injecting the required JSON schema into the system prompt.
    3. Parsing the resulting text response with the provided Zod schema.

### Verify
- Ensure `ANTHROPIC_BASE_URL` is set in `.env.development.local` to the local OmniRoute endpoint.
- Verify structured-scoring logs: `PARSED OK:` confirms the fallback flow works.
