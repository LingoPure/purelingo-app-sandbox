# WOW Phase — Dashboard Conversion + Multi-Level Admin Scope

**Date:** 2026-09-12
**Status:** Draft for discussion
**Owner:** Dennis

---

## 1. North Star for this phase

The 2K engine (the brain) is converted to TypeScript and proven on data. This phase
turns that into the **visible, saleable experience**:

1. Convert Dan's telemetry dashboards from HTML/PNG into functional React pages.
2. Stand up a multi-level admin hierarchy so LingoPure can onboard and operate real
   client organisations.
3. Build ONE universal learner flow that all students follow, with the service
   package acting as a data-source toggle, not a feature gate.

---

## 2. Universal Learner Flow (the shared spine)

**Same flow for every learner, regardless of package.** Only the data sources differ.

```
ALL STUDENTS (same flow)
  │
  ├── 1. BASELINE: 2K assessment → LP-18 CEFR levels
  │      → target levels defined (employer requirements + learner role)
  │
  ├── 2. CURRICULUM: AI creates learning plan + timeline
  │      Four modalities:
  │      a) Live tutor sessions (human teacher)
  │      b) Writing practice
  │      c) Speaking practice (tutor + AI voice agent)
  │      d) Listening → comprehension (repeat/interpret)
  │
  ├── 3. ONGOING DATA → DYNAMIC CURRICULUM RESET
  │      Every new data point adjusts the plan:
  │      a) Lessons completed (ALL students)
  │      b) Live tutor feedback (ALL students)
  │      c) Work datasets (package-dependent):
  │         - voice recordings → BPO harness → analysis
  │         - emails, call transcripts, work outputs
  │
  └── 4. REPEAT until target achieved
```

> **BUILT (2026-09-19):** steps 1–2 are now a shipped demo flow. Discovery + battery produce the canonical LP-18 0–1000 profile; `buildPlan` (`lib/plan/plan-delivery.ts`) derives a 3-phase 16-week programme from the gap profile; the battery auto-redirects to `/plan`, where the plan is shown on-screen and delivered by a second voice agent with commitment capture. Baseline scale is uniformly LP-18 0–1000 (role_baselines / gap_scores.target / self-setup agree — fixed 2026-09-19).

### Service packages (data-source toggles, not feature gates)

| Package | Data sources feeding the curriculum | Notes |
|---|---|---|
| **1:1 Tutoring** | Lessons + tutor feedback | Smallest set |
| **Tutor + AI** | + AI voice coaching, discovery sessions | Richer feedback loop |
| **Full BPO** | + BPO harness (voice recordings, emails, work outputs) | Work-sourced data feeds curriculum |

Package selection happens at org onboarding (see §6). The learner flow itself never changes.

### 2.1 Curriculum Engine (C0) — the missing spine, now front-loaded

**Critical gap closed by eng review:** the flow above is the product, but no engine
builds or resets the curriculum. `src/lib/lessons/plan-generator.ts` is **stateless**
("Pure derivation... no database writes... called on every page load") — it ranks
micro-lessons/classes from `gap_scores` but has NO timeline, NO lesson assignment, NO
completion tracking, NO reset. The BPO harness ingests into `gap_scores`
(employer-level) but there is no per-student curriculum state.

**C0 delivers (new, ~1.5 weeks, front-loaded):**

New schema (migrations after 0036):
- `curricula` — student, target_level, timeline, version, generated_at
- `curriculum_lessons` — modality (`live_tutor` / `writing` / `speaking` /
  `comprehension`), title, materials, scheduled_at, status
- `lesson_completions` — student, lesson, completed_at, evidence
- `tutor_feedback` — structure mirrors `outcome-capture.ts`; the standing input for
  tutor feedback as a data source
- `curriculum_resets` — audit trail of WHY a plan was rewritten (provenance)

New engine:
- `src/lib/curriculum/curriculum-engine.ts` — stateful: reads (a) lessons completed,
  (b) tutor feedback rows, (c) work observations (`gap_scores source='workplace'`)
  and rewrites the plan with a version/provenance chain (mirrors `memory-layer.ts` /
  `result-freeze.ts` lineage).

Without C0 the dashboards would render data that never changes — hollow "wow".

---

## 3. Part A — Ingest & Convert Dan's HTML Designs

The engine data (12D telemetry, LP-18, LP-1000, diagnostics) already lives in
`src/lib/2k/engines/`. This part builds the visual layer around it.

