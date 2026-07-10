# LingoPure — what the product actually is, in code (briefing for the strategy advisor)

**Purpose.** This corrects the picture the strategy conversation has been working
from. That conversation reasons from the **legacy Google Form + Google Sheet** (the
*manual* demo-lesson placement) and the Defensibility Brief, and recommends *building*
a productised capture layer. Most of that layer **already exists** in this repo —
running in LingoPure's own Supabase, generated outside ClassIn. The Google
Forms/Sheets are the old manual instrument; **the repo is the productised replacement.**

Everything below is verified against the actual code (migration numbers + file paths
cited), not documents.

---

## 1. Orientation

LingoPure (repo `lingo-pure-ai`, deployed at `lingo-pure-ai.vercel.app`) is a working
**Next.js 16 web application** backed by **LingoPure's own Supabase** (22 migrations).
It runs the full **assess → score → learn → certify** loop in infrastructure LingoPure
controls. ClassIn is *one* integration point (live classroom delivery), **not** where
the proprietary data is made or held.

The advisor's strategic conclusion — *"the raw ClassIn feed is a non-exclusive
commodity; the derived LP-18/LP-1000 layer + longitudinal structure is the asset"* — is
correct, **and the repo already embodies it.** The derived layer is captured
voice-sourced, AI-scored, taxonomy-enforced, timestamped and longitudinally logged, in
a store ClassIn never touches.

---

## 2. The process (the loop the product actually runs)

1. **Voice discovery / placement.** The learner does a **spoken AI discovery session**
   with an AI coach (Aria) over **ElevenLabs Conversational AI** — *not* ClassIn.
   (`src/app/(app)/onboarding/discovery-session.tsx`, `api/convai/*`.)
2. **Evidence + session envelope persisted.** The **full transcript** (with per-turn
   timestamps), the **conversation id**, and completion time are written to
   `discovery_sessions` (`convai_conversation_id`, `transcript_json`, `profile_json`,
   `completed_at`). (`api/convai/webhook/route.ts` upserts on `convai_conversation_id`.)
3. **AI scoring against a fixed rubric.** `src/lib/scoring/score-discovery.ts` sends the
   transcript to Claude against a **prescriptive rubric + strict Zod schema**
   (`src/lib/scoring/rubric.ts`) and writes **6 canonical `gap_scores` rows**
   (`source='discovery'`) + `profile_json`. It is **idempotently re-scorable** from
   `POST /api/scoring/discovery`.
4. **Structured task battery (Phase 0b).** A second, structured assessment
   (`src/lib/onboarding/battery/*`, migration `0016`/`0017`) produces canonical skill
   rows with an explicit **per-task → skill mapping** and a **canonical/non-canonical
   reconciliation** (battery rows supersede voice rows for the skills they cover —
   `set-canonical.ts`, `reconcile.ts`). This is real data-provenance handling.
5. **Gap score on a 0–1000 scale (LP-1000).** Migration `0011` rescaled sub-skill scores
   0–100 → **0–1000** across **six enforced dimensions**. This is the LP-18 / LP-1000
   lineage in code.
6. **Longitudinal signal log.** `gap_score_history` (migration `0019`) records every
   `(student_id, skill, score, target, source, scored_at)` — the time-series the
   progression/drift/regression claims rest on.
7. **Learn + deliver.** `micro_lessons` (with `score_before`/`score_after`),
   `classin_sessions` (attendance, duration, `participation_data_json`, `recording_url`,
   `transcribed_at`) for live classes.
8. **Certify.** `certifications` via TrackTest (`src/lib/tracktest/*`).
9. Plus: nudges engine, employer/enterprise dashboards, an investor dataroom.

---

## 3. How it's structured — this *is* "the bus"

- **Data model = 22 Supabase migrations** (`supabase/migrations/0001..0022`). Core
  tables: `students`, `employers`, `discovery_sessions`, `gap_scores`,
  `gap_score_history`, `classin_sessions`, `micro_lessons`, `certifications`, `nudges`,
  the battery tables, and the `investor_*` set.
- **Every observation already carries the envelope** the advisor says to add:
  `student_id`, a **provenance/source** field, and a **timestamp**
  (`scored_at`/`created_at`/`completed_at`). Discovery additionally carries
  `convai_conversation_id` (**the session id**) and `transcript_json` (**the evidence**).
- **The canonical taxonomy is enforced at the database level.** `gap_scores.skill` is a
  `CHECK` constraint over exactly six values:
  `speaking_fluency, listening_comprehension, writing_formal, reading_intent,
  business_vocabulary, presentation_delivery`. There are **not** "four right answers" in
  the product — the competing taxonomies the advisor found are legacy doc/form drift; the
  code has one set and the DB rejects anything else.
- **Provenance of the derived layer is LingoPure's own Supabase**, produced from an
  ElevenLabs voice session. **ClassIn is not in that path.** ClassIn only feeds
  `classin_sessions` (classroom delivery telemetry).

