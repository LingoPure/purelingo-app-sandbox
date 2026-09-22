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

## Phase 8 — Live-config block (mostly DONE on the sandbox — updated 2026-09-19)

These were **environment/config items, not code**. As of 2026-09-19 the demo lives on
`purelingo-app-sandbox.vercel.app` (Supabase `uovbwccvxgdghqvlpuql`), and a full
discovery → battery → plan run has completed live. See `docs/integration-status.md` §0.

- [x] **ISS-043**: Live Aria voice smoke test — DONE 2026-09-19: live discovery call ran on
      the deployed site + agent `agent_8701m2eyrep6exysepd25r16msst`; transcript replayed (43 msgs).
- [x] **ISS-044**: Live Supabase reconnect — DONE: live project `uovbwccvxgdghqvlpuql`
      (LingoPure Sandbox) is the running backend for the sandbox deploy.
- [x] **ISS-045**: Vercel reconnect — DONE: `purelingo-app-sandbox` Vercel project watches
      `LingoPure/purelingo-app-sandbox`; both git remotes deploy.
- [ ] **ISS-046**: `ELEVENLABS_WEBHOOK_SECRET` — only needed if provision created a NEW
      workspace webhook (ElevenLabs → Webhooks); otherwise the existing secret still matches

## Phase 9 — Sandbox testing feedback (2026-09-20: Daniel, Shamini, Thao)

Sourced from `docs/lingopure feedback folder 20092026/` (raised 2026-09-20, triaged 2026-09-21).
Full narrative + screenshot evidence: `LingoPure_Sandbox_Testing_Feedback.docx` in that folder.
Per-issue audit trail (raised → action → resolved): `docs/ISSUE_LOG.md`. Not yet scoped —
severity tags are a triage starting point, to be confirmed in scoping.

### Critical
- [ ] **ISS-047** `[CRITICAL]`: Score inconsistency — Dashboard shows overall **B2.3**, My Programme
      shows **B1**, from the *same* six `gap_scores` rows. Trace both pages to the one saved
      assessment/mapping; make the programme consume whichever result is canonical. (Daniel §04,
      Review Section 06 screenshot.)
- [ ] **ISS-048** `[CRITICAL]`: Six capability dimensions don't match Dan's reference framework.
      Sandbox shows *Speaking, Listening, Writing, Reading intent, Vocabulary, Presenting*; required
      per Dan's LP-18 spec is *Reading, Writing, Speaking, Grammar, Listening, Live Interaction*.
      Reconcile across radar charts, lists, `role_baselines`, results, and programme logic; confirm
      whether the mismatch reaches into `rubric.ts`/prompts/storage or is display-only. (Daniel §02
      + reference `LingoPure_LP18_Master_Brain_Web_v6.1...html`.)
- [x] **ISS-049** `[CRITICAL]`: Org setup — entering `prelabz` as the company name throws a raw
      `organisations_slug_key` duplicate-key Postgres error to the user; a random name succeeds.
      Investigate create/retry semantics (does each submit create a new org? do partial attempts
      persist?); build a real "join existing org" flow (name match ≠ membership — separate orgs may
      share a display name); replace the raw DB error with guidance and preserve entered details for
      retry. (Daniel §03, Review Section 08 screenshot.) Fixed `8218c2e` — `runSelfSetup()` retries
      the insert with a random slug suffix on a `23505` unique-violation (up to 5 attempts) and
      returns a friendly message, never the raw Postgres text, on the non-recoverable path; covered
      by `tests/org/self-setup.test.ts`. **Not done**: the real "join existing org" flow (name
      match ≠ membership) — still just silently mints a second organisation with a suffixed slug.
- [ ] **ISS-050** `[HIGH]`: Target inconsistency — dashboard target badge shows **C2.1** while the
      skill target line and My Programme both show **C1**. Confirm whether these are legitimately
      different targets (e.g. pre- vs post-discovery re-target) or a bug. (Daniel §02/§04.)

