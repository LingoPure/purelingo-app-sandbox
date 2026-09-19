# LingoPure — Functionality & Workflows

**Version:** 1.0
**Date:** September 2026
**Status:** Product overview for internal stakeholders

---

## Part A: Executive Summary

LingoPure is an **AI-first Business English platform** built for teams and professionals in Vietnam and Southeast Asia. It combines live human tutoring with AI-powered assessment, gap scoring, and micro-learning to deliver measurable CEFR-aligned outcomes.

### What Makes It Different

1. **LP-18 Scoring** — CEFR's six levels are too coarse. LingoPure splits each into three micro-bands (18 total) and maps individual communication signals against them. Every learner knows *exactly* which eighteenth they sit in.

2. **Universal Learner Flow** — One flow for every student, regardless of package. The package acts as a **data-source toggle**, not a feature gate.

3. **AI-Powered Gap Detection** — Voice discovery (ElevenLabs), battery tasks (Claude-scored), and the full 2K assessment engine produce a granular gap profile that drives personalised curriculum.

4. **Real-Time Curriculum Reset** — Every new data point (lesson completed, class attended, work artifact ingested) adjusts the learning plan dynamically.

### Three Service Packages

| Package | Data Sources | Best For |
|---|---|---|
| **1:1 Tutoring** | Lessons + tutor feedback | Small teams, private coaching |
| **Tutor + AI** | + Voice discovery + AI coaching | Teams wanting AI-augmented learning |
| **Full BPO** | + Workplace artifacts (calls, emails, work outputs) | BPO companies with call centres |

### Who Uses It

| Role | What they do |
|---|---|
| **Learner** | Takes assessment, follows curriculum, completes lessons, earns certifications |
| **Employer Admin** | Manages staff, sets roles, monitors team progress, invites candidates |
| **Teacher** | Views student reports, assigns classes, records feedback |
| **Investor** | Explores the business via dataroom, asks questions, generates reports |
| **Platform Admin** | Manages organisations, content, billing, demo bookings |

---

## Part B: Architecture Overview

### System Stack

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│           Next.js 16 App Router + React 19           │
│   Marketing  │  Student  │  Employer  │  Investor    │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                    Backend                           │
│      Server Actions + API Routes (Next.js)           │
│   Scoring │ Lessons │ Curriculum │ Auth │ Email      │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                 Supabase                             │
│    Postgres (RLS) │ Auth │ Storage │ pgvector        │
│    48 migrations  │ Row-level security on all tables │
└─────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              Integrations                            │
│  ElevenLabs │ ClassIn │ TrackTest │ Resend │ Whisper │
│  Claude (Anthropic) │ OmniRoute (dev gateway)       │
└─────────────────────────────────────────────────────┘
```

### Data Model (Simplified)

```
students
  ├── gap_scores (6 skills × 0-1000, with CEFR bands)
  ├── discovery_sessions (voice transcripts + profile_json)
  ├── discovery_task_responses (battery task results)
  ├── micro_lessons (email sprints + speak & score)
  ├── certifications (CEFR exam results)
  └── gamification (XP, streaks, progress)

organisations
  ├── departments
  ├── roles + role_baselines
  ├── staff → students (membership)
  ├── teachers
  └── subscriptions

employers (legacy)
  ├── employer_admins
  └── (linked to organisations)
```

### Auth Model

Authentication is Supabase-based. Role is determined by **table membership** — there is no single `role` column:

| Role | Table membership | Home |
|---|---|---|
| Student | `students` (auto-created on signup) | `/dashboard` |
| Employer Admin | `employer_admins` | `/employer` |
| Teacher | `teachers` | `/teacher` |
| Investor | `investors` (invite-only) | `/investor/ask` |
| Platform Admin | `platform_admins` + `ADMIN_EMAILS` env | `/admin` |

---

## Part C: Service Packages — Deep Dive

All three packages share the **universal learner flow**:

```
Baseline (2K Assessment)
  → LP-18 CEFR Levels
    → AI-Generated Curriculum
      → Live Tutor Sessions (ClassIn)
      → Writing Practice (email sprints)
      → Speaking Practice (voice + tutor)
      → Listening Comprehension
    → Ongoing Data → Dynamic Curriculum Reset
      → Repeat until target achieved
