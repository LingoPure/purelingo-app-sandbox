# BPO Harness — Scope

Status: **DRAFT** · Date: 2026-09-12 · Source: `docs/LingoPure Workplace Communication Intelligence — Target Architecture & Project Plan.md` (Phases 4–8, §§12–18)

## Purpose (one paragraph)

The full product proposition — **workplace gap → learning plan → training → outcome → workplace re-analysis** — depends on client data that does not exist yet. The BPO harness is the stand-in: it simulates the client environment (Phase 5 "Workplace Edge MVP") with synthetic workplace communication for a fake BPO, runs local analysis using the existing 2K engines, and exports only **structured** packets into LingoPure Cloud (Phase 4 "simulated gap data", line 728). When the loop closes on synthetic data — baseline gaps → training → measurable improvement → §12 org intelligence — the proposal is demonstrable without any real client, and the acceptance gates (ISS-038/042) become runnable on deterministic data instead of waiting for external testers.

## The loop being built (Phase 7 closed-loop)

```text
synthetic email + call artifacts (per agent, per role)
        │
        ▼
[Workplace Edge]  local analysis  ── C07 comms analysis + C08 evidence + C13 realization
        │
        ▼
structured packet (observations, capability estimates, gaps)
        │                                        ← NO raw content exported
        ▼
LingoPure Cloud  ── ingest into gap_scores (source='workplace') + 2K evidence pool
        │
        ▼
existing learning surfaces (micro_lessons / certifications) → outcome recorded
        │
        ▼
re-measurement → new artifact batch + gap_scores (source='workplace') + history (0019)
        │
        ▼
§12 rollup: capability by role/team, common gaps, training demand, improvement trends
```

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Harness form | Edge is a package behind an interface; in-repo demo harness consumes it | Target arch is a client-installable Edge; interface keeps that true while the demo runs inside this repo |
| Workplace sources (Phase 5 PoC) | Email + contact-centre call transcripts | One written + one voice, per doc line 740 |
| Cohort scale | 12 agents across 3 roles × 2 teams/shifts; parameterised for 50–100 | §12 rollup needs role/team dimensions; Phase 8 is a config change |
| Acceptance gates | Harness drives G1–G13 deterministically on synthetic data | Unblocks ISS-038/ISS-042 data path; external devices still needed for UX-only checks |
| Analysis surface | C07/C08/C13 → 2K evidence **and** mapped scores → `gap_scores` (`source='workplace'`) | One analysis, two surfaces; lights up the existing employer radar/roster |
| Closed loop training | Reuse `micro_lessons` / `certifications`; outcome lands as `source='workplace_trained'` | Reuses the existing lesson loop; no parallel training system |

## In scope

1. **Synthetic artifact generator** — deterministic, seeded (idempotent). Email/chat threads + contact-centre call transcripts, one realistic exchange per artifact, tagged with source kind, role, team, agent, timestamp. Content drawn from the canonical banks where possible (workshop prompts, role scenarios in `seed-demo.ts`).
2. **Edge package behind an interface** — `src/lib/bpo/edge.ts` defines the Edge contract: `analyzeWorkplaceArtifacts(artifacts) → StructuredPacket[]`. Reuses C07 (`communication-analysis`) for text + spoken analysis, C08 (`evidence-packet-builder`) for evidence, C13 (`lp1000-engine`) for capability realization. Enforces the export firewall: the packet carries observations/scores/evidence only, never raw content (doc §18 explicit export controls).
3. **Structured ingestion** — in-repo API surface (existing cloud): write `gap_scores` rows with `source='workplace'` / `source='workplace_trained'` (schema already supports per-source uniqueness since 0017, history table 0019), and the 2K evidence pool so the canonical memory layers see workplace evidence.
4. **Capability→skill mapping contract** — declared `CAPABILITY_TO_SKILL` map: `SPK → speaking_fluency`, `LIS → listening_comprehension`, `RDG → reading_intent`, `VOC → business_vocabulary`, `INT → presentation_delivery`, `GRM → writing_formal`.
5. **Re-measurement + trend** — a second artifact batch per agent (post-training state) → new `gap_scores` + gap history rows (0019) → improvement trend.
6. **§12 org-intelligence rollup** — query/route producing: capability by role, by team/shift, common gaps, training demand, improvement trend; enough to render the demo dashboard the §12 example implies.
7. **Harness orchestrator** — `npm run bpo:harness` (tsx, mirroring `scripts/hr-seed-demo.ts`/`scripts/extract-databanks.mjs`): generate → analyze → ingest → report (baseline vs trained delta table).
8. **G1–G13 acceptance-gate execution** — deterministic fixtures that run the gates without external users.

## Out of scope (locked early)

- Real client connectors (M365 / Google Workspace / Zendesk / Salesforce etc.) — Phase 10
- Actual client deployments, VPC/on-prem/sovereign levels (doc §17 L2–L4)
- §13 KPI correlation beyond a read-only stub field (no CSAT/AHT wiring)
- Any open/LLM analysis by default — the deterministic engines are the source of truth for the harness
- Voice synthesis/ASR — call artifacts are **transcripts** (text), not audio, for the harness MVP
- New training content — reuses existing `micro_lessons` / `certifications` surfaces
- Learner-facing UI changes

## Data model changes (migrations, idempotent)