### High
- [ ] **ISS-051** `[HIGH]`: Auth — magic-link login shows "Email link is invalid or has expired" on
      mobile. Repro + smoke-test against the current Supabase auth config (redirect allowlist / token
      expiry). (Shamini, `WhatsApp Image 2026-09-19 at 23.31.05.jpeg`.)
- [ ] **ISS-052** `[HIGH]`: Live transcription missing — completed turns render after the fact, but no
      interim/live transcript appears while the student is speaking, and no mic-input-level indicator
      is shown. Determine whether the ConvAI/STT path exposes partial transcripts that the UI drops,
      or only returns finalized turns. Pass condition: live text appears during speech and finalises
      without duplicate messages. (Daniel §03, Review Section 08 screenshot.)

### Medium
- [ ] **ISS-053** `[MED]`: Aria discovery — duplicate questions observed: asked for role, got an
      answer; separately asked for "responsibility in the meeting," got an answer; then asked again.
      Confirm whether this predates or postdates the 2026-09-19 prompt rewrite (`125beb7`, Dimension 2
      = 3 true turns) — re-verify against the currently live provisioned prompt before treating as a
      regression. (Thao, voice memo transcript.) **Code fixed, NOT yet deployed** — `8218c2e` cross-
      references Dimension 1 (Role) and Dimension 3 (Responsibilities) in
      `scripts/discovery-system-prompt.ts` so the agent builds on an answer already given instead of
      re-asking it. Requires `npx tsx scripts/update-discovery-prompt.ts --target prod` (needs
      `ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID`, not available to this session's tool permissions) to
      reach the live agent — leave unchecked until that push happens and is re-verified live.
- [ ] **ISS-054** `[MED]`: Aria should adapt spoken complexity to the student's level — mirror simple
      sentence structure back if the student speaks simply. (Thao, voice memo transcript.) **Code
      fixed, NOT yet deployed** — same `8218c2e` prompt change, same live-push blocker as ISS-053.
- [ ] **ISS-055** `[MED]`: Role drifted between setup and results — setup showed "Inbound Customer
      Service," results show "Inbound Sales." Confirm with Daniel whether he changed it during setup;
      if not, investigate persistence. (Daniel §04.)
- [ ] **ISS-058** `[MED]`: CEFR-18 micro-levels visible on the completed Dashboard are not carried into
      My Programme or spoken by Aria's plan-agent explanation. (Daniel §02.)
- [ ] **ISS-059** `[MED]`: No distinction shown between role-minimum gap and target-level gap — 5 of 6
      role gaps display `0` while C1 remains a stated goal, reading as contradictory. Show both gap
      types separately and explain how each influences practice. (Daniel §04.)
- [ ] **ISS-060** `[MED]`: Missing/insufficient evidence must render as "Not assessed" / "Insufficient
      evidence" — never silently collapse to a zero score or "no gap." (Daniel §02.)
- [x] **ISS-061** `[MED]`: Live Interaction capability needs its 12 supporting telemetry signals (Tone
      Alignment, Adaptive Shifting, Frame Integrity, Semantic Continuity, Repair Behaviour, Cognitive
      Load Alignment, Response Latency, Turn-Taking Behaviour, Hierarchy Sensitivity, Cultural
      Continuity, Hesitation Markers, Drift Detection) exposed individually, each tagged
      measured / inferred / insufficient-evidence. (Daniel §05 + reference "LP Telemetry Framework"
      infographic.) Fixed `71f4bb4` — new "Live interaction telemetry" section on
      `/dashboard/journey` lists all 12 with a score bar + evidence-status pill. **Caveat**: that page
      is powered by the separate 2K assessment pipeline, which the live discovery→battery→plan flow
      does not populate — so a real tester sees the honest "No telemetry recorded yet" empty state,
      not live data, until that pipeline gets wired to real flow. Verified live in browser per the
      commit message.

### Low
- [x] **ISS-056** `[LOW]`: Intro video duration label wrong — heading states "60s," actual clip is
      0:26. (Daniel §03, Review Section 07 screenshot.) Fixed `8218c2e` — reads the real duration
      from the video element's `loadedmetadata` event instead of a fixed guess.
- [x] **ISS-057** `[LOW]`: Copy bugs — placeholder string `"for your role as your role"`; "Learning
      style" should read "Learning preferences"; a pre-assessment programme/commitment CTA appeared
      with N/A scores, unlabeled as sample data. (Daniel §03/§04.) First two fixed `e5e89e0`; third
      (N/A sample labeling + gap-driven duration instead of a fixed 16 weeks) fixed `45fc6be`.
- [x] **ISS-062** `[LOW]` (label clipping only): Radar chart labels clipped at the left edge; fixed
      `8218c2e` — widened the SVG viewBox with dedicated label margin (circle geometry unchanged).
      **Still open**: the ambiguous paired band/score display convention (e.g. "C1.1 alongside B2" on
      the same row) — not addressed, needs its own fix. (Daniel §02/§07 + screenshot.)

### Verification (gates sign-off, not a code bug per se)
- [ ] **ISS-063** `[VERIFY]`: Daniel has requested a full evidence-chain + cross-page persistence
      demo: trace responses → evidence → CEFR-18 result → identified gaps → chosen activities →
      programme duration live, and confirm Dashboard/Programme/Lessons all read the same saved result
      and survive a refresh. Gates Daniel's sign-off on Review Sections 02–05. (Daniel §05, "Checks
      required to close the review.")

## Phase 10 — Raised 2026-09-21 (mid-session, relayed by Dennis)

- [x] **ISS-064** `[MED]`: No email is sent when a student's improvement programme is generated or
      committed. Confirmed by reading `src/app/api/plan/delivery/route.ts` — `GET` builds the plan,
      `POST` only writes `plan_status`/`plan_committed_at` to `students`; neither path calls
      `@caistech/email-send` or any Resend transport. Stephen Munich and Shamini both expected an
      email summarising their generated programme after finishing the assessment/plan flow. The
      existing battery-complete report email (`af828c1`, `src/lib/onboarding/battery/report.ts`) is a
      different artifact — an LP-18 score summary + "Book a demo" CTA sent on battery completion, not
      a programme summary sent on plan generation/commitment. (Dennis, relaying Stephen Munich +
      Shamini, 2026-09-21.) **Scope clarified 2026-09-21 (see ISS-065) — folds into that broader
      reframing rather than a standalone "just add an email" fix.**
- [x] **ISS-065** `[MED]`: Sales-funnel reframing of the plan-delivery closing moment. Dennis clarified
      the discovery→battery→plan flow is a **free self-assessment / lead-gen step**, not the live
      enrolled product — the generated programme is a **sample/preview**, not active or executed.
      Three surfaces currently say or imply otherwise and need reframing: (1) `/plan` page's
      "commitment" section — currently asks the student to "commit to following the programme," should
      instead present it as a sample with a **"Book a call"** CTA; (2) `compilePlanPrompt()`
      (`src/lib/plan/plan-delivery.ts`) — Aria's voice script literally instructs her to "get a genuine
      commitment," needs to become "this is a sample — next step is a call with the team"; (3) the
      ISS-064 email needs to go out at `/plan` completion (not just battery completion), explicitly
      labeled as a sample/non-active programme, with the same Book-a-Call CTA. **Open question for
      Dennis**: is "Book a call" one generic CTA regardless of context, or does it need to branch by
      who's asking (individual self-assessor vs. someone evaluating on behalf of a BPO/call-centre)?
      Scoped as its own phase, after Phase 2 (taxonomy migration) completes. (Dennis, 2026-09-21.)
