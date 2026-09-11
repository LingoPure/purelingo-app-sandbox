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
- [ ] `EvidenceAuthority` union (§5) does not match the framework doc §6.1 taxonomy (`TRIANGULATED` used in worked examples) — decide mapping vs amendment
- [ ] `AtomicAudioSignal` encodes NOT_OBSERVED twice (`value: null` + `observed: false`) — collapse to one
- [ ] `capabilities[].level`, `recommendation.family`, `diagnosis.archetype` are open strings — close with derived unions (family + CEFR levels already exported from api-contract.ts)

### Acceptance gates
- [ ] **ISS-010**: Define G1–G14 acceptance gate test specs as TypeScript constants

## Phase 1 — Skeleton Pipe

### Assessment journey
- [ ] **ISS-011**: Build 25Q assessment UI (LOCATE/BOUND/RESOLVE/PERTURB/CONFIRM stages)
- [ ] **ISS-012**: Wire assessment to persistent backend (create assessment, save responses)
- [ ] **ISS-013**: Build dummy CanonicalAssessmentResult from existing thin-prompt scoring
- [ ] **ISS-014**: Wire frontend → backend → persistent storage → result display

## Phase 2 — Real Capture

### Audio
- [ ] **ISS-015**: Audio capture (MediaRecorder API) with device fallback
- [ ] **ISS-016**: Durable audio upload to Supabase Storage with checksum
- [ ] **ISS-017**: Wire existing whisper.ts into assessment transcription flow
- [ ] **ISS-018**: Session resume/recovery (browser-close → resume same assessment)

## Phase 3 — Real 2K Runtime (largest phase)

### Data bank extraction
- [ ] **ISS-019**: Parse canonical data banks from HTML/Excel into versioned Supabase stores (2,592 seeds, 432 interventions, 108 J controls)
- [ ] **ISS-020**: Parse 7,200 audio examples bank into storage

### Pipeline components
- [ ] **ISS-021**: Build Communication Analysis Object engine (C07)
- [ ] **ISS-022**: Build Evidence Packet Builder (C08)
- [ ] **ISS-023**: Build R1-R10 Adjudication engine (C09)
- [ ] **ISS-024**: Build LP-18 State Engine — 18 micro-levels × 6 capabilities (C10)
- [ ] **ISS-025**: Build Hysteresis / State Transition rules (C11)
- [ ] **ISS-026**: Build Telemetry Engine — 12D contextual (C12)
- [ ] **ISS-027**: Build LP-1000 Realization engine (C13)
- [ ] **ISS-028**: Build Diagnostic Engine — 24 archetypes (C14)
- [ ] **ISS-029**: Build A-J Recommendation Control (C15)

## Phase 4 — Memory + Freeze

- [ ] **ISS-030**: Implement five-memory layer (canonical, evidence, state, intervention, decision) (C16)
- [ ] **ISS-031**: Implement version/lineage registry (C17)
- [ ] **ISS-032**: Implement canonical result freeze — immutable + complete lineage (C18)

## Phase 5 — Learner + Teacher Surfaces

- [ ] **ISS-033**: Build learner delivery view — CEFR/LP-18/LP-1000 from frozen result (C19)
- [ ] **ISS-034**: Build teacher intelligence view — evidence, state, telemetry, diagnosis, intervention (C20)
- [ ] **ISS-035**: Build teacher outcome capture (C21)

## Phase 6 — Teacher Demo Loop

- [ ] **ISS-036**: Wire demo-booking flow → assessment → frozen result → teacher delivery
- [ ] **ISS-037**: Wire teacher outcome → new evidence → re-evaluate → memory update (closed loop)

## Phase 7 — Hardening

- [ ] **ISS-038**: Cross-device QA (iPhone Safari, Android Chrome, Desktop)
- [ ] **ISS-039**: Load/latency targets + retries
- [ ] **ISS-040**: Observability/recovery — trace every assessment (C22)
- [ ] **ISS-041**: Security — auth, media controls, retention, raw audio access
- [ ] **ISS-042**: Run G1–G14 acceptance gates with real external test users