---

## 4. Advisor recommendation → repo status (the crux)

| The advisor recommends building… | Repo status | Where |
|---|---|---|
| Migrate the placement/report **off Google Forms/Sheets** onto a real surface that **writes to a bus** with **session_id + timestamp + provenance** | **BUILT** | `discovery_sessions` + `gap_scores` + `gap_score_history` in LingoPure Supabase; `source` = provenance; `scored_at`/`completed_at` timestamps; `convai_conversation_id` = session id |
| **Keep the evidence** behind the judgement so placement is **auditable**, not asserted | **BUILT (transcript-level)** | Full `transcript_json` with per-turn `time_in_call_secs`; idempotently re-scorable via `/api/scoring/discovery`. Evidence = transcript (not raw audio) |
| Fix **inter-rater reliability** / calibration ("five uncalibrated teachers ticking boxes") | **Solved by construction (differently)** | Placement is **not** teacher-ticked. One **AI rubric** (`rubric.ts`) scores **every** learner via a strict schema. A single calibrated instrument ⇒ no teacher-to-teacher variance. Residual risk is model/rubric drift, not human IRR |
| **Reconcile the taxonomy** ("four right answers") to one dimension set used everywhere | **ENFORCED** | Six canonical skills, DB `CHECK`-constrained; battery/voice provenance reconciliation (`set-canonical.ts`) |
| **Separate the placement judgement from the issue flags** ("one judgement counted six times") | **Not reproduced** | The scorer rates **six dimensions independently across the whole transcript**, not one placement fanned into six signals |
| The **exotic signal types** (hesitation, repair, latency) are aspirational | **Partly consumed already** | The rubric explicitly reads *"hesitation, self-correction, ability to recover"* to produce fluency; per-turn timestamps (a latency proxy) are captured. **Consumed as scoring inputs**, not yet **emitted as discrete signal rows** |
| **Data rests in China via ClassIn** | **The derived layer does NOT** | Discovery/scoring/history/profiles are generated from an ElevenLabs session and stored in **LingoPure's own Supabase**. ClassIn touches only `classin_sessions`. The proprietary asset already sits in LingoPure-controlled infrastructure |

---

## 5. Where the advisor is right — the genuine remaining gaps

Stated plainly so the valid points aren't lost in the correction:

1. **Learner-facing consent for commercial derivation.** `/privacy` and `/terms` pages
   exist, but I found **no recorded student consent/ToS timestamp at signup** (only an
   investor **NDA** acceptance, `nda_accepted_at`). The controller-side consent gap the
   advisor flags looks **real for the learner** and should be closed (record consent +
   disclosed purposes at signup). *(Worth a product-owner confirm.)*
2. **Discrete signal decomposition (the "session layer").** Signals per Dan's definition
   (latency in ms, hesitation markers, repair attempts, drift/regression events as
   individual attributable rows) are **not emitted yet** — scoring is skill-level. The
   transcript holds the raw material; turning it into discrete signal rows is the real
   remaining build. This is also where the **signal-count ramp** (1M → 5M → 15M) actually
   comes from, and it is genuinely not built.
3. **Raw-audio retention for discovery/demo.** The repo keeps the **transcript**, not
   (confirmed) the **audio**. If audio is wanted as evidence or as classifier training
   data, that's a real add. `classin_sessions.recording_url` exists for classroom, but
   the ClassIn→transcription leg is still partly TODO (`api/classin/session-end`).
4. **The ClassIn classroom leg is exactly where the advisor's contract concerns bite.**
   `classin_sessions.participation_data_json` / `recording_url` are fetched **from**
   ClassIn/EEO — that leg is subject to the PRC-residency, de-identification, and
   institutional-agreement/DPA issues the advisor correctly raises. The moat reframe
   holds precisely because the **asset isn't there** — it's in the LingoPure store.
5. **The 55,000 historical signals live in the old Google Sheet, not the repo.** The repo
   is the clean go-forward instrument. Backfilling historical teacher reports into this
   schema would be a separate migration (and would let the count be a query result, as
   the advisor notes).

---

## 6. One-line reframe

The advisor's conclusion is right **and already implemented**: the raw ClassIn feed is a
non-exclusive commodity; **the derived LP-18/LP-1000 layer + longitudinal structure is
the proprietary asset — and it is already captured** (voice-sourced, AI-scored,
DB-enforced taxonomy, timestamped, longitudinally logged) in LingoPure's own Supabase,
generated outside ClassIn. So the "build this week" list collapses to what's genuinely
open: **(a)** learner consent capture, **(b)** discrete signal decomposition / the
session layer (also the real basis of the signal ramp), **(c)** raw-audio retention if
wanted, and **(d)** the ClassIn-leg contracts/DPA — none of which is the placement-form
migration, the session envelope, the auditable evidence, or the canonical taxonomy,
because those already exist.