```

The package determines **which data sources feed the curriculum engine**:

### 1:1 Tutoring

**Includes:** Lessons completed + live tutor feedback
**Does not include:** AI voice coaching, workplace artifact ingestion
**Best for:** Organisations that want private tutoring with human teachers

| Feature | Available |
|---|---|
| Baseline assessment (2K) | Yes |
| AI-generated curriculum | Yes |
| Live tutor sessions (ClassIn) | Yes |
| Writing practice (email sprints) | Yes |
| Speaking practice (voice + tutor) | Yes |
| Listening comprehension | Yes |
| AI voice discovery session | No |
| AI coaching (voice agent) | No |
| BPO harness (workplace data) | No |
| Gap radar + LP-18 scores | Yes |
| Employer dashboard | Yes |
| CEFR certification (TrackTest) | Yes |

### Tutor + AI

**Includes:** Everything in 1:1 Tutoring + voice discovery + AI coaching
**Does not include:** Workplace artifact ingestion
**Best for:** Organisations wanting AI-augmented learning with richer feedback loops

| Feature | Available |
|---|---|
| All 1:1 Tutoring features | Yes |
| AI voice discovery session (Aria) | **Yes** |
| AI coaching (voice agent) | **Yes** |
| BPO harness (workplace data) | No |

### Full BPO

**Includes:** Everything in Tutor + AI + workplace artifact ingestion
**Best for:** BPO companies with call centres, email teams, and work output data

| Feature | Available |
|---|---|
| All Tutor + AI features | Yes |
| BPO harness (voice recordings, emails, work outputs) | **Yes** |
| Work-sourced curriculum data | **Yes** |

**BPO Harness Details:**
- Voice recordings from calls → analysed for fluency, vocabulary, register
- Emails → writing quality scoring
- Work outputs → domain-specific vocabulary + communication style
- All artifacts feed back into gap_scores and curriculum resets

### Package Selection

Package is selected during **org onboarding** (7-step wizard):

1. **Package** — Choose 1:1 / Tutor+AI / Full BPO
2. **Departments** — Configure organisational structure
3. **Staff** — Allocate staff members
4. **Teachers** — Assign teachers
5. **Baseline** — 2K assessment runs per student (automatic)
6. **Curriculum** — AI generates personalised learning plan (automatic)
7. **Done** — Dashboard ready

---

## Part D: Portal Reference — Page by Page

### D1: Student Portal

**Entry:** `/login` → `/dashboard`

#### Dashboard (`/dashboard`)

The main hub for every learner. Shows:

| Component | What it displays |
|---|---|
| **Gap Radar** | 6-axis radar chart: speaking, listening, writing, reading, vocabulary, presenting |
| **Skill Bars** | 6 horizontal bars: 0-1000 numeric score + LP-18 band (B2.3) + CEFR band (B2) |
| **Now / Target Badges** | Overall current level vs. target level |
| **Recommended Plan** | Gap-driven micro-lesson suggestions ranked by severity |
| **Gamification** | XP counter, streak counter, progress bar |
| **Certification Card** | Whether CEFR exam is available |
| **Next Class** | Scheduled ClassIn session or "No class scheduled" |
| **Recent Activity** | Feed of completed lessons, classes, check-ins |
| **Progress Chart** | Score trend over time (first check-in shows baseline message) |

#### Journey View (`/dashboard/journey`)

Advanced view for the 2K assessment engine:

- 2K communication state (what was measured)
- 4D temporal progress (how scores move over time)
- Behavioural evidence (specific examples from sessions)
- Drift alerts (scores moving in unexpected directions)
- Focus behaviours (areas of strength/weakness)
- Notes from teachers

#### Discovery Session (`/onboarding` → `/onboarding/session`)

1. **Pre-session** (`/onboarding`): Confirm role + native language, read 6-dimension overview
2. **Session** (`/onboarding/session`): Full-page ElevenLabs voice session with Aria (~20-35 min)
3. **Post-session**: Redirected to battery or dashboard

Aria covers: rapport building, role probing, target "why", learning style framing, skill measurement across 6 dimensions. The live prompt (2026-09-19) keeps all internal reasoning in `<instruction>` blocks (never spoken), splits Dimension 2 into three true turns, and calls `end_call` on the closing phrase.

#### Battery (`/onboarding/battery`)

Four assessment tasks run in priority order:

| Task | What the student does | What it measures |
|---|---|---|
| Email Writing | Write a business email (target 120-220 words, shown live as "N words (target min–max)") | Writing formal |
| Listen & Paraphrase | Play audio once, type 3 key points | Listening comprehension |
| Read & Summarise | Read email, write 3-4 sentence summary | Reading intent |
| Vocabulary Cloze | Fill blanks / pick correct word (8-10 items) | Business vocabulary |

Battery scores **replace** voice scores for 4 of 6 skills (canonical reconciliation). Voice remains canonical for speaking + presenting. On submit the student is **redirected to `/plan`** (not `/lessons`).

#### Plan Programme (`/onboarding/battery` → `/plan`)

A 3-phase 16-week programme derived from the canonical gap profile (LP-18 0–1000 baseline scale, uniform across `role_baselines` / `gap_scores.target` / self-setup). Delivered on-screen (score bars + "Gap vs role baseline") **and by voice** — a second ElevenLabs plan agent walks the student through phases and captures their commitment. Buttons: **In** (committed), **Not now** (declined), later becomes their learning spine. Commitments recorded via `/api/plan/delivery`.

#### Lessons (`/lessons` → `/lessons/[id]`)

Two lesson types:

**Email Sprint** (`email_sprint`):
- Scenario presented (role-relevant business situation)
- Timer starts
- Write email under time pressure
- Submit → Claude scores (register/tone, structure, strategic content, vocabulary)
- Feedback + XP awarded

**Speak & Score** (`speak_score`):
- Prompt presented (60-90 second business response)
- Browser records audio
- Audio transcribed via Whisper
- Claude evaluates transcript
- Feedback + XP awarded

#### Assessment (`/assessment` → `/assessment/results/[id]`)

The full 2K Assessment — 25 questions across 5 stages:

1. **LOCATE** (Q1-5): Baseline questions
2. **BOUND** (Q6-10): Expanding scope
3. **RESOLVE** (Q11-15): Problem-solving
4. **PERTURB** (Q16-20): Edge cases, pressure
5. **CONFIRM** (Q21-25): Verification

Pipeline: Communication Analysis → Evidence Packet → Adjudication → LP-18 State → Hysteresis → Telemetry → LP-1000 → Diagnosis → Recommendation → Result Freeze

Results page (Master Brain v6.1): (1) Where You Stand Now, (2) What's Holding You Back, (3) How To Improve

#### Settings (`/settings`)
- Name, email, password changes

---

### D2: Employer Portal

**Entry:** `/login?redirectTo=/employer` → `/employer`

#### Cohort Overview (`/employer`)

| Component | What it displays |
|---|---|
| **Metric Tiles** | Active students, lessons completed, live classes, certified, at-target |
| **Cohort Gap Radar** | Team-wide skill gaps (average across all students) |
| **Role Coverage Cards** | Each role with baseline scores and student count |
| **Activity Feed** | Recent activity across the team |

#### Staff (`/employer/staff`)
- Staff list with names, emails, roles, status
- **Invite:** Name, email, department, role assignment → magic-link email sent
- **Import:** CSV upload for bulk staff import

#### Roles (`/employer/roles`)
- Role list with baseline scores
- **Create (AI consultant):** 5-minute voice interview → auto-generated baselines
- **Create (manual):** 6 sliders for speaking, listening, writing, reading, vocabulary, presenting
- **Detail:** Baseline comparison, student coverage, gap analysis

#### Students (`/employer/students` → `/employer/students/[id]`)
- Roster with scores
- Detail: gap bars, profile, target level, learning style, Phase 0b artefacts, recent lessons

#### Departments (`/employer/departments`)
- Department list, create/edit

#### Teachers (`/employer/teachers` → `/employer/teachers/[id]`)
- Teacher list, assignments (primary + specialist)

#### Candidates (`/employer/candidates`)
- Recruitment filter: send magic-link invite → candidate takes assessment → results appear here

---

### D3: Investor Portal

**Entry:** `/investor/login` → `/investor/ask`

#### Ask the Dataroom (`/investor/ask`)
- Type a question about the business
- Get a cited, grounded answer with source references
- Follow-up questions reference prior context
- Morgan voice guide available for formulation help

#### Documents (`/investor/documents`)
- Browse dataroom files by category: financials, legal, technology, GTM, market, team, CEFR framework, reviews
- All documents are watermarked and access-logged

#### NDA Gate (`/investor/nda`)
- Accept NDA → tier upgrades from "main" to "restricted"
- Restricted tier unlocks deeper board materials

#### Reports (`/investor/reports`)
- Generate investment reports (investment memo, financials brief)
- Synthesised from dataroom, watermarked PDF output

#### Admin Console (`/investor/admin`)
- Operator management of investors, documents, reports, access logs
- Gated by `ADMIN_EMAILS` env allowlist

---

### D4: Admin Portal

**Entry:** `/login` → `/admin`

#### Platform Overview (`/admin`)
- Org count, active subscriptions, onboarded orgs, active members

#### Content Editor (`/admin/content`)
- CMS for marketing pages (homepage, for-companies, for-individuals, method)
- Preview in draft mode before publishing

#### Demo Bookings (`/admin/demo-bookings`)
- List of submitted book-a-demo requests from the marketing funnel

#### Org Management (`/admin/onboarding`)
- Directory of all organisations and their onboarding status

#### Billing (`/admin/billing`)
- Per-org billing summary, usage, payment status (synthetic data for now)

#### Editors / Testimonials / Logos
- Manage content editors, client testimonials, client logos

---

### D5: Teacher Portal

**Entry:** `/login` → `/teacher`

#### My Students (`/teacher`)
- List of assigned students

#### Student Detail (`/teacher/students/[id]`)
- Individual student view with scores, profile, progress

#### Student Report (`/teacher/students/[id]/report`)
- Master Brain v6.1 teacher view — 5 sections:
  1. Assessment run + evidence + coverage
  2. 12D telemetry + temporal state
  3. Diagnosis & recommendation
  4. Decision trace
  5. Audit/lineage/snapshot + evidence packets

#### Notes (`/teacher/notes`)
- Teacher notes page

---

### D6: Recruitment Filter

**Entry:** `/screen/[token]`

A candidate receives a magic-link email. Clicking it:

1. **`/screen/[token]`** — Landing page: company name, role name, "Start the assessment" CTA
2. **Magic-link auth** — No account required (or creates one)
3. **`/screen/[token]/join`** — Stamps student with employer + role, redirects to `/onboarding`
4. Candidate completes discovery session + battery
5. **Results** appear in employer's `/employer/candidates` tab

**Status:** Hypothesis — no candidate has run the flow yet. Must be validated before build.

---

## Part E: Assessment & Scoring

### The Three Assessment Layers

```
Layer 1: Voice Discovery (Phase 0a)
  │  20-35 min voice session with Aria
  │  Measures: speaking, listening, vocabulary, reading (spoken)
  │  Produces: 6 gap_scores (source='discovery') + profile_json
  │
  ├── Layer 2: Battery Tasks (Phase 0b)
  │     4 tasks: email, listen, read, vocab
  │     Battery scores REPLACE voice scores for 4/6 skills
  │     Voice remains canonical for: speaking_fluency, presentation_delivery
  │
  └── Layer 3: 2K Assessment (Full Engine)
         25 questions, 5 stages
         Full pipeline: C07→C16
         Produces: LP-18 state, LP-1000 score, diagnosis, recommendation