### A1. Learner Dashboard — "Phuong's Journey" (`LP user case dashboard.html`)

Rendered beside the existing `/dashboard` for now (assessment insights panel). This
is a **critical page for discussion and approval** before final home placement.

| Panel | What it shows | Data source |
|---|---|---|
| Hero: "building stable cross-border project alignment" | Narrative headline from latest assessment | `learner-delivery.ts` |
| "One improvement, not twelve charts" | Single-metric focus — current improvement target | `recommendation-control.ts` |
| "How communication develops unevenly through time" | Timeline/band progression across assessments | LP-18 state history |
| "Fast gains, plateaus, setbacks and B2.2 achievement" | Achievement markers on timeline | LP-1000 band transitions |
| "Behavioural evidence across work situations" | Evidence cards | `evidence-packet-builder.ts` |
| "See the pattern without needing to understand the engine" | Simplified radar of 6 capabilities | `gap-radar.tsx` (exists) |
| "Three behaviours that move several scores at once" | Multi-impact recommendations | `recommendation-control.ts` |
| "What to do when alignment starts slipping" | Drift alerts + corrective actions | `telemetry-engine.ts` |
| "Use the right move at the right moment" | Timing-aware recommendation | `recommendation-control.ts` |
| Badge unlocks | Gamification achievements | `gamification-card.tsx` (exists) |
| "My notes" | Teacher/learner notes | NEW (DB + UI) |

### A2. Student View — Master Brain v6.1 (first half)

Includes a first-class **result page** at `(app)/assessment/results/[id]`. (The API
routes `/api/2k/assessments/[id]/result|report` exist; today the result renders
inline in `assessment-runner.tsx` — this phase gives it a dedicated page.)

| Section | Panels | Data source |
|---|---|---|
| 1. WHERE YOU STAND NOW | Actual modality scores, 6D communication state | `learner-delivery.ts`, `lp1000-engine.ts` |
| 2. WHAT IS HOLDING THE SCORE BACK | 4D recent direction, signals that matter most | `telemetry-engine.ts` |
| 3. HOW TO REACH THE NEXT SCORE | Top recommendations, path to next level, success criteria | `recommendation-control.ts`, `diagnostic-engine.ts` |

### A3. Teacher Intelligence — Master Brain v6.1 (second half)

Includes a first-class **teacher-facing report page** at
`(app)/teacher/students/[id]/report` — the deep per-student view from the teacher
portal (§7).

| Section | Panels | Data source |
|---|---|---|
| 1. ASSESSMENT RUN | Canonical result, evidence & completion | `result-freeze.ts`, `evidence-packet-builder.ts` |
| 2. 12D TELEMETRY + 4D TEMPORAL | Full telemetry grid, trajectory, temporal state | `telemetry-engine.ts`, `lp1000-engine.ts` |
| 3. DIAGNOSIS & RECOMMENDATION | Diagnostic state, problem, decision trace, prescription, LP-1000 components | `diagnostic-engine.ts`, `recommendation-control.ts` |
| 4. ASSESSMENT DECISION TRACE | Recent engine decisions + why | `pipeline-runner.ts` events |
| 5. AUDIT, LINEAGE & SNAPSHOT | Version/lineage, canonical state, raw data | `version-registry.ts`, `result-freeze.ts` |

### A4. PNG reference designs

Ingest as visual reference only (not separate pages):
- `LingoPure 4D communication telemetry dashboard.png`
- `LingoPure 4D communication visualization.png`
- `LingoPure Communication geometry analytics dashboard.png`
- `LingoPure LP1000 CCI Communication Intelligence Index Diagram v1.png`
- `LP Dynamic communication state model overview v2.png`
- `LP Telemetry communication model 2026.png`
- `LP-18 communication framework overview.png`

### A5. Data Bank (25MB HTML)

`LingoPure_LP18_Recommendation_Data_Bank_v6_Audio_Integrated_Master_Bank.html` is a
runtime simulator/control layer, **not a page to convert**. Its canonical data
(intervention families A–J, J-controls, severity multipliers) is already seeded in
`recommendation-control.ts`. Ingest any missing data rows only.

### A6. Deployment posture

All A1–A3 pages built as **standalone React pages rendering real engine data** first
(unauthed or minimal scoping). Auth/org-scoping wiring lands in §7. This satisfies
"everything ingested, converted and functional, even if standalone."

