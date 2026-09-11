# LingoPure 2K Build — Issues Tracker

Date created: 2026-09-11
Based on: `GAP_ANALYSIS_CURRENT_VS_COMMERCIAL.md`

## Phase 0 — Contract Freeze

### Data contracts (types frozen 2026-09-11 in `src/lib/2k/contracts.ts`, commit 83eacb7)
- [x] **ISS-001**: Define `AssessmentSession` TypeScript type — migration ✅ `0030`
- [x] **ISS-002**: Define `ResponseObject` TypeScript type — migration ✅ `0030`
- [x] **ISS-003**: Define `TranscriptObject` TypeScript type — migration pending (Phase 3)
- [x] **ISS-004**: Define `AtomicAudioSignals` TypeScript type — migration pending (Phase 3)
- [x] **ISS-005**: Define `CommunicationAnalysisObject` TypeScript type — migration pending (Phase 3)
- [x] **ISS-006**: Define `EvidenceObject` TypeScript type — migration pending (Phase 3)
- [x] **ISS-007**: Define `CanonicalAssessmentResult` TypeScript type — migration pending (Phase 4)
- [x] **ISS-008**: Define `LessonOutcome` TypeScript type — migration pending (Phase 5)

### API contract
- [x] **ISS-009**: Define minimum API contract types — `src/lib/2k/api-contract.ts` (12 endpoints, endpoint registry, processing state machine + pure transitions/stage helpers, `ProcessingEventObject`); events ledger ✅ `0030`

### Open contract deltas (from Phase 0 review, 2026-09-11)
- [x] `EvidenceAuthority` union (§5) does not match the framework doc §6.1 taxonomy (`TRIANGULATED` used in worked examples) — **resolved: amended** to §6.1 `DIRECT | PARTIAL | DERIVED | INFERRED | TRIANGULATED | UNOBSERVED`; C07 `ABSTAINED` literals migrated to `UNOBSERVED`
- [x] `AtomicAudioSignal` encodes NOT_OBSERVED twice (`value: null` + `observed: false`) — **resolved: collapsed**; `value: number | null` is single source of truth, `observed` dropped, `isObservedSignal()` guard added (no consumers existed)
- [x] `capabilities[].level`, `recommendation.family`, `diagnosis.archetype` are open strings — **resolved: closed** with `CefrMacroBand`, `RecommendationFamily`, `DiagnosticArchetype` (+ `Lp1000Band`) in contracts.ts; api-contract.ts now re-exports instead of re-declaring

### Acceptance gates
- [x] **ISS-010**: Define G1–G14 acceptance gate test specs as TypeScript constants — `src/lib/2k/acceptance-gates.ts` (gates §15 + test matrix §16, each pinned to blocking issues)

## Phase 1 — Skeleton Pipe

### Assessment journey
- [x] **ISS-011**: Build 25Q assessment UI — `src/app/(app)/assessment/` (server page + client runner with intro, mic, 25Q recording, timer, stage progress, processing, result); question bank ✅ `src/lib/2k/question-bank.ts`
- [x] **ISS-012**: Wire assessment to persistent backend — `src/lib/2k/service.ts` + `/api/2k/assessments` (create), `/api/2k/assessments/{id}` (load), `/api/2k/assessments/{id}/responses` (idempotent ingest), `/api/2k/assessments/{id}/evaluate`; runner wired; state machine transitions enforced via assertTransition + processing-event ledger
- [x] **ISS-013**: Build dummy CanonicalAssessmentResult — deterministic learner-stable `src/lib/2k/dummy-result.ts` (C07-shaped: coverage, LP18 working/stable, capabilities, LP-1000, telemetry, diagnosis, A–J recommendation, evidence summary, lineage; engine versions `-dummy`)
- [x] **ISS-014**: Wire full loop frontend → backend → storage → result display — runner fetches `/api/2k/assessments/{id}/result` on completion and renders LP-1000, band/confidence, recommendation, capability bars; route reads persisted responses via Supabase

## Phase 2 — Real Capture

