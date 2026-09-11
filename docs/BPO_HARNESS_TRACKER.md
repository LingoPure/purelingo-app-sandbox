# BPO Harness Build — Issues Tracker

Date created: 2026-09-12
Based on: `docs/BPO_HARNESS_SCOPE.md`
Tracker pattern: `docs/ISSUES_TRACKER.md`

## Phase 1 — Synthetic Data Layer

- [ ] **BH-001**: Synthetic artifact generator (email + contact-centre call transcripts, 12 agents across 3 roles × 2 teams, deterministic/seeded/idempotent) + `workplace_artifacts` table migration (RLS, harness-scoped `@*.demo`)

## Phase 2 — Edge Analysis Package

- [ ] **BH-002**: Edge package behind interface (`src/lib/bpo/edge.ts`): `analyzeWorkplaceArtifacts()` → structured packets; reuses C07 communication-analysis + C08 evidence-packet-builder + C13 lp1000-engine; export firewall (no raw content in packets)

## Phase 3 — Cloud Ingestion

- [ ] **BH-003**: Structured ingestion route (`POST /api/bpo/edge/ingest`): writes `gap_scores` (source=`'workplace'`), `gap_score_history` (0019), 2K evidence pool; `workplace_observations` table migration; rejects raw-content payloads via schema validation
- [ ] **BH-004**: `CAPABILITY_TO_SKILL` mapping contract + C07/C08/C13 realisation wiring: SPK→speaking_fluency, LIS→listening_comprehension, RDG→reading_intent, VOC→business_vocabulary, INT→presentation_delivery, GRM→writing_formal

## Phase 4 — Re-measurement + Trend

- [ ] **BH-005**: Re-measurement flow: generator batch 2 (post-training state) → `gap_scores` (source=`'workplace_trained'`) + history rows; delta report (baseline vs trained)

## Phase 5 — Org Intelligence (§12)

- [ ] **BH-006**: §12 org rollup query + route (`GET /api/bpo/org/[employerId]/intelligence`): capability by role, by team, common gaps, training demand, improvement trend

## Phase 6 — Orchestrator + Delivery

- [ ] **BH-007**: Harness orchestrator script (`npm run bpo:harness`): generate → analyse → ingest → re-measure → report; `bpo-harness-purge.ts` rollback script

## Phase 7 — Acceptance Gates

- [ ] **BH-008**: G1–G13 acceptance-gate fixtures executed on deterministic synthetic data; unblocks ISS-038/042 data-path gate runs