---

## 4. Part B — Multi-Level Admin Hierarchy

### 4.1 Role hierarchy (4 levels)

```
LingoPure Platform Admin (P0)
  └── Client Organisation Admin (P1)
        └── Department Head (P2)
              └── Staff / Teacher / Student (P3)
```

Cross-cutting roles outside the hierarchy:
- **Content Editor** (admin/marketing/readonly) — exists in `content_editors`
- **Investor** — leave as-is, future purpose TBD (not in this phase's scope)

**Admin mechanism (canonical):** `platform_admins` becomes the single canonical
platform-admin table; the current `ADMIN_EMAILS` middleware allowlist **seeds its
bootstrap** (first-time sync). `content_editors`, `employer_admins`, and the HR
`super_admin` role are unchanged this phase — they govern their own surfaces.

### 4.2 Canonical org model — Kira pattern (ADDITIVE, no rename)

Adopt Kira's membership pattern (`organisations → organisation_memberships`) as the
canonical identity layer. **Additive, not a rename** — `employers` stays as the org's
commercial row for this phase. Migration strategy:

| Add (new) | Columns | Notes |
|---|---|---|
| `organisations` | Kira-standard: id, name, slug, created_at | Training fields (`default_target_level`, `contract_start/end`) stay on `employers` for now |
| `organisation_memberships` | user_id, organisation_id, role, status, can_spend, valid_from, valid_to | ROLES: `owner` / `hr` / `viewer` / `teacher` / `staff` / `student` |

| Keep (existing) | Link to new layer |
|---|---|
| `employers` (commercial row) | `employers.organisation_id → organisations.id` FK |
| `students`, `teachers` (domain data) | reference `auth.users.id` as today; **no `persons` table** (see decision below) |
| `employer_admins` | migrate current rows into `organisation_memberships` (role `owner`); kept only as identity for legacy employer portal auth during cutover |

**Decision (locked):** **no separate `persons` table.** LingoPure is pure Supabase
auth — every identity keys on `auth.users.id`. Kira's `persons` exists to handle
pre-auth introducers; LingoPure has no such flow. `organisation_memberships.user_id →
auth.users.id` directly.

**Rationale:** one source of truth for org membership; Kira-proven; clean invitation
flow; additive keeps week-1 blast radius near zero and avoids a risky live rename of
an RLS-facing table.

**Departments (one canonical table):** new `departments` table **owned by
`organisations`** (`org_id`, `name`, `is_archived`), used by the org portal AND the
teacher portal. HR keeps its own department model (legal/HR entities) — this phase
states that separation explicitly. §10.5's "fixed nominated set" seeds this table.

### 4.3 DB functions (the gate layer)

Mirror the HR module's `SECURITY DEFINER` pattern (`hr_can_view_employee`,
`hr_current_employee/role/org`) — **copy the pinned `search_path` + owner pattern
exactly.** 0027 carries an explicit recursion warning on `hr_can_view_employee`
(querying a table its own RLS references); the new functions inherit the same
guard-rails (query-as-owner, pinned path), not a re-invention.

| Function | Purpose |
|---|---|
| `current_org_role(org_slug)` | Resolve caller's role for an org |
| `org_can_view_(students/teachers/roles/billing)` | RLS per org |
| `dept_can_view_(students/teachers)` | RLS per department |

### 4.4 Role → portal map

| Portal | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| `/admin` (platform console) | Full: orgs, content, billing, system | — | — | — |
| `/org/[slug]` (org config) | Read-only | Full CRUD | Read own org | — |
| `/org/[slug]/departments` | Read | Full | Own dept | — |
| `/org/[slug]/staff` | Read | Full | Invite own dept | Self |
| `/org/[slug]/students` | Read | Full | Own dept students | Own data |
| `/org/[slug]/billing` | Full | Org billing summary | — | — |
| `/teacher` (teacher portal) | — | Read org | Read dept | Own students |
| `/assessment` (2K, universal) | Read all | Read org | Read dept | Take assessment |
| `/dashboard` (learner) | — | — | — | Own dashboard |
| `/investor/*` | — | — | — | As-is |

---

## 5. Part B — Billing (display-only, synthetic data)