### Audio
- [x] **ISS-015**: Audio capture (MediaRecorder API) with device fallback — runner picks the best supported MIME type (`audio/webm;codecs=opus` → `webm` → `mp4` → `ogg`) and falls back to the recorder default
- [x] **ISS-016**: Durable audio upload to Supabase Storage with checksum — `POST /api/2k/responses/{id}/audio` (canonical #4); multipart upload to private `2k-assessment-audio` bucket (migration 0031), SHA-256 checksum, service-role write + registration of `audio_id`/`upload_status` via learner-scoped RLS; runner uploads blob after each ingest (best-effort, degrades to pending not lost)
- [x] **ISS-017**: Wire existing whisper.ts into assessment transcription flow — `POST /api/2k/responses/{id}/transcribe` pulls stored audio via service-role signed URL, calls `transcribeFromUrl`, persists `client_transcript` + `processing_status='complete'`, appends TRANSCRIPTION processing event
- [x] **ISS-018**: Session resume/recovery — `findResumableAssessment` (newest CREATED/IN_PROGRESS session + answered question ids); server page injects `resumable` into runner; intro shows resume card (N/25 answered) that restores assessment_id and jumps to the first unanswered question

## Phase 3 — Real 2K Runtime (largest phase)

### Data bank extraction
- [x] **ISS-010**: Define G1–G14 acceptance gate test specs as TypeScript constants — `src/lib/2k/acceptance-gates.ts` (gates §15 + test matrix §16, each pinned to blocking issues)
- [x] **ISS-019**: Parse canonical data banks from HTML/Excel into versioned JSON (1,080 diagnostic seeds, 432 interventions, 108 J subtypes, 7,200 audio examples)
- [x] **ISS-020**: Parse 7,200 audio examples bank into storage — `data-banks/audio_examples.json`

### Pipeline components
- [x] **ISS-021**: Build Communication Analysis Object engine (C07)
- [x] **ISS-022**: Build Evidence Packet Builder (C08)
- [x] **ISS-023**: Build R1-R10 Adjudication engine (C09)
- [x] **ISS-024**: Build LP-18 State Engine — 18 micro-levels × 6 capabilities (C10)
- [x] **ISS-025**: Build Hysteresis / State Transition rules (C11)
- [x] **ISS-026**: Build Telemetry Engine — 12D contextual (C12)
- [x] **ISS-027**: Build LP-1000 Realization engine (C13)
- [x] **ISS-028**: Build Diagnostic Engine — archetype selection (C14; seeded 10-archetype taxonomy — the commercial-spec 24 is not in the data bank)
- [x] **ISS-029**: Build A-J Recommendation Control (C15)

## Phase 4 — Memory + Freeze

- [x] **ISS-030**: Implement five-memory layer (canonical, evidence, state, intervention, decision) (C16) — `src/lib/2k/memory-layer.ts`
- [x] **ISS-031**: Implement version/lineage registry (C17) — `src/lib/2k/version-registry.ts`
- [x] **ISS-032**: Implement canonical result freeze — immutable + complete lineage (C18) — `src/lib/2k/result-freeze.ts`

## Phase 5 — Learner + Teacher Surfaces

- [x] **ISS-033**: Build learner delivery view — CEFR/LP-18/LP-1000 from frozen result (C19) — `src/lib/2k/learner-delivery.ts`
- [x] **ISS-034**: Build teacher intelligence view — evidence, state, telemetry, diagnosis, intervention (C20) — `src/lib/2k/teacher-intelligence.ts`
- [x] **ISS-035**: Build teacher outcome capture (C21) — `src/lib/2k/outcome-capture.ts`

## Phase 6 — Teacher Demo Loop

- [x] **ISS-036**: Wire demo-booking flow → assessment → frozen result → teacher delivery — `pipeline-runner.ts` + `pipeline-loader.ts` + `/result` and `/report` routes (C19/C20)
- [x] **ISS-037**: Wire teacher outcome → new evidence → re-evaluate → memory update (closed loop) — `outcome-capture.ts` + `/interventions/{id}/outcome` route + migration `0033` (G10: outcome lands as evidence, history untouched)

## Phase 7 — Hardening

- [x] **ISS-039**: Load/latency targets + retries — `/assessments/{id}/retry` route + `retryAssessment` service (FAILED→RETRYING, retry counter, error cleared); load/latency targets are deferred to the G14 E2E pass
- [ ] **ISS-038**: Cross-device QA (iPhone Safari, Android Chrome, Desktop) — **needs real devices**; run when G14 testers are available
- [x] **ISS-040**: Observability/recovery — trace every assessment (C22) — `/assessments/{id}/status` ledger route + `result_frozen` event on pipeline completion (G12)
- [x] **ISS-041**: Security — auth, media controls, retention, raw audio access — secured signed-URL audio GET with denial logging (G13) + daily retention cron `/api/cron/2k-retention` (0030 RLS + private bucket already in place)
- [ ] **ISS-042**: Run G1–G14 acceptance gates with real external test users
