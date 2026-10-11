# Platform State Audit — purelingo-app-sandbox

**Date:** 2026-10-11
**Type:** Read-only code/schema audit. No writes, no paid calls, no DB access (no read-only Supabase
credentials were available in this session — see "Where I looked" and "Open questions").
**Repo:** `lingopureai` (deployed as `purelingo-app-sandbox.vercel.app`, Supabase project
`uovbwccvxgdghqvlpuql`), audited at commit `b273ceb` on `main`.

> Every finding below is **Observed** (seen directly in code/schema/config) unless marked
> **Inferred**. File:line citations are given wherever the finding is non-trivial.

---

## 1. Summary table

| Area | Status | One-line finding |
|---|---|---|
| A. Scoring instrument | Exists | LLM (Claude) scores each sector 0–1000 directly; no formula/model combines sectors — the "overall" figure is just an unweighted mean, computed two different ways in two different places (see Deviations). |
| B. Score → LP-18 → CEFR mapping | Exists, inconsistent | Two live functions (`scoreToCefrBand`, `scoreToLp18`) map the same score to *different* letter bands for roughly a fifth of the scale. No cited source for the boundary numbers. |
| C. Taxonomy | Exists, two generations coexist | 8 scored dimensions (6 primary + 2 supporting); DB CHECK constraints currently accept **both** the old 6-key taxonomy and the new 8-key one simultaneously. |
| D. Provenance/versioning (R6) | Absent | `gap_scores`/`gap_score_history` have no model/prompt/rubric/code-version column anywhere. Confirmed known gap. |
| E. Discovery/placement flow | Exists, two unconnected flows | Live flow: signup → Aria voice call → written battery (4 tasks) → lessons/plan, all feeding `gap_scores`. A second, separate "2K" 25-question battery pipeline exists in full but has **no navigation entry point** anywhere in the app. |
| F. Audio/transcript retention (R7) | Partial | Live Aria-discovery path: transcript text stored indefinitely, no retention/expiry logic found; no raw audio stored by the app (ElevenLabs holds it, no app-side policy found). The orphaned 2K path has a real 90-day audio-retention cron. |
| G. Consent/privacy (R8) | Absent | No consent flag/timestamp/version captured anywhere for a real student. `students` table has no consent column. The one "consent" object in code is hardcoded `true`, sent with no preceding UI checkbox, in the orphaned 2K flow. |
| H. Reliability support | Absent | `variant_bucket` exists in battery-prompt seed data (so two equivalent-difficulty prompts exist) but no code path selects the "other" variant on retest; no stability/agreement measurement anywhere. |
| I. External anchors (TrackTest / CEFR descriptors) | Partial, and the marketing claim is unsupported by the code | TrackTest integration is a **simulation**: no partner credentials exist, and "passing" is computed by comparing the student's own `gap_scores` average against a hardcoded floor — not an external exam. No CEFR descriptor text or citation anywhere in the repo. |
| J. Teacher session reports | Exists, wired to the orphaned data store | The teacher report page and the learner "Journey view" page both query the 2K tables (`assessment_sessions`/`canonical_results`), which nothing in the live flow populates. |
| K. ClassIn (R4) | Deviates | ClassIn transcripts (real or manually pasted) are scored by the same Claude rubric pipeline and written into the **same canonical `gap_scores`** the discovery flow writes to, with `source='session'`, and can become the row the whole dashboard/plan reads. |
| L. Learner journey features | Exists (mostly) | Placement report email ✅, dashboard progress view ✅, "Journey view" page ❌ (points at dead data), AI role-play ⚠️ (schema only, no evidence of a built flow), re-assessment ✅ (manual, via `/onboarding`), cohort/dept grouping ✅, org/employer admin dashboard ✅, multi-tenant model ✅, role-based visibility ✅. |
| M. Course/content layer | Exists | `curricula` / `curriculum_lessons` / `lesson_completions` — a real, versioned 16-week-style plan engine, separate again from both the 2K tables and `micro_lessons`. |
| N. Infrastructure/processors | Partial | Supabase region not stated in repo config (privacy policy prose says "Tokyo, Japan" — unverified against actual project settings). Third parties found: Anthropic (scoring/lessons), OpenAI Whisper (ClassIn transcription path only), ElevenLabs ConvAI (voice), Resend (email). No "Vapi" anywhere despite the brief's reference to it. |
| O. Private packages | Exists, one unused | 6 `@caistech/*` packages declared; 5 are imported somewhere in `src/`, 1 (`@caistech/corporate-components`, v0.3.0) has **zero imports** anywhere in `src/` or `scripts/`. |
| P. Claims in product copy | One claim found, materially unsupported | Homepage: *"CEFR-aligned certification through TrackTest"* — TrackTest is not actually wired up; the certification is self-graded by the app. A content-claims lint script exists and already blocks several other fabricated terms. |

---

## 2. Detailed findings

### A. Scoring instrument

- **Where computed:** `src/lib/scoring/score-discovery.ts` (voice/discovery) and
  `src/lib/scoring/score-session.ts` (ClassIn live-class transcripts), both calling the same
  rubric in `src/lib/scoring/rubric.ts`. A third path, `src/lib/onboarding/battery/score.ts`
  (not fully read in this pass — see Open questions), scores the written battery tasks.
- **Model/determinism:** `src/lib/llm/client.ts:25-26` — `ANTHROPIC_MODEL` defaults to
  `claude-sonnet-4-6` (env-overridable). `score-discovery.ts:69` and `score-session.ts:63` both
  call with `temperature: 0`. **Not formally deterministic** — temperature 0 reduces but does not
  guarantee identical output across calls, and the model string is env-overridable, so a score
  produced under one model version is not distinguishable from one produced under another (see D).