- **P0:** `/admin/billing` — per-org billing, usage, payment status.
- **P1:** `/org/[slug]/billing` — org billing summary, invoices, usage.
- **Data source:** display-only ≠ data-less. No billing table/package exists in this
  repo yet. Add a `subscriptions` table seeded per org from **synthetic data**
  (package tier, price, status, next billing date). Render it. Wire real Stripe
  (`@caistech/subscription-billing`) in a later phase.

---

## 6. Part B — Onboarding Configuration Wizard

The org lifecycle flow:

```
P0 creates org
  → selects service package (1:1 Tutoring / Tutor+AI / Full BPO) [data-source toggle]
    → P1 configures departments based on package (BPO: inbound/outbound/logistics; others: flat)
      → P1 allocates staff to departments
        → 2K baseline assessment runs per student (AUTOMATIC)
        → AI generates curriculum + timeline (AUTOMATIC)
          → P2 allocates teachers to students
```

Manual steps: package selection, department config, staff allocation, teacher-student
assignment. Steps 4–5 (baseline → curriculum) are automatic — the baseline uses the
existing `src/lib/2k/` pipeline, and curriculum generation comes from the **C0
engine (§2.1)**. Both emit canonical data the dashboards render.

---

## 7. Part B — Teacher Portal

Separate portal at `/teacher`:
- Own login (teacher is a `organisation_memberships` row with role `teacher`)
- Their assigned students
- Per-student progress + assessment results (read) + curriculum state (C0)
- Class schedule
- Notes / observations (write)
- **Teacher intelligence dashboard (A3)** as the deep view per student
  (`/teacher/students/[id]/report`)

---

## 8. Build Sequence

| Step | Duration | Delivers |
|---|---|---|
| **C0. Curriculum engine** | Week 1 | Schema (`curricula`, `curriculum_lessons`, `lesson_completions`, `tutor_feedback`, `curriculum_resets`) + `curriculum-engine.ts` with provenance chain — THE product spine |
| **C1. Org model (additive)** | Week 1 | `organisations` + `organisation_memberships` + `departments` (org-owned); DB functions `current_org_role`/`org_can_view_*`/`dept_can_view_*`; migrate `employer_admins` rows; `platform_admins` canonical + ADMIN_EMAILS bootstrap |
| **C2. Ingest & convert Dan designs** | Week 1–2 | A1 learner dashboard (as assessment insights panel), A2 student 6D/4D + result page, A3 teacher intelligence + report page — standalone pages on real engine data |
| **C3. Org onboarding wizard** | Week 2–4 | Package selection (P0) → department config (P1) → staff allocation (P1) → teacher assignment (P2); baseline + curriculum generation automatic via 2K pipeline + C0 |
| **C4. Platform admin console** | Week 3–4 | `/admin`: org list, onboarding, billing, content; `platform_admins` guard |
| **C5. Org admin portal** | Week 4–5 | `/org/[slug]`: departments, staff, students, teachers, settings, billing |
| **C6. Teacher portal** | Week 5 | `/teacher`: my students, progress, classes, notes; report page |
| **C7. Wire auth + RLS + responsive + tests** | Week 5–6 | All portals gated; RLS per org/dept; responsive pass; portfolio-gate route smoke; role-matrix spec + RLS DB-verify |
| **D0. Plan delivery (demo payoff, SHIPPED 2026-09-19)** | — | `buildPlan` (`lib/plan/plan-delivery.ts`) → 3-phase 16-week programme from canonical `gap_scores`; `/plan` on-screen programme + voice walkthrough (second ElevenLabs plan agent) + commitment capture; battery auto-redirects to `/plan`; baseline scale unified on LP-18 0–1000 (role_baselines / gap_scores.target / self-setup) |

**Tests (built alongside C0–C7):**
- `tests/e2e/06-role-matrix.spec.ts` — same URL hit as four roles (P0/P1/P2/P3),
  assert can/cannot see. NEW.
- RLS DB-verify — reuse the `test:hr:db` bash pattern (`scripts/hr-db-verify.sh`)
  for `org_can_view_*` / `dept_can_view_*`; copy the pinned-search-path + owner
  pattern from 0027's recursion warning exactly. NEW.
- Existing suites (public/auth/student/employer/nudges/clean-view) stay green.

**Total: ~6–7 weeks.**

---

## 9. Reuse from cais-shared-services & Kira

