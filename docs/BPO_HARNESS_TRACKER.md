# BPO Harness Build — Issues Tracker

Date created: 2026-09-12
Based on: `docs/BPO_HARNESS_SCOPE.md`
Tracker pattern: `docs/ISSUES_TRACKER.md`

## Phase 1 — Synthetic Data Layer

- [x] **BH-001**: Synthetic artifact generator (email + contact-centre call transcripts, 12 agents across 3 roles × 2 teams, deterministic/seeded/idempotent) + `workplace_artifacts` table migration (RLS, harness-scoped `@*.demo`) — `generator.ts` + migration 0034

## Phase 2 — Edge Analysis Package

- [x] **BH-002**: Edge package behind interface (`src/lib/bpo/edge.ts`): `analyzeWorkplaceArtifact()` → structured packets; reuses C07 communication-analysis + C08 evidence-packet-builder; export firewall (no raw content in packets) — 4/4 tests passing (incl. export-firewall + determinism assertions)
- [x] **BH-004**: `CAPABILITY_TO_SKILL` mapping contract (declared for BH-002 co-location)

## Phase 3 — Cloud Ingestion

- [x] **BH-003**: Structured ingestion route (`POST /api/bpo/edge/ingest`): strict-zod export firewall (raw-content keys rejected, 400), writes `workplace_observations` (append-only, artifact-scoped), `gap_scores` (source=`'workplace'`), `gap_score_history` (0019); migration 0035 expands `gap_scores.source` check + adds `workplace_observations` table + RLS; 5/5 firewall tests passing

## Phase 4 — Re-measurement + Trend

- [x] **BH-005**: Re-measurement flow: generator batch param (`baseline`|`trained`), trained content banks (agent-authored, structurally improved); migration 0036 (`batch` column on workplace_artifacts); `computeDelta()` pure core + `loadDeltaReport()` DB-backed loader → per-agent/skill/role deltas + employer mean; 4/4 delta-report tests passing

## Phase 5 — Org Intelligence (§12)

- [x] **BH-006**: §12 org rollup route (`GET /api/bpo/org/[employerId]/intelligence`): `loadOrgIntelligence()` pure + DB loader — overall capability, capability by role/team, common gaps (gap > GAP_MARGIN), training demand (lowest-first), improvement trend (employer + per-role delta); guarded by `requireEmployerAdmin`; 5/5 intelligence tests passing

## Phase 6 — Orchestrator + Delivery

- [x] **BH-007**: Harness orchestrator script (`npm run bpo:harness`): generate baseline → analyze/ingest → generate trained → analyze/ingest (demotes baseline canonical) → print intelligence rollup; `npm run bpo:harness:purge` for idempotent re-runs

## Phase 6 — Orchestrator + Delivery

- [ ] **BH-007**: Harness orchestrator script (`npm run bpo:harness`): generate → analyse → ingest → re-measure → report; `bpo-harness-purge.ts` rollback script

## Phase 7 — Acceptance Gates

- [ ] **BH-008**: G1–G13 acceptance-gate fixtures executed on deterministic synthetic data; unblocks ISS-038/042 data-path gate runs