- **Per-sector scoring:** Yes. `rubric.ts:148-212` (`GapScoresSchema`) requires one `SubScore`
  (score 0–1000, `cefr_band`, evidence string) per dimension — 6 primary + 2 supporting, scored
  every call (`rubric.ts:30-54`).
- **Combining into an "overall" figure — two different implementations that can disagree:**
  1. The LLM itself returns `overall_cefr` (`rubric.ts:182-188`), explicitly scoped to the **6
     primary dimensions only** — the schema description says *"do not factor in
     business_vocabulary or presentation_delivery."*
  2. The dashboard independently computes its own "live" overall band:
     `src/app/(app)/dashboard/page.tsx:162-171` averages **every row returned from
     `gap_scores` where `is_canonical = true`** (`page.tsx:108-111` — no skill filter), which
     includes the 2 supporting dimensions the LLM's own `overall_cefr` explicitly excludes, then
     runs that average through `scoreToCefrBand`/`scoreToLp18`.
  These two "overall level" numbers are computed from different skill sets and can disagree for
  the same student at the same moment. Observed.
- **Clamping/rounding/weighting:** `SubScore.score` is Zod-validated as an integer 0–1000
  (`rubric.ts:148-154`) — a hard validation bound, not a runtime clamp. The dashboard's overall
  average is a plain arithmetic mean (`page.tsx:165-167`) — unweighted, no smoothing.

### B. Score → LP-18 → CEFR mapping

- **Where defined:** `src/lib/scoring/rubric.ts:68-117`.
- **CEFR boundaries, exactly as they appear** (`scoreToCefrBand`, `rubric.ts:96-103`, mirrored in
  the LLM's own `SYSTEM_PROMPT` at `rubric.ts:227-234`):
  `A1: 0–199 · A2: 200–399 · B1: 400–599 · B2: 600–799 · C1: 800–899 · C2: 900–1000.`
  No comment, doc, or citation anywhere in the repo explains why these specific numbers (rather
  than, say, even sixths) were chosen. The migration that introduced the 1000-point scale
  (`supabase/migrations/0011_rescale_scores_to_1000.sql:8-9`) says only that "CEFR bands map at
  the same boundaries shifted by ×10" — i.e. it assumes an earlier, also-uncited 0–100 scheme.
- **LP-18 boundaries, exactly as they appear** (`scoreToLp18`, `rubric.ts:82-87`): the 1000-point
  scale is split into **18 EQUAL** bands of ~55.56 points each (`Math.floor(score/1000*18)`) —
  not derived from, or aligned with, the CEFR boundaries immediately above it in the same file.
- **Deviation, verified numerically.** Because CEFR bands are uneven (200/200/200/200/100/100)
  and LP-18 bands are even (55.56 × 18), the two functions disagree on roughly the 700–799 and
  850–899 ranges:

  | score | `scoreToCefrBand` | `scoreToLp18` |
  |---|---|---|
  | 700 | B2 | **C1.1** |
  | 750 | B2 | **C1.2** |
  | 850 | C1 | **C2.1** |

  **This reaches the student, live.** On `/dashboard`, each skill row shows
  `` `${score} · ${scoreToLp18(score)}` `` (`page.tsx:655`) right next to a page-level CEFR badge
  computed by `scoreToCefrBand` (`page.tsx:169-171`) — so a skill scored 720 is labelled "C1.1" in
  its own row while the same page's own stated scale (reproduced in the LLM's `SYSTEM_PROMPT`)
  calls 720 a B2 score. The same mismatch reaches the **placement-report email**:
  `src/lib/email/battery-report.ts:37-40` derives the CEFR letter shown in the email by splitting
  `scoreToLp18(score)` on `"."`, not via `scoreToCefrBand` — so the emailed band can likewise
  disagree with the band implied by the product's own stated 0–1000 scale.
- **Is the sublevel ever stored independently of the score (R1 check)?** For the **live** path:
  no — `scoreToLp18`/`scoreToCefrBand` are pure functions of a stored `score`; no column stores a
  sublevel directly. For the **orphaned 2K path** (see E): **yes, by design** —
  `src/lib/2k/engines/lp18-state-engine.ts:12-29` computes a working micro-level (1–18) directly
  from an evidence pool with no underlying 0–1000 score concept at all (own version string
  `LP18-STATE-v1.0.0`, `lp18-state-engine.ts:30`). This is a second, deterministic (non-LLM)
  level-assignment engine, architecturally incompatible with the live one.

### C. Taxonomy

- **Primary (6):** `speaking, listening, writing, reading, grammar, live_interaction`
  (`rubric.ts:30-37`).
- **Supporting (2):** `business_vocabulary, presentation_delivery` (`rubric.ts:46-49`) — scored
  every call, shown as secondary evidence, excluded from the LLM's own `overall_cefr`.
- **Prior taxonomy (pre-2026-09-21):** `speaking_fluency, listening_comprehension, writing_formal,
  reading_intent, business_vocabulary, presentation_delivery`
  (`supabase/migrations/0001_initial_schema.sql:99-102`).
- **Two schemes coexist right now, by design, at the database level.**
  `supabase/migrations/0057_widen_skill_taxonomy.sql` widened the `skill` CHECK constraint on
  7 tables (`gap_scores`, `role_baselines`, `gap_score_history`, `workplace_observations`,
  `curriculum_lessons`, `lesson_completions`, `tutor_feedback`) to accept **both** key sets
  simultaneously (`0057_widen_skill_taxonomy.sql:74-79`), and the migration's own comment states
  the old-key support is deliberately not yet dropped pending a verified zero-rows check
  (`0057:24-26`). `gap_score_history` specifically is "intentionally UNTOUCHED" by the rename
  backfill (`0058_backfill_skill_taxonomy_renames.sql:37-43`), so its historical rows permanently
  mix old and new keys for the same underlying construct.
