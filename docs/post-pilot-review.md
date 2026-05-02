# Post-pilot review log

Things shipped in a "good enough for the pitch" form that we want to
revisit *after* real students and employer admins have used the platform
for a few weeks. Not blockers, not bugs — judgement calls that should
be re-checked against actual usage data instead of guessed-at upfront.

Add an entry here whenever you make a deliberate "leave it for now,
revisit with data" call. Trim entries once they're resolved.

---

## 1. Adaptive within-task difficulty

**Status:** Deferred. Battery picks one difficulty band per task at the
student's `target_level` and stays there. The Phase 0b spec §5.2
described "drop a band on first-item miss, raise on a strong showing"
adaptive difficulty within `listen_paraphrase`; we did NOT implement that.

**Why deferred:** Adaptive within-task difficulty is a calibration
judgement call. Without real-cohort score distributions we'd be tuning
the slack thresholds and the drop/raise rules off vibes. Fixed-band is
plenty for the pitch and gives us a clean dataset to design the adaptive
rules against.

**What to look at after pilot:**
- Per-task band distribution across the cohort. If 80% of students cluster
  at one band, fixed-band is fine. If there's wide spread, adaptive
  difficulty is worth building.
- Per-task ceiling effects — do strong students hit a 950+ on B2 vocab and
  give us no useful gradient? If yes, raise-on-success is the bigger win.
- Per-task floor effects — do weak students get crushed on B2 listening
  and bail mid-task? If yes, drop-on-miss is the bigger win.
- Re-test consistency — does the same student hit the same difficulty band
  across attempts 1 and 2? If not, the adaptive selector might be over-fitting.

**Where to start when we revisit:**
- `src/lib/onboarding/battery/select-tasks.ts` already returns a per-task
  `difficultyBand`. The adaptive logic lives one level below — at item
  delivery time inside `battery-runner.tsx` for vocab and at audio-clip
  selection time for listen_paraphrase.
- Add a `current_band` field to the runner state, downshift on the first
  miss / upshift on a strong run, and on submit record the FINAL band the
  student actually faced (not the originally selected one) so re-test
  comparisons are honest.

---

## 2. Role-scoped prompt seeding — idempotency / replacement strategy

**Status:** Resolved (delete-then-insert keyed on
`(role_id, task_type, difficulty_band, variant_bucket)`). Re-running
`scripts/seed-role-battery-prompts.ts` for the same role+band replaces
the prior pair instead of stacking duplicates.

**What to look at after pilot:**
- Whether employers want the ability to author/edit prompts directly
  (lightweight authoring UI) instead of going through the seeder
  script. If yes, build `/employer/roles/[id]/battery-prompts`.
- Whether re-test prompts should pull from the *same* variant_bucket as
  attempt 1 or a different one. Spec §9 says "different prompt from the
  same bucket" — we ship 2 prompts per bucket, so attempt 2 picks the
  unused one. After 4+ retests we'll need either more prompts per bucket
  or a different rotation strategy.

---

## 3. ClassIn class scheduling — auto-booking + teacher matching

**Status:** Stubbed. The `/api/classin/sessions` route creates a row
with hard-coded "Coach Linh" 24h from now (demo defaults). The
gap-driven lesson plan card recommends "schedule a class", but the
actual booking flow that picks a teacher matched to the student's role +
target language + biggest gap is unbuilt.

**Why deferred:** ClassIn integration depends on which API/SDK
permissions we actually have, and that's a partner-relationship
question, not a code question.

**Decisions needed before we build this properly:**
- **Account question:** Use my (Dennis') free ClassIn developer account,
  or use LingoPure's paid account for proper developer permissions?
  - Free account: zero coordination cost, but feature-limited and rate-
    limited. Fine for the demo. Production would hit caps fast.
  - LingoPure paid account: needs a conversation with LingoPure to get
    API credentials provisioned for our deploy. Probably the right path
    for a sustained pilot, since we're building on top of *their* class
    catalogue not ours.
- **Action item:** Open a conversation with LingoPure about (a) whether
  they can issue dev credentials against the paid account, or (b) if
  they prefer we run on the free tier until the partnership is more
  formal, or (c) whether ClassIn directly will issue partner credentials
  to us as a separate developer.

**What to look at after pilot:**
- Once the credentials path is decided, the real integration adds:
  - A `/api/classin/teachers` route that lists teachers available for a
    given (role-domain, target_language, time-window) tuple.
  - Real availability lookups — not "24h from now", but the teacher's
    actual open slots from ClassIn's calendar API.
  - A teacher-matching policy: nearest-available vs.
    role-domain-specialist (e.g. "manufacturing-English specialist for
    a Vietnamese ops role") vs. continuity (same teacher across the
    student's class history).
  - Booking confirmation email / nudge so the student doesn't ghost.
- Where the work lands:
  - `src/app/api/classin/sessions/route.ts` — replace the demo defaults.
  - `src/lib/lessons/plan-generator.ts` — the "Schedule a class" CTA
    should optionally pre-select a recommended teacher based on the
    skill being remediated.
  - New `src/lib/classin/availability.ts` for the calendar lookup.

---
