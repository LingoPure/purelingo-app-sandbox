# Gap Analysis: Current Codebase vs Dan's Commercial Specification

Date: 2026-09-11
Prepared by: Dennis McMahon
Source: `docs/LingoPure_Technology_Dan_Docs/` (Dan's technology spec package)

---

## What we have (LingoPureAI repo)

| Layer | Status | Detail |
|---|---|---|
| **App shell** | ✅ Built | Next.js 16, App Router, responsive Tailwind, auth pattern (Supabase email/password + magic link) |
| **Marketing** | ✅ Built | Sales-flow canvas, homepage, onboarding, 10-stage landing |
| **Student dashboard** | ✅ Shell | Gap bars, next class, activity log — rendered but data hooks incomplete |
| **Voice agent** | ✅ Built | ElevenLabs ConvAI discovery session, post-call webhook, memory extraction |
| **AI scoring** | ✅ Partial | Anthropic gap scoring, persona discovery, session scoring, speak scoring — all working against thin prompts, no governed 2K pipeline |
| **Investor dataroom** | ✅ Built | RAG via `@caistech/dataroom-core`, report generation, PDF watermark, voice Morgan |
| **HR module** | ✅ Built | Leave management, calendar, balance adjustment, teacher/department models, cron |
| **ClassIn** | ⏳ Placeholder | Embed structure exists, awaiting EEO commercial credentials |
| **Demo booking** | ✅ Partial | Endpoint exists (`/v1/student/demo-bookings`), creates class + lesson, 3-day advance rule — but no connection to assessment pipeline |
| **Email** | ✅ Built | Resend via `@caistech/email-send` wrapper, HR notifications, nudges |
| **Supabase schema** | ✅ Built | 29 migrations, RLS on every table, auth triggers, storage buckets |
| **CI/CD** | ✅ Built | GitHub Actions (gate, health-sensors, hr-module, claude-code), dependabot |
| **Admin** | ✅ Partial | Content admin, marketing content editing, QA admin, employer admin auth |

---

## What Dan's docs describe (the commercial closed circuit)

| Component | Dan's ID | What it must do | Current status |
|---|---|---|---|
| **25Q assessment journey** | C01 | LOCATE Q1-5, BOUND Q6-10, RESOLVE Q11-15, PERTURB Q16-20, CONFIRM Q21-25 — mic, timer, progress, retry, resume | ❌ Not built |
| **Identity/session service** | C02 | learner_id, assessment_id, session_id, consent, context | ❌ Not built as separate service |
| **Response ingestion** | C03 | Validate payload, idempotency, persist metadata, enqueue processing | ❌ Not built |
| **Audio/media storage** | C04 | Durable immutable raw audio object + URI/checksum | ❌ Not built |
| **Transcription service** | C05 | Client STT + server ASR fallback (Whisper); version transcript | ⚠️ Partial — Whisper exists but not wired to assessment flow |
| **Audio intelligence** | C06 | Latency, pauses, pitch/energy, repair timing, intelligibility | ❌ Not built |
| **Communication analysis** | C07 | Structured meaning/intent/task/language/receiver/repair/context analysis | ❌ Not built — current scoring is thin-prompt Anthropic |
| **Evidence packet builder** | C08 | Observations → governed evidence with provenance, independence, quality, confounds, counter-evidence | ❌ Not built |
| **R1-R10 adjudication** | C09 | Accept/reject/downweight; contradiction and unresolved handling | ❌ Not built |
| **LP-18 state engine** | C10 | 18 micro-levels × 6 capabilities; working state; coverage/confidence | ❌ Not built — schema has gap_scores but no 108-state resolution |
| **Hysteresis/state transition** | C11 | Prevent one-event state rewrites; working→stable transition rules | ❌ Not built |
| **Telemetry engine** | C12 | 12D contextual telemetry weights; evidence-derived behavioural state | ❌ Not built |
| **LP-1000 scoring** | C13 | Derived score/band/confidence/components | ❌ Not built |
| **Diagnostic engine** | C14 | 24 archetypes, gap origin, counter-evidence, hypothesis testing, confidence | ❌ Not built — 2,592 seeds in spec, no engine |
| **A-J recommendation control** | C15 | A-I canonical intervention selection; J probe/hold when unsafe/uncertain | ❌ Not built — 432 interventions + 108 J controls in spec, no engine |
| **Five-memory layer** | C16 | Canonical, evidence, state, intervention, decision — versioned stores | ❌ Not built |
| **Version/lineage registry** | C17 | Brain, ontology, bank, rules, question, ASR, evidence, lens, report versions | ❌ Not built |
| **Canonical result freeze** | C18 | Immutable result, complete lineage, result_id | ❌ Not built |
| **Learner delivery** | C19 | CEFR/LP-18/LP-1000, strengths, constraints, diagnosis, recommendation, report | ❌ Not built |
| **Teacher intelligence** | C20 | Evidence, state, telemetry, diagnosis/why, intervention, next probe, lesson focus | ❌ Not built |
| **Teacher outcome capture** | C21 | Observation, learner response, notes/artifacts, intervention linkage, next action | ❌ Not built |
| **Observability/recovery** | C22 | Trace each assessment, retries, dead-letter/error states, recovery | ❌ Not built |

---

## Summary gap count

| Category | Built | Partial | Not built |
|---|---|---|---|
| Platform shell (auth, marketing, admin, HR) | 5 | 1 | 0 |
| **2K intelligence pipeline (the core product)** | 0 | 1 (Whisper) | **14 of 15** |
| Teacher closed loop | 0 | 0 | 3 |
| Observability/security | 0 | 0 | 2 |

**Core finding:** The existing codebase is a well-structured platform shell. The 2K intelligence pipeline — the actual product — is 14 of 15 components unbuilt. Current "scoring" is thin Anthropic prompts, not the governed pipeline.

---

## Systematic infill approach

### Phase 0 — Contract freeze (before any code)
- [ ] Freeze 8 cross-boundary data contracts (§5 of CEFR doc)
- [ ] Freeze the minimum API contract (12 endpoints, §6)
- [ ] Freeze the processing state machine
- [ ] Freeze 14 launch acceptance gates (G1–G14)
- [ ] Choose infrastructure: Supabase (DB + auth + storage), Vercel (app + cron), job queue for async

### Phase 1 — Skeleton pipe
- Wire existing 25Q assessment journey to persistent backend
- Create assessment/session/response tables (new migrations)
- Build dummy CanonicalAssessmentResult from existing thin-prompt scoring
- Prove: frontend → backend → persistent storage → frontend

### Phase 2 — Real capture
- Audio capture (MediaRecorder API) + durable upload to Supabase Storage
- Wire existing whisper.ts into assessment flow
- Session resume/recovery

### Phase 3 — Real 2K runtime (largest phase)
- Extract canonical data banks (2,592 seeds, 432 interventions, 108 J controls, 7,200 audio examples) from standalone HTML into versioned stores
- Build Communication Analysis Object (C07)
- Build Evidence Packet Builder (C08)
- Build R1-R10 Adjudication (C09)
- Build LP-18 State Engine (C10)
- Build Hysteresis/State Transition (C11)
- Build Telemetry Engine (C12)
- Build LP-1000 Realization (C13)
- Build Diagnostic Engine (C14)
- Build A-J Recommendation Control (C15)

### Phase 4 — Memory + freeze
- Five-memory layer (canonical, evidence, state, intervention, decision)
- Version/lineage registry
- Canonical result freeze

### Phase 5 — Learner + teacher surfaces
- Learner view: render from frozen result
- Teacher intelligence: from same frozen result
- Teacher outcome capture

### Phase 6 — Teacher demo loop
- Wire demo-booking → assessment → frozen result → teacher → outcome → memory

### Phase 7 — Hardening
- Cross-device QA, load/latency, retries, monitoring, privacy, security, runbook
- Run G1–G14 acceptance gates with real users

---

## What is NOT a launch blocker (per Dan's docs)
- 4K empirical population calibration
- 5K predictive/control optimization
- Perfect acoustic feature coverage on every device
- Full LMS replacement
- Full billing/payments stack
- Every enterprise dashboard
- All modalities beyond speaking
- Automatic global re-weighting
- Large-scale ML personalization

---

## Canonical data bank artefacts (in `Dan_Docs/LingoPure Technology/`)
- `LP18_Data_Bank_v8_Audio_Example_Bank_7200.xlsx` — 7,200 deep-context utterance examples
- `LP18_Recommendation_Data_Bank_v6_Audio_Integrated_Master_Bank.html` (25MB) — recommendation data bank
- `LP18_Master_Brain_Web_v6.1_Live_Governed_Audio_Integrated.html` — interactive architecture view
- `LP_Speaking_Intelligence_Demo_v22.html` — CEFR speaking demo reference