- **CEFR letter bands:** `A1,A2,B1,B2,C1,C2` (`rubric.ts:68`).
- **LP-18 sublevels:** `A1.1…C2.3` (`rubric.ts:71-78`), and independently re-declared in
  `src/lib/2k/engines/lp18-state-engine.ts:33-52` for the unrelated 2K engine.
- **Enforcement:** DB-level CHECK constraints on the `skill` column of every table listed above
  (`0001`, `0010_roles_baselines.sql`, `0019_gap_score_history.sql`, widened by `0057`). CEFR/LP-18
  bands are enforced only as TypeScript literal unions / Zod enums (`rubric.ts:68,80`), not as a
  DB constraint — nothing in the schema stops a sublevel string from being written anywhere a
  text/jsonb column accepts it.

### D. Provenance and versioning (R6)

- **`gap_scores` full column list** (assembled from `0001_initial_schema.sql:96-109`,
  `0016_phase_0b_battery.sql:47-48`, `0017_battery_seed_prompts.sql:41-45`,
  `0011_rescale_scores_to_1000.sql`): `id, student_id, skill, score, target, source, created_at,
  updated_at, is_canonical`. **No model, prompt-version, rubric-version, or code-version column.**
- **`gap_score_history`** (`0019_gap_score_history.sql:9-21`): `id, student_id, skill, score,
  target, source, scored_at`. Same gap.
- **Prompt/rubric versioning in the repo:** none found. `SYSTEM_PROMPT` (`rubric.ts:221-289`) and
  `SESSION_SYSTEM_PROMPT` (`session-rubric.ts`, not fully read) are plain exported string
  constants with no version tag; a prompt edit leaves no trace in the data it produces.
- **Could a score from today be distinguished from one produced three months ago by a different
  model?** **No.** `source` only records *which pipeline* wrote the row (`discovery`, `session`,
  `battery_task`, …), never *which model/prompt version*. Confirmed absent, matching the brief's
  flagged known gap.

### E. Discovery / placement flow

**Live flow** (traced end to end):
1. Signup → `students` row auto-created (`0001_initial_schema.sql:69-82`).
2. `/onboarding` → `discovery-session.tsx` starts an Aria (ElevenLabs ConvAI) voice call via
   `@caistech/discovery-agent`/`@caistech/elevenlabs-convai`.
3. Call ends → `src/app/api/convai/webhook/route.ts` (signature-verified, `route.ts:259-265`) →
   persists transcript to `convai_conversations`/`convai_messages`, mirrors to
   `discovery_sessions.transcript_json` (`route.ts:414-425`), flips
   `students.discovery_status` (`route.ts:433-437`), then calls
   `scoreDiscoverySession()` (`route.ts:446-467`) → writes 8 `gap_scores` rows via
   `setCanonicalGapScores` (`score-discovery.ts:103-112`).
4. `/onboarding/post-call` polls `/api/onboarding/discovery/status`, then auto-advances to
   `/onboarding/battery` (`post-call-status.tsx:143`).
5. `/onboarding/battery` — 4 task types (`email_writing, listen_paraphrase, read_summarise,
   vocab_cloze`), adaptively selected by `select-tasks.ts` based on how well voice already
   measured each skill (`select-tasks.ts:63-199`). Submission →
   `/api/onboarding/battery/submit` → `reconcileBatteryScore()` → `setCanonicalGapScore()`
   (`reconcile.ts:31-50`), which demotes the discovery-sourced row for that skill.
6. → `/lessons` (per `onboarding/session/page.tsx:19` comment) and `/plan`.

**Prompts:** fixed sets, not randomly generated at runtime. Battery prompts live in
`discovery_task_prompts` (DB rows seeded in `0017_battery_seed_prompts.sql`) — **2 prompts per
task type observed in the seed migration** (8 total across the 4 task types), each tagged a
`variant_bucket` (e.g. `b2-soft-ask`) explicitly described as "equivalent-difficulty" alternates
for attempt-1-vs-retest use (`0017:7-10`) — see H for whether that's actually exercised.

**Sectors assessed:** speaking (voice, self-paced talk), listening (voice: Aria's questions +
the in-call "Sarah/Mark" hint-reading test described in `rubric.ts:251-255`, plus
`listen_paraphrase` battery task with real streamed TTS audio), writing (`email_writing` battery
task — voice alone only infers this), reading (`read_summarise` battery task + the Sarah/Mark
test), grammar and live_interaction (voice only, no battery task exists for either —
`select-tasks.ts:12-25`).

**Session length:** no hard time limit found in the discovery call config in this pass (see Open
questions — the ElevenLabs agent-side `max_duration_seconds` was not inspected). The battery is
turn-based per task, no overall timer found.

**A second, entirely separate assessment system exists and is unreachable from any navigation
path.** `src/lib/2k/**` (26 files: `lp18-state-engine.ts`, `lp1000-engine.ts`,
`diagnostic-engine.ts`, `hysteresis-engine.ts`, `adjudication-engine.ts`,
`question-bank.ts`, etc.) implements a 25-question "2K" battery
(`src/app/(app)/assessment/page.tsx:25-27`: *"25-question intelligence journey"*) with its **own**
tables — `assessment_sessions`, `assessment_responses`, `assessment_processing_events`
(`0030_2k_assessment_pipeline.sql:14,45,69`), `canonical_results`, `lesson_outcomes`,
`evidence_objects` (`0033_2k_closed_loop.sql:13,27,49`) — entirely disjoint from `gap_scores`.
**Grep across `src/` for any link to `/assessment` found none** outside the route's own
self-referencing `redirect()` call (`assessment/page.tsx:15`) — no `<Link>`, no nav item, no CTA
anywhere else in the app points at it. It is built, routed, auth-gated, and dead.

### F. Audio, transcripts and retention (R7)