- `workplace_artifacts` — synthetic artifact store: `artifact_id`, `agent_id`, `source_kind` (`email` | `call`), `role`, `team`, `content` (structured), `created_at`, `batch` (`baseline` | `trained`)
- `workplace_observations` — structured packet sink: `observation_id`, `agent_id`, `artifact_id`, `capability`, `score`, `evidence`, `source`, `created_at` (append-only)
- `gap_scores` — new `source` values `'workplace'` and `'workplace_trained'`; `is_canonical` policy defined per source
- `gap_score_history` (0019) — write on every harness ingest so trends render
- RLS: harness writes via the same learner-scoped pattern as existing sources

## API surface

- `POST /api/bpo/edge/ingest` — receive structured packets (the §15 conceptual `POST /workplace/competency-observations`). Rejects raw-content payloads (schema validation, §18).
- `GET /api/bpo/org/[employerId]/intelligence` — §12 rollup
- `POST /api/bpo/harness/run` — guarded orchestrator trigger (or CLI `npm run bpo:harness`); `@machine-callable`-style guard consistent with repo middleware
- Reuses existing `/api/2k/*` evidence writes; no new external-key flow

## Issue breakdown (tracker: `docs/BPO_HARNESS_TRACKER.md`, mirrored after the 2K `ISS-` pattern)

| Issue | Component | Build |
|---|---|---|
| BH-001 | Artifact generator (email + call, 12-agent cohort, deterministic) | `scripts/` + `workplace_artifacts` migration |
| BH-002 | Edge package contract (analyze → packet, export firewall) | `src/lib/bpo/edge.ts` |
| BH-003 | Workplace ingest into `gap_scores` + 2K evidence + history | route + `workplace_observations` migration |
| BH-004 | `CAPABILITY_TO_SKILL` mapping + realisation wiring (C07/C08/C13) | lib mapping + tests |
| BH-005 | Re-measurement + trend (baseline vs trained history) | generator batch 2 + 0019 writes |
| BH-006 | §12 org rollup query + route | `GET /api/bpo/org/[employerId]/intelligence` |
| BH-007 | Orchestrator `npm run bpo:harness` + baseline-vs-trained report | tsx script |
| BH-008 | G1–G13 gate fixtures executed on synthetic data | `src/lib/2k/acceptance-gates.ts` invocation |

Ordering: BH-001 → BH-002 → BH-003 → BH-004 → BH-005 → BH-006 → BH-007 → BH-008. Each issue independent for review; 003 depends on 002's packet shape.

## How we know it's done (acceptance)

- `npm run bpo:harness` end-to-end: generates, analyses, ingests, and prints a baseline-vs-trained delta table where agents who "complete training" show improvement in their mapped skills and overall capability trend.
- `GET /api/bpo/org/{id}/intelligence` returns role/team/gap/demand rows for the 12-agent cohort (and at 50–100 with the size config changed only).
- No raw content present in any packet, observation row, or exported payload (assert in tests).
- G1–G13 gates pass deterministically on synthetic data; ISS-038/042 reduced to device-only UX checks.
- `tsc --noEmit` and `eslint` clean; harness script and routes covered by `tsx --test` tests.

## Failure modes and rollback (worst-first)

- **Harness pollutes real pricing data** → all harness rows are fake-employer/`@*.demo` scoped (same pattern as `seed-demo.ts`), and a `bpo:harness:purge` script deletes only harness-tagged rows. Rollback = purge.
- **Mapping skews rollups** (`GRM→writing_formal` folds register into formal writing) → the mapping is a single declared constant; removing a mapping line reverts behaviour, no data migration needed.
- **Engine reuse drifts from assessment semantics** → workplace analysis is an application of C07, not a fork; any change lands in the shared engine, both paths benefit.
- **Export firewall breach (raw content reaching cloud)** → schema validation rejects raw payload shapes; test asserts every packet is structured-only.
- **Gates still blocked on devices** → harness covers the data path; only the physical-device UX checks (ISS-038) remain external.

## File map (proposed)

- `src/lib/bpo/edge.ts` — Edge contract + packet schema
- `src/lib/bpo/generator.ts` — synthetic artifact generation (deterministic, seeded)
- `src/lib/bpo/capability-to-skill.ts` — the declared mapping constant
- `src/lib/bpo/intelligence.ts` — §12 rollup queries
- `scripts/bpo-harness.ts` — orchestrator (`npm run bpo:harness`)
- `scripts/bpo-harness-purge.ts` — rollback/purge
- `src/app/api/bpo/edge/ingest/route.ts`, `src/app/api/bpo/org/[employerId]/intelligence/route.ts`, `src/app/api/bpo/harness/run/route.ts`
- `supabase/migrations/00NN_bpo_harness.sql` — artifact + observation tables
- `docs/BPO_HARNESS_TRACKER.md` — issue tracker
- `tests/bpo/*.test.ts` — unit + integration

## Testing

- Unit: deterministic generator output (same seed → same artifacts); mapping contract; packet schema rejection of raw content.
- Integration (`tsx --test`, mirroring `tests/hr`): full harness run against a harness-provided Supabase (the existing `tests/hr/harness.ts` pattern), asserting delta table correctness and rollup rows.
- Hygiene: no test depends on the real pricing/enrolment path.