| Source | What to reuse | Where |
|---|---|---|
| Kira `organisation_memberships` | role/status/can_spend/valid_from-to membership model | `organisation_memberships` |
| Kira `PortalShell` | Nav + portal switcher + user menu chrome | Adapt portal-switcher pattern |
| Kira `getCurrentOrganisationContext()` | Server-side org context resolver | Org-scoped layouts |
| HR module `hr_can_view_employee()` | DB-side `SECURITY DEFINER` visibility functions | `org_can_view_*()` |
| HR module `hr_current_employee/role/org()` | DB-side identity resolution | `current_org_role()` |
| `@caistech/portfolio-gate` | Auth pattern, route smoke, RLS audit | New routes + RLS audit |
| `@caistech/platform-trust-middleware` | Rate limiting, permission checks, audit | New admin routes |
| `@caistech/corporate-components` | Shared UI components | Admin chrome |
| `@caistech/discovery-agent` | Kira `DiscoveryWidget` (avatar + scrolling text box) | DISCOVERY/ONBOARDING voice surfaces — ADD package (not currently installed); classroom practice voices stay bespoke |
| `@caistech/subscription-billing` | Billing primitives | Later phase (Stripe); this phase seeds synthetic `subscriptions` |
| `@caistech/beta-gate` | Trial clock + usage caps | Org onboarding trial |
| `@caistech/api-key-auth` | B2B API auth + quota | Org-level API access |
| `@caistech/mnemo` | Semantic memory (recall across sessions) | Any agent memory |

---

## 10. Open Items — RESOLVED (2026-09-12)

1. **Billing: display-only, synthetic** — new `subscriptions` table seeded per org
   (tier, price, status, next billing). No Stripe integration this phase.

2. **BPO harness ingestion: approved, synthetic data for tests.** The harness
   (`src/lib/bpo/`, Phase 1–2 of `docs/BPO_HARNESS_SCOPE.md`) already produces
   synthetic workplace artifacts and exports structured packets into
   `gap_scores (source='workplace')`. The ingestion **interface** (classroom voice
   recordings → per-student analysis → C0 curriculum reset) still needs to be built;
   tests run on the synthetic dataset.

3. **"My notes": functional stub.** Student + teacher notes work as a placeholder
   interface now. Designed to integrate ClassIn via API later — the stub is a tube
   interface (no ClassIn wiring in this phase).

4. **A1 learner dashboard:** placement walked through as part of the user journey
   review. **Voice agent = Kira `DiscoveryWidget` shape** (avatar + scrolling text
   box, `@caistech/discovery-agent/react`) applied to the **discovery/onboarding
   surfaces only** — the classroom speaking-practice voices stay bespoke (different
   UX than staged discovery interviews). Package must be added (not currently
   installed).

5. **Service-package config: nominated departments this phase.** P0/P1 pick from a
   fixed department set per package (e.g. BPO: inbound / outbound / logistics),
   seeded into the org-owned `departments` table. Rename/add endpoints are
   prod-phase — not built now. HR keeps its own legal/HR department model
   (explicit separation).

---

## 11. Decisions Locked Into This Phase

- Universal learner flow for all students; package = data-source toggle (§2).
- **C0 curriculum engine is the front-loaded spine** — schema + stateful engine with
  provenance chain; `plan-generator.ts` extended, not replaced (§2.1, approved).
- **Kira org pattern is ADDITIVE** — `organisations` + `organisation_memberships` +
  org-owned `departments`; `employers` stays as commercial row; **no rename, no
  `persons` table** — memberships anchor on `auth.users.id` (§4.2, approved).
- **One canonical `departments` table owned by `organisations`** for org + teacher
  portals; HR keeps its legal/HR model (explicit separation) (§4.2, approved).
- **`platform_admins` is the canonical platform-admin table; ADMIN_EMAILS seeds its
  bootstrap** (§4.1, approved).
- **Voice agent UX = Kira `DiscoveryWidget` on discovery/onboarding surfaces only**;
  classroom speaking-practice voices stay bespoke; `@caistech/discovery-agent` added
  as a dependency (§10.4, approved).
- **A2 result page + A3 teacher report page are first-class deliverables**
  (§3.A2/A3, approved).
- Billing display-only against seeded synthetic `subscriptions` (§5, approved).
- All Dan dashboard conversions ship standalone-first, real engine data (§3.A6).
- Departments nominated from a fixed set; no rename/add UI this phase (§10.5).
- **Role-matrix e2e spec + RLS DB-verify built alongside**; HR 0027 recursion
  guard-rails copied exactly (§8, approved).