- **Live Aria-discovery path:** no "Vapi" reference exists anywhere in `src/` — the app uses
  ElevenLabs ConvAI exclusively (`supabase/migrations/0001_initial_schema.sql:121-123` even notes
  the briefing's Vapi naming was superseded). **No app-side audio storage was found** for the
  discovery call — only the text transcript is persisted
  (`discovery_sessions.transcript_json`, `convai_webhook/route.ts:420`). No retention/expiry/
  deletion logic was found for `discovery_sessions`, `convai_conversations`, or
  `convai_messages` in this pass. ElevenLabs' own recording/retention settings were not
  inspected (no explicit override of ElevenLabs recording config was found in
  `scripts/provision-discovery-agent.ts`).
- **ClassIn path:** raw audio is downloaded and transcribed via OpenAI Whisper
  (`src/app/api/classin/sync/[sessionId]/route.ts:99-100`, `src/lib/transcription/whisper.ts` —
  not fully read); `classin_sessions.recording_url` stores a reference
  (`0001_initial_schema.sql:149-159`). No retention logic found for this table either.
- **The one real, working retention mechanism found belongs to the orphaned 2K system:**
  `src/app/api/cron/2k-retention/route.ts` — a daily Vercel cron (`vercel.json:12-15`) deletes
  raw response audio from the private `2k-assessment-audio` storage bucket after
  `LP_2K_AUDIO_RETENTION_DAYS` (default 90, `2k-retention/route.ts:30`), then nulls the
  `audio_id` reference. This infrastructure runs on schedule even though nothing feeds the 2K
  battery live (see E) — so in practice it has nothing to sweep.
- **Conclusion for R7:** for the system real students actually go through, there is **no stated
  or enforced retention policy** for transcripts; for audio, nothing is stored by the app at all
  (so there is nothing to retain or lose on our side, but also no record of ElevenLabs' own
  retention terms in the repo).

### G. Consent and privacy (R8)

- **`students` table has no consent column** (`0001_initial_schema.sql:42-52` — full column
  list: `id, classin_user_id, employer_id, name, email, target_level, discovery_status,
  created_at, updated_at`).
- **No consent UI was found** preceding the discovery call (`discovery-session.tsx`, grepped for
  "consent"/"privacy" — zero matches) or at signup.
- **The only "consent" object in the codebase** is in the orphaned 2K flow:
  `assessment-runner.tsx:99-102` sends `{ audio_recording: true, data_processing: true }` to
  `POST /api/2k/assessments` — **hardcoded `true`, with no checkbox or prior screen in the
  component rendering it**, and this code path is unreachable (see E).
- **Static privacy notice exists:** `src/app/privacy/page.tsx` — a real, non-placeholder policy
  (8 sections: what's collected, use, AI processing, retention, third parties — explicitly
  states data is hosted in Tokyo and processed by overseas providers — rights, security,
  contact), carrying an explicit **"Template notice… have it reviewed by legal counsel"**
  banner (`privacy/page.tsx:62-66`). `src/app/terms/page.tsx` also exists (not read in full this
  pass). Neither is gated behind an acceptance checkbox anywhere found.
- **Data-subject functions:** the privacy policy promises export/deletion on request
  (`privacy/page.tsx` §6), but no self-serve export/delete *code path* was found in this pass
  (see Open questions).

### H. Reliability support

- **Parallel-forms data exists but is not exercised for retesting.** `discovery_task_prompts`
  seeds two prompts per `variant_bucket` per task type, explicitly described as interchangeable
  for "attempt 1 vs re-test" (`0017_battery_seed_prompts.sql:7-10`). `select-tasks.ts` (the live
  battery-selection logic) chooses *which skill* to probe based on gap-vs-baseline, but nothing
  in it, or anywhere else grepped, selects the *other* bucket member on a repeat attempt.
- **No stability/agreement measurement code found** (no test-retest correlation, no inter-rater
  calculation) anywhere in `src/`.
- **Status: Absent**, beyond the unused seed-data structure.

### I. External anchors

- **TrackTest:** a real, named integration surface exists —
  `src/lib/tracktest/sso.ts`, `src/lib/tracktest/eligibility.ts`, `public.certifications` table
  (`0001_initial_schema.sql:203-213`, with `tracktest_exam_id`), `/exam/[id]` page,
  `/api/certifications/*` routes. **But it does not actually reach TrackTest.**
  `tracktest/sso.ts:35-41` — `buildSsoUrl()` throws `TracktestUnavailableError` unless
  `TRACKTEST_API_KEY`/`TRACKTEST_PARTNER_ID` are configured, and the code comment states real
  SSO signing is "pending vendor docs" (`sso.ts:1-11`). The actual exam-completion path shipped
  is `src/app/api/certifications/[id]/simulate/route.ts`: it reads the student's own current
  `gap_scores` average (`simulate/route.ts:67-88`), compares it to a **hardcoded floor table**
  (`A2:200, B1:400, B2:600, C1:800, C2:900` — `simulate/route.ts:17-23`, matching
  `CEFR_TARGET_FLOOR` in `rubric.ts:110-117`), and writes `passed`/`failed` to `certifications`
  with `tracktest_exam_id: "sim-<id>"` and `result_json.simulated: true`
  (`simulate/route.ts:93-113`). **The "certification" is the platform grading its own score
  against its own floor and labelling it a TrackTest result; it is not an independent,
  third-party-administered exam result.**
- **CEFR descriptor text:** none found anywhere in the repo (no quoted "Can Do" statements, no
  citation to the Council of Europe CEFR document or any page reference). The only place CEFR
  band *boundaries* are stated is the uncited numeric table in `rubric.ts` (see B).

### J. Teacher session reports

- **Exist as built pages, wired to the orphaned data store.**
  `src/app/(app)/teacher/students/[id]/report/page.tsx` imports
  `listCompletedAssessments`/`loadAssessmentPipeline` from `src/lib/2k/journey-data.ts` and
  `buildTeacherIntelligenceView` from `src/lib/2k/teacher-intelligence.ts`
  (`report/page.tsx:5-7`) — i.e. it reads `assessment_sessions`/`canonical_results`, **not**
  `gap_scores`/`discovery_sessions`. Since nothing in the live flow (E) ever populates those
  tables, this report page has no real data to show for any student who only went through
  Aria discovery + the written battery.
- **No teacher-assigned CEFR micro-level storage was found** outside the 2K `canonical_results`
  JSONB blob. The separate, genuinely-live `teacher_notes` table
  (`0045_teacher_notes.sql:12-19`) is free text only (`body text`, max 2000 chars) — no
  level/band field.
- **Linked to the learner?** Yes, via `org_can_view_student`/`resolveTeacherReportContext`
  (`0038_org_model_additive.sql:159-196`, `journey-data.ts:6-13`) — a real, RLS-backed
  permission gate — but gating access to data that, for a live student, does not exist.
- **Calibration/benchmark/inter-rater features:** none found.
- **A second page has the identical problem:** the learner-facing
  `/dashboard/journey` page (`src/app/(app)/dashboard/journey/page.tsx:4-6`) also imports
  `loadResultHistory`/`loadLatestPipeline`/`buildLearnerDeliveryView` from the same `2k/*`
  modules. It is **linked directly from the main dashboard** whenever a student has any
  canonical `gap_scores` (`dashboard/page.tsx:298-306`, tooltip: *"how your communication state
  develops across 2K assessments"*) — so a real student who completes the live discovery+battery
  flow sees a "Journey view" button that is enabled, but takes them to a page backed by a table
  their activity never wrote to.

### K. ClassIn (R4)

- **All ClassIn-touching code:** `classin_sessions` table (`0001_initial_schema.sql:149-169`),
  `src/app/api/classin/session-end/route.ts` (stamps attendance; its own comment says the
  client-side trigger is "not yet wired", `session-end/route.ts:6`),
  `src/app/api/classin/sync/[sessionId]/route.ts` (the real pipeline: fetch analytics →
  download recording → Whisper transcript → score), `src/lib/classin/api.ts` (not fully read),
  `src/lib/scoring/score-session.ts`, `src/lib/scoring/session-rubric.ts`.
- **Does ClassIn data reach the derived scoring path? Yes — directly, and by design.**
  `score-session.ts:1-12` states its own effect plainly: *"Upserts gap_scores rows ONLY for
  sub-skills the session exercised (source='session')."* `scoreSession()`
  (`score-session.ts:51-103`) sends the ClassIn (or manually-pasted, see below) transcript to the
  same Claude rubric pipeline used for discovery, then calls `setCanonicalGapScores()`
  (`score-session.ts:101-103`) — the identical canonical-write helper discovery uses
  (`set-canonical.ts:50-117`), which **demotes the prior canonical row (e.g. the discovery-
  sourced one) and can set the ClassIn-sourced row as the new canonical score** for that skill.
  That canonical row is what the dashboard, the radar, the plan generator, and the baseline
  "meets role floor" rollup all read.
  Additionally, `/api/classin/sync/[sessionId]` accepts a **manually-pasted transcript**
  (`{ transcript_text }` in the POST body) as an explicit bypass while real ClassIn credentials
  are pending (`sync/[sessionId]/route.ts:12-14,71-74`), so this path is live and reachable today
  without any real ClassIn integration at all.
- **Evidence the LLM *discovery call itself* does not ingest ClassIn data:**
  `scoreDiscoverySession()` (`score-discovery.ts:52-146`) takes only `{studentId,
  conversationId, transcript}` from the discovery webhook and never queries `classin_sessions`.
- **Conclusion:** the reference-model statement "ClassIn data is excluded from the derived
  scoring path" is **true only for the specific Aria/LLM discovery prompt**. It is **false for
  the canonical score store** (`gap_scores`) that the dashboard/plan actually read from — a
  ClassIn-derived (or manually substituted) score can become, and is explicitly designed to
  become, the canonical score for a skill, overriding the discovery-derived one.

### L. Learner journey features

| Feature | Status | Evidence |
|---|---|---|
| Placement report generation | Exists | `src/lib/email/battery-report.ts` — Resend email with per-skill LP-18 bands (via `scoreToLp18`, see B's caveat) + a book-a-demo CTA. Triggered after battery completion (wiring not fully traced in this pass). |
| Learner-facing progress view | Exists (dashboard), broken (Journey view) | `/dashboard` reads live `gap_scores` correctly; `/dashboard/journey` reads the orphaned 2K tables (see J). |
| AI practice / role-play | Schema only | `micro_lessons.type` CHECK includes `'role_simulation','peer_duel'` (`0001_initial_schema.sql:177-180`), but no scoring/generation code for these specific lesson types was located in this pass — see Open questions. |
| Re-assessment scheduling/prompting | Manual only | `/onboarding` link on the dashboard is titled "re-measures your level… use it when your role changes" (`dashboard/page.tsx:307-309`) — student-initiated, not scheduled/nudged. No cron or nudge rule for "time to retest" was found in `src/lib/nudges`. |
| Cohort/grouping logic | Exists | `organisation_departments` (`0038_org_model_additive.sql:86`), `staff_department_allocation` (`0043_staff_department_allocation.sql`). |
| Manager/organisation dashboard | Exists | `employer_admins` (`0012_employer_admins.sql:16`), `/employer/*` routes (not all read). |
| Org/multi-tenant model | Yes | `organisations` / `organisation_memberships` / `platform_admins` (`0038_org_model_additive.sql:32,57,106`) — one deployment can serve multiple employer organisations, each with its own students/teachers/departments. |
| Roles/permissions — who sees a learner's scores | Exists, RLS-backed | `org_can_view_student()` (`0038:159-196`): the student themself, org `owner`/`hr`, or a `teacher` explicitly assigned to that student (via `student_teacher_assignments`, migration 0014). Enforced both at the DB policy level (`0040_teacher_report_context.sql`) and redundantly in the app loader (`journey-data.ts:6-13`). |

### M. Course and content layer

- `public.curricula`, `public.curriculum_lessons`, `public.lesson_completions`,
  `public.curriculum_resets`, `public.tutor_feedback` —
  `supabase/migrations/0037_curriculum_engine.sql`. A real, versioned content model: lessons
  belong to a `curriculum_id`, completions are append-only
  (`0037:105-112`, a trigger raises on UPDATE/DELETE), and `curriculum_resets` is an explicit
  audit trail of *why* a plan was rewritten (`0037:9`).
- Separately, `public.micro_lessons` (`0001_initial_schema.sql:174-189`) — an older/parallel
  content unit shape (`email_sprint, speak_score, listen_decode, vocab_challenge,
  role_simulation, peer_duel, report_rewrite, word_web`) with its own `score_before`/
  `score_after` columns. Relationship between `micro_lessons` and the newer `curriculum_lessons`
  was not fully traced in this pass (see Open questions) — this is a **third** content/lesson
  table family, after the 2K pipeline's own (separate) task/response tables.
- Content-generation code: `src/lib/curriculum/curriculum-engine.ts` and
  `curriculum-reset.ts` generate/reset the plan from `gap_scores`
  (per `.context/PROJECT_STATE.md:39-41`, corroborating comments seen in `set-canonical.ts`).

### N. Infrastructure and processors

- **Supabase:** project `uovbwccvxgdghqvlpuql` (`supabase/config.toml:1,6`). Region is **not
  stated in any repo config file** found in this pass; `src/app/privacy/page.tsx` §5 states in
  prose that "our database is hosted in Tokyo, Japan" — this is marketing/legal copy, not a
  verified infra setting, and was not cross-checked against the live Supabase project (no DB
  credentials available this session).
- **Vercel:** `vercel.json` defines 3 crons (`nudges`, `hr/cron/holiday-notice`,
  `cron/2k-retention`) — no explicit function region override found, so it runs on Vercel's
  project default (not independently confirmed).
- **Third parties and what they receive:**
  - **Anthropic** (`src/lib/llm/client.ts`) — receives the full discovery/session transcript
    text for scoring (`score-discovery.ts:62-82`, `score-session.ts:73-77`), and separately
    generates lesson/plan content.
  - **OpenAI** (`OPENAI_API_KEY`, `.env.example:21`) — Whisper transcription of ClassIn
    recordings only (`src/lib/transcription/whisper.ts`, called from
    `classin/sync/[sessionId]/route.ts:100`).
  - **ElevenLabs** (`ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID`/`ELEVENLABS_WEBHOOK_SECRET`,
    `.env.example:25-31`) — the voice call itself (audio in both directions) + receives the
    post-call transcript/metadata via its own webhook delivery.
  - **Resend** (`RESEND_API_KEY`, `.env.example:42-44`) — transactional email + the battery
    placement-report email (recipient email, name, company, and skill scores are sent in the
    email body, `battery-report.ts`).
  - **"Vapi," named explicitly in the audit brief's own reference model, does not appear
    anywhere in `src/`.** The repo's own migration comment flags this directly:
    *"briefing names this column vapi_call_id; we use ElevenLabs ConvAI instead"*
    (`0001_initial_schema.sql:121-123`).
- **Environment variable names in use** (from `.env.example`; names only, no values read):
  `NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY,
  ELEVENLABS_API_KEY, ELEVENLABS_WEBHOOK_SECRET, ELEVENLABS_AGENT_ID, CONVAI_TOOL_SECRET,
  CLASSIN_APP_ID, CLASSIN_APP_SECRET, RESEND_API_KEY, SMTP_FROM_DOMAIN,
  SUPABASE_ACCESS_TOKEN, GITHUB_PACKAGES_TOKEN (commented out), NEXT_PUBLIC_VENDOR_NAME,
  NEXT_PUBLIC_VENDOR_EMAIL, NEXT_PUBLIC_VENDOR_PHONE, NEXT_PUBLIC_VENDOR_CALENDLY,
  NEXT_PUBLIC_VENDOR_INSTAGRAM, RESEND_FROM_EMAIL`. Additional vars referenced elsewhere in code
  but not in `.env.example`: `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`, `ANTHROPIC_BASE_URL`,
  `LP_2K_AUDIO_RETENTION_DAYS`, `LP_2K_CRON_SECRET`, `CRON_SECRET`, `TRACKTEST_API_KEY`,
  `TRACKTEST_PARTNER_ID`, `TRACKTEST_SSO_HOST`, `DISCOVERY_SESSION_SECRET`,
  `ELEVENLABS_PLAN_AGENT_ID`. (Two local files, `.env.local.copy` and
  `.env.development.local.qa-bak`, exist in the repo root — their contents were **not read**,
  per the ground rules; flagged only so their presence is visible to whoever reviews this.)

### O. Private packages

`package.json` declares 6 `@caistech/*` packages:

| Package | Version | Imported where | Would the app build without it? |
|---|---|---|---|
| `@caistech/corporate-components` | ^0.3.0 | **Nowhere** — zero matches in `src/` or `scripts/` for `corporate-components` | **Observed: appears to be dead weight.** No import found anywhere; removing it from `package.json` was not tested (ground rules forbid a dependency-changing action), but no source file references it. |
| `@caistech/dataroom-core` | ^0.1.1 | 8 files under `src/lib/investor/*` (dataroom, report-spec, watermark-pdf, report-pdf, build-report, answer, retrieval, ask-prompt) | No — the investor dataroom feature imports it directly. |
| `@caistech/discovery-agent` | ^0.1.0 | `src/lib/onboarding/aria-discovery-config.ts`, `aria-discovery.ts`, `src/app/(app)/onboarding/discovery-session.tsx` | No — this is the live Aria voice-call wiring (E). |
| `@caistech/elevenlabs-convai` | ^0.17.1 | `src/app/api/convai/*` (webhook, bind, token), plan/investor voice routes | No — this is the webhook/memory/voice-widget substrate for every voice surface in the app. |
| `@caistech/sayfix-embed` | ^0.6.0 | `src/components/conditional-sayfix.tsx` | No — the bug-report widget. |
| `@caistech/webmcp-kit` | ^0.1.0 | `src/agent-readiness.config.ts`, `(marketing)/layout.tsx`, `.well-known/agent.json/route.ts`, `llms.txt/route.ts` | No — the agent-discoverability surfaces. |
| `@caistech/portfolio-gate` | ^0.18.0 (devDependency) | `.github/workflows/gate.yml`, `tests/hr/machine-routes.test.ts`, `src/app/api/hr/cron/holiday-notice/route.ts` | CI/test-time only, not a runtime app dependency. |

### P. Claims in the product

- **`src/content/home.ts:152`** — *"Live classes and micro-lessons targeted at your gaps.
  Progress re-measured as you go. **CEFR-aligned certification through TrackTest.**"* This is the
  one unambiguous external-validation claim found in user-facing copy. Per I above, no real
  TrackTest integration exists — the certification shown to a student is the app grading its own
  `gap_scores` average against its own hardcoded floor table and writing `simulated: true`
  (`certifications/[id]/simulate/route.ts:93-101`). The claim is not false about the *existence*
  of a certifications feature, but is materially unsupported as a claim of **independent/external**
  validation, which "certification through TrackTest" implies to a reader.
- **A content-claims lint exists and is already catching some of this class of problem:**
  `scripts/check-content-claims.mjs` scans `src/content`, `(marketing)`, `/demo`, `/about`,
  `/pricing`, and the quick-walkthrough component for a list of forbidden/fabricated terms
  (`"six-dimension", "gap score", "cohorts", "audit-grade", …`, `check-content-claims.mjs:21-30`)
  against an explicit **approved-noun allowlist**: `LP-18, CEFR, TrackTest, placement report,
  micro-lesson, live class, ClassIn, communication signals, micro-band`
  (`check-content-claims.mjs:11-13`). TrackTest is on the *approved* list — i.e. the lint is
  designed to permit the word "TrackTest" in copy, not to verify that the underlying integration
  is real. It would not catch the I/P finding above.
- No other instance of "certified," "validated," "accurate," "LP-1000," or a bare percentage/
  statistic claim was found in `src/content/home.ts`, `(marketing)/method/page.tsx`, or
  `(marketing)/book-a-demo/page.tsx` in this pass (grepped, not exhaustively read line by line —
  see Open questions).

---

## 3. Deviations from the reference model (§6)

- **R1 — LP-18 is a derived view of the score, never stored/set independently.**
  **Consistent** for the live path (`scoreToLp18`/`scoreToCefrBand` are pure functions of a
  stored `score`; no column stores a sublevel). **Deviates** for the orphaned 2K subsystem: its
  `lp18-state-engine.ts` computes a working micro-level directly from an evidence pool with no
  underlying 0–1000 score at all — a parallel design that would violate R1 if that pipeline were
  ever connected to a real user. Dormant today because E's 2K path is unreachable.

- **R2 — Scores are produced per sector: listening, speaking, writing.**
  **Consistent**, and more granular than stated — 8 sectors are scored per call (6 primary +
  2 supporting), including listening/speaking/writing. See A, C.

- **R3 — Score history is longitudinal; earlier scores are never overwritten.**
  **Consistent**, via two cooperating mechanisms: `gap_scores` keeps one canonical row per
  (student, skill, source) and demotes (never deletes) the prior canonical row
  (`set-canonical.ts:50-63`); `gap_score_history` is append-only (`gap_score_history.ts:9-21`,
  enforced only by convention/comment, not a DB trigger — **no append-only trigger was found on
  `gap_score_history`**, unlike `lesson_completions` which does have one, `0037:105-112`). One
  caveat: `setCanonicalGapScore` **skips appending to history when the new score equals the
  previous history point** (`set-canonical.ts:100-116`), which is a deliberate de-dup, not a
  violation, but means "every assessment adds a row" is not literally true — an unchanged
  re-score adds no history row.

- **R4 — ClassIn data is excluded from the derived scoring path.**
  **Deviates.** See K. The Aria/LLM discovery prompt itself never ingests ClassIn data, but
  ClassIn-derived (or manually-substituted) scores are explicitly designed to write into, and can
  become canonical in, the same `gap_scores` table the dashboard/plan read from.

- **R5 — The taxonomy is enforced at the database level.**
  **Consistent**, via CHECK constraints — but see C: the constraint currently accepts two
  generations of the taxonomy simultaneously, so "enforced" currently means "enforced against a
  union of old and new," not against the new taxonomy alone.

- **R6 — Every score row records provenance (model/prompt/rubric/code version).**
  **Not implemented.** Confirmed absent on both `gap_scores` and `gap_score_history`. See D.

- **R7 — Discovery-session audio is retained under a defined policy, not lost.**
  **Cannot fully determine / likely not implemented for the live path.** No audio is stored by
  the app for the live Aria flow (only ElevenLabs holds it, terms not in repo); no retention
  policy for the transcript was found either. A real retention policy exists, but only for the
  unreachable 2K pipeline's audio bucket.

- **R8 — Learner consent is captured before assessment data is collected.**
  **Not implemented.** No consent column, no consent UI, confirmed on the live path. See G.

- **R9 — Any CEFR/LP-18 mapping is traceable to a stated source, not hard-coded without
  explanation.**
  **Deviates.** The CEFR 0/200/400/600/800/900 boundaries and the LP-18 even-18-way split are
  both hard-coded with no cited external source, and (per B) are internally inconsistent with
  each other.

### Other deviations the reference model doesn't name

1. **Two independent "overall CEFR" computations that can disagree** — the LLM's own
   `overall_cefr` (6-dimension scope) vs. the dashboard's live-computed overall band (8-dimension
   scope). See A.
2. **A third, architecturally separate scoring/leveling engine exists in the repo
   (`src/lib/2k/**`) with its own tables, its own deterministic (non-LLM) level-assignment logic,
   and its own retention cron — fully built but unreachable from any navigation path**, while two
   *other* live, linked pages (`teacher/students/[id]/report`, `dashboard/journey`) are wired to
   read from it and will show no data for a real student. This is the single largest
   structural finding in this audit: the "sandbox platform" is actually two independently-evolved
   assessment products sharing one codebase, one of which is dead but still partially exposed in
   the UI.
3. **A marketing claim of third-party certification ("CEFR-aligned certification through
   TrackTest") is served by a code path explicitly named `simulate` and explicitly flagged
   `simulated: true` in its own stored result.**
4. **The existing content-claims lint (`check-content-claims.mjs`) would not catch finding #3**,
   because it checks for the *presence* of disallowed terms, not whether an *approved* term
   (TrackTest) is backed by a real integration.

---

## 4. Open questions

- **Exact ElevenLabs recording/retention configuration** for the Aria discovery agent (call
  recording on/off, vendor-side retention window) — not inspected; would require reading
  `scripts/provision-discovery-agent.ts` in full and/or the ElevenLabs agent config pulled at
  provision time, neither of which was fully read in this pass.
- **Written battery scoring internals** (`src/lib/onboarding/battery/score.ts`) — referenced by
  `reconcile.ts` but not itself read; could change the A/B findings if it applies its own
  rounding/weighting before calling `reconcileBatteryScore`.
- **`session-rubric.ts` full contents** — read only by reference (via `score-session.ts`'s
  import); the exact ClassIn scoring prompt/schema was not itself inspected line-by-line.
- **Relationship between `micro_lessons` (0001) and `curriculum_lessons` (0037)** — whether one
  superseded the other, or both are live in different surfaces. Not resolved in this pass.
- **Whether `role_simulation`/`peer_duel` micro-lesson types have any actual generation/scoring
  code**, or exist only as an unused CHECK-constraint value (parallel to the 2K orphan pattern
  found elsewhere in this repo). Not resolved.
- **Database verification was not possible this session** — no read-only Supabase credentials
  were supplied, so every finding above about *row counts* (e.g., "nothing populates
  `assessment_sessions`") is **inferred from the absence of any writer in the code**, not
  confirmed by querying the live table. A single `select count(*) from assessment_sessions` (and
  the equivalent for `canonical_results`, `gap_score_history` old-vs-new skill keys, and
  `certifications.result_json->>'simulated'`) would convert several "Inferred" claims above into
  "Observed."
- **Actual Supabase project region** — the privacy policy's "Tokyo, Japan" claim was not
  cross-checked against the Supabase dashboard/Management API (no token used, per ground rules
  on paid/management calls not being pre-authorized for this read-only pass).
- **Full text of `/terms`, `(marketing)/method/page.tsx`, `(marketing)/book-a-demo/page.tsx`** —
  grepped for specific keywords, not read in full; a slower line-by-line pass could surface
  additional claims beyond the one found in `home.ts`.

---

## 5. Where I looked

**Read in full:**
`supabase/migrations/0001, 0011, 0016, 0017, 0019, 0030, 0033, 0037 (partial), 0038 (partial),
0040 (partial), 0045, 0057, 0058, 0060`; `src/lib/scoring/rubric.ts, set-canonical.ts,
score-discovery.ts, score-session.ts`; `src/lib/llm/client.ts` (partial);
`src/app/api/convai/webhook/route.ts`; `src/app/api/classin/session-end/route.ts,
sync/[sessionId]/route.ts`; `src/app/api/certifications/[id]/simulate/route.ts`;
`src/lib/tracktest/sso.ts` (partial); `src/app/privacy/page.tsx`;
`src/app/(app)/assessment/assessment-runner.tsx` (partial), `page.tsx`;
`src/lib/onboarding/battery/reconcile.ts, select-tasks.ts`; `src/lib/email/battery-report.ts`
(partial); `src/app/(app)/dashboard/page.tsx` (partial, key sections);
`src/app/(app)/dashboard/journey/page.tsx` (partial);
`src/app/(app)/teacher/students/[id]/report/page.tsx` (partial);
`src/lib/2k/engines/lp18-state-engine.ts` (partial); `src/lib/2k/journey-data.ts` (partial);
`.env.example`; `vercel.json`; `supabase/config.toml`; `scripts/check-content-claims.mjs`;
`.context/PROJECT_STATE.md` (top ~90 lines); `package.json` (dependency block).

**Searched (grep) but not fully read:** `src/lib/2k/**` (26 files — structure/exports inspected,
most bodies not read), `src/lib/classin/*`, `src/lib/transcription/whisper.ts`,
`src/lib/onboarding/battery/score.ts, types.ts`, `src/lib/scoring/session-rubric.ts,
baselines.ts`, `src/lib/curriculum/*`, `src/content/home.ts` (keyword grep only),
`(marketing)/method/page.tsx`, `(marketing)/book-a-demo/page.tsx`, all of `src/app/employer/*`.

**Not accessed at all:** the live Supabase database (no credentials provided this session — see
Open questions), the ElevenLabs dashboard/agent config, the Vercel project dashboard, any
`.env.local*` file (not read, per the no-secrets rule), Stripe/any billing surface (not in scope
of this brief).

**Commands run:** `git log`, `git status`, `git branch -a` (repo state only — no DB queries, no
paid-API calls, no writes).