```

### LP-18 Scoring

- **Scale:** 0-1000 per skill
- **CEFR split:** 18 micro-levels (A1.1 → C2.3)
- **Skills:** Speaking, Listening, Writing, Reading Intent, Business Vocabulary, Presenting
- **Target:** Per-role baselines (set by employer admin or AI consultant interview)
- **Gap:** `target - current` for each skill → drives curriculum recommendations

### Canonical Reconciliation

Battery scores are more accurate than voice scores (controlled tasks vs. conversational sampling). When both exist:

| Skill | Canonical source |
|---|---|
| Writing formal | Battery (email writing) |
| Listening comprehension | Battery (listen & paraphrase) |
| Reading intent | Battery (read & summarise) |
| Business vocabulary | Battery (vocab cloze) |
| Speaking fluency | Voice discovery (only source) |
| Presentation delivery | Voice discovery (only source) |

### Curriculum Engine

The curriculum engine generates a personalised learning plan from gap scores:

- **Gap > 200:** Critical — recommended lesson + teacher-led class
- **Gap 100-200:** Moderate — micro-lesson recommended
- **Gap < 100:** Low — maintenance mode

**Four modalities:**
1. Live tutor sessions (ClassIn)
2. Writing practice (email sprints)
3. Speaking practice (speak & score + voice agent)
4. Listening comprehension (repeat/interpret)

---

## Part F: Integrations

| Integration | Purpose | Status |
|---|---|---|
| **ElevenLabs** | Voice discovery (Aria), investor voice (Morgan), TTS for battery clips | Live |
| **Anthropic Claude** | Gap scoring, lesson evaluation, i18n translation, dataroom answers | Live (via OmniRoute in dev) |
| **OpenAI Whisper** | Audio transcription for 2K assessment + ClassIn sessions | Live |
| **Resend** | All outgoing emails (signup, invites, battery reports, demo confirmations) | Live |
| **Supabase** | Database (Postgres + RLS + pgvector), auth, storage | Live |
| **ClassIn** | Virtual classrooms, session recording | Scaffolded (pending EEO SDK credentials) |
| **TrackTest** | CEFR certification exams | Scaffolded (pending vendor docs) |
| **OmniRoute** | LLM gateway (dev only — routes Claude traffic) | Local dev |
| **HeyGen** | Video generation | Present, not deeply integrated yet |
| **SayFix** | Bug reporting widget | Live |

### Email Types (Resend)

| Email | Trigger | Recipients |
|---|---|---|
| Signup confirmation | Account creation | Learner |
| Magic-link login | Passwordless login request | Requester |
| Staff invite | Employer invites staff | Invitee |
| Candidate invite | Employer invites candidate | Candidate |
| Battery report | Battery completion (4 tasks done) | Learner |
| Demo booking (internal) | Book-a-demo form submitted | Sales team |
| Demo booking (customer) | Book-a-demo form submitted | Booker |

---

## Appendix A: Role Matrix

| Role | Can see | Can do | Authed by |
|---|---|---|---|
| **Student** | Own dashboard, lessons, scores, settings | Complete lessons, run check-ins, change settings | Supabase auth (auto-created) |
| **Employer Admin** | Cohort overview, all team members, roles, departments, teachers, candidates | Create roles, invite staff, manage departments | `employer_admins` table |
| **Teacher** | Assigned students, Master Brain reports, notes | Record feedback, assign classes | `teachers` table |
| **Investor** | Dataroom Q&A, documents, reports | Ask questions, browse files, generate reports | `investors` table (invite-only) |
| **Platform Admin** | All orgs, billing, content, demo bookings, editors | Manage everything | `platform_admins` + `ADMIN_EMAILS` env |

---

## Appendix B: Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) | Yes |
| `ANTHROPIC_API_KEY` | Claude API key (or OmniRoute gateway key) | Yes |
| `ELEVENLABS_API_KEY` | Voice agent API key | Yes |
| `ELEVENLABS_AGENT_ID` | Aria discovery agent ID | Yes |
| `OPENAI_API_KEY` | Whisper transcription | Yes |
| `RESEND_API_KEY` | Email transport | Yes |
| `CLASSIN_APP_ID` | Classroom embed (pending) | No |
| `CLASSIN_APP_SECRET` | Classroom API (pending) | No |
| `TRACKTEST_API_KEY` | CEFR certification (pending) | No |
| `TRACKTEST_PARTNER_ID` | TrackTest SSO (pending) | No |

---

## Appendix C: Database Tables (Key Tables Only)

| Table | Purpose |
|---|---|
| `students` | Learner accounts + profile |
| `gap_scores` | 6-skill scores with CEFR bands + LP-18 |
| `gap_score_history` | Score trend over time |
| `discovery_sessions` | Voice session transcripts + profile_json |
| `discovery_task_responses` | Battery task results |
| `micro_lessons` | Email sprints + speak & score lessons |
| `organisations` | Multi-tenant orgs |
| `departments` | Org structure |
| `roles` + `role_baselines` | Job role definitions + skill baselines |
| `organisation_memberships` | Staff-to-org linking |
| `teachers` | Teacher accounts |
| `employers` | Legacy employer records |
| `employer_admins` | Employer portal access |
| `platform_admins` | Admin portal access |
| `candidate_invites` | Recruitment filter invitations |
| `certifications` | CEFR exam results |
| `classin_sessions` | Live class records |
| `demo_bookings` | Book-a-demo form submissions |
| `subscriptions` | Org billing records |
| `dataroom_chunks` | Investor RAG (pgvector embeddings) |
| `dataroom_documents` | Investor dataroom files |

---

*Document generated September 2026. For questions, contact Dennis.*
