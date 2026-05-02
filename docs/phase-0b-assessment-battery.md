# Phase 0b — Structured Assessment Battery

> Status: reviewed, decisions locked
> Author: Dennis McMahon (with Claude)
> Date: 2026-05-02
> Eng review: 2026-05-02 (this doc) — see `## GSTACK REVIEW REPORT` at end

## 1. Problem

Today's discovery (Phase 0a) is a single ~25-min voice call with Aria. Six skills are scored from one transcript:

| Skill | How it's scored today |
|---|---|
| `speaking_fluency` | Measured (live speech) |
| `listening_comprehension` | Measured (Sarah/Mark email read aloud, ~30 sec) |
| `writing_formal` | **Inferred** from speech |
| `reading_intent` | Measured but conflated with listening (read aloud) |
| `business_vocabulary` | Measured but only spoken vocab |
| `presentation_delivery` | **Inferred** |

Three of six sub-scores are not measured. Learning-style preferences are captured by Aria *asking* — pure self-report. The product cannot credibly tell an enterprise buyer "this is your employee's English baseline" because half the data is the LLM guessing.

## 2. Goal

Replace inferred scores with directly-measured ones, replace self-reported learning-style with behavioural probes, and build the whole thing so a 4-week re-test produces a comparable delta the buyer can show their CFO.

Concretely:

- Every skill in `gap_scores` traceable to a specific student-produced artefact (audio, typed text, item response).
- Learning-style attributes (`profile_json.learning_style_*`) populated from observed behaviour during the battery, not from Aria's question.
- Same task-type, different content variants on re-test → comparable score delta.

## 3. Non-goals

- Replacing Aria. Voice discovery still runs first — it's the rapport + role-context layer the battery doesn't and shouldn't try to be.
- Building our own audio TTS / STT / WYSIWYG editor. Use ElevenLabs for audio playback, plain `<textarea>` for writing, off-the-shelf scoring with Claude.
- Solving CEFR proficiency testing in the abstract. We're calibrating against the *role baseline* (already in `role_baselines`), not against an external standard.

## 4. User-facing flow

```
/onboarding
  ↓ confirm role + native lang
  ↓
/onboarding/session              (Phase 0a — voice, ~15 min)
  Aria: rapport, role probing, target why, learning-style FRAMING ONLY
  ↓ End session
  ↓
/onboarding/battery              (Phase 0b — typed/audio, ~15-20 min)
  Task 1 — Email writing prompt   (~5 min)
  Task 2 — Listen & paraphrase    (~3 min)
  Task 3 — Read & summarise       (~4 min)
  Task 4 — Vocabulary at register (~3 min)
  ↓ Submit
  ↓
/dashboard?just-finished=1
  Banner polls until both Phase 0a (voice scoring) and Phase 0b (battery
  scoring) complete, then surfaces the unified gap profile.
```

The voice call shrinks to ~15 min: Aria stops trying to measure writing/reading/listening (she can't anyway) and focuses on context she's actually well-suited for. Battery picks up the rest.

Total time: ~30-35 min (vs current ~25). The added 5-10 min buys *credibility* per the trade-off table in the chat thread. For a B2B contract that's the right exchange.

## 5. Task formats

### 5.1 Email writing (writing_formal)

**What.** Student is shown a role-relevant scenario card and writes a single email response in a `<textarea>`. Word-count target shown live (250-400 words). Submit when done.

**Example prompt** (calibrated to "Senior Account Manager"):

> A client (Mark Reynolds, Procurement Director, AusFresh Pty Ltd) emailed yesterday confirming Q3 volumes but stalled on the Q4 commitment because their forecast hasn't been signed off. Your manager wants you to keep the conversation alive without sounding pushy and without conceding anything on price.
>
> Write the email reply you'd send.

**Variants.** 8-10 prompts per role (e.g. "chase late payment", "decline a discount request", "schedule a difficult call", "introduce a new product to existing client"). Variants are equivalent-difficulty so re-test is comparable.

**Scoring.** Claude scores the response against a rubric tuned to the role baseline:
- Register & tone (formality, hedging, politeness markers)
- Structural integrity (greeting, lead, ask, sign-off)
- Strategic content (does it actually achieve the brief — e.g. keeping the convo alive without conceding)
- Lexical range vs role baseline
- Grammar/mechanics (lighter weight than the others — surface errors are noise)

Output: 0–1000 score + CEFR band + 2-3 sentence evidence quoting the response. Same shape as existing `gap_scores.writing_formal`.

### 5.2 Listen & paraphrase (listening_comprehension)

**What.** Student plays a 30-45 second audio clip (one play, no scrubbing). Then types the three key points in a `<textarea>`. ElevenLabs TTS at native pace, with a deliberately fast UK accent for upper-band variants.

**Example prompt content.**

> Voicemail from a regional ops director: "Hi, it's Sarah from Sydney. Just a heads-up — we're seeing some quality variance on the last two pangasius shipments, fillet thickness specifically, running about 8% under spec. Not catastrophic, the buyers haven't pushed back yet, but I want it on your radar before Monday's QBR. Can you have your QA team pull the production batch records and ping me by EOD Friday? Thanks."

**Variants.** 8-10 clips per role. Three difficulty tiers (B1 / B2 / C1) — adaptive: start at the role's target band, drop one if the student asks for replay or scores low on the first item, raise one if they nail it.

**Scoring.** Claude reads the student's three points alongside the clip transcript and scores:
- Recall accuracy (did they get the three actual key points)
- Inference (did they understand "fillet thickness running 8% under spec" as a quality-variance issue, not just repeat the words)
- Action items (did they pick up the implicit "by EOD Friday" deadline)

Output: 0–1000 score + CEFR band + evidence (which point they nailed, which they missed).

### 5.3 Read & summarise (reading_intent)

**What.** Student is shown a longer business email/memo (~250-300 words) on screen, no time limit. Writes a 3-4 sentence summary in their own words.

This replaces the spoken Sarah/Mark test with a silent reading test — separates reading comprehension from listening cleanly.

**Example prompt content.** Multi-paragraph email with:
- A surface ask ("can you confirm the Q4 SKU list")
- A buried subtext ("our finance team is questioning whether we still need three of the lower-volume lines")
- Hedge-language indirection ("I just want to make sure we're aligned before the budget meeting Tuesday")

**Variants.** 8-10 emails/memos per role. Difficulty modulated by indirection density (more hedging = higher band) and length.

**Scoring.** Claude scores:
- Surface comprehension (did they get the literal ask)
- Subtext identification (did they spot the buried question / risk / opportunity)
- Concision (did they summarise vs paraphrase)

Output: 0–1000 + CEFR + evidence.

### 5.4 Vocabulary at register (business_vocabulary)

**What.** 8-10 cloze items, each shown one at a time. Two formats:
- *Fill the blank*: "We need to ___ the contract before the Q3 deadline" → student picks from 4 options (e.g. *finalise / finish / end / close*) or types freely.
- *Pick the better word*: "Their proposal is ___ what we discussed" → *exactly / precisely / accurately / strictly* (calibrated by register).

**Variants.** 30-50 items per role, drawn from a bucket calibrated to that role's expected register. Each session pulls 8-10 randomly.

**Scoring.** Deterministic — count correct, weight by item difficulty. Output: 0–1000 + CEFR band + evidence (which items wrong tells you which gap).

This one doesn't need Claude scoring; it's the cheapest and fastest signal.

## 6. Learning-style probes (replaces self-report)

Three behavioural measurements taken *during* the battery, no extra UI dedicated to them:

### 6.1 Feedback-style preference

After the email-writing task is scored, surface the score with **two feedback panels visible**:

- **Direct rewrite**: shows the student's email and Aria's rewritten version side-by-side, with diffs highlighted.
- **Coaching questions**: shows the student's email and 3 questions ("What's the implicit ask in your second paragraph?", etc.) inviting them to revise.

Both visible. Student picks one to engage with first. Whichever they click first / spend longer on / actually revises in response to → recorded as their feedback preference. This is a real behavioural signal, not a self-report.

### 6.2 Explanation-format preference

Inside the vocabulary task, when a student gets one wrong, the explanation can be presented in three modes:
- **Rule** (text): "Use *finalise* when the action involves agreement; *finish* implies completion of work."
- **Example** (sentence pair): two sentences side-by-side, one using each word in context.
- **Try-again** (interactive): a fresh blank with similar register, immediate feedback.

Student sees all three tabs. Time-on-tab and click-through tell us which they actually use.

### 6.3 Session-pacing

Time the student takes to start each task after the previous one completes. Tight back-to-back = "deep dive" tolerance. Multi-minute pauses or session abandonment = "short bursts" preference. Logged as `task_started_at` deltas in the response table.

All three signals land in `discovery_sessions.profile_json.learning_style` as structured data, not narrative text. Aria's discovery session can keep her existing learning-style question for *qualitative* colour, but the buyer-facing dashboard reads the behavioural signal.

## 7. Data model

### 7.1 New tables

**Decision (eng review):** Prompt content is split into public + private
columns. RLS allows authenticated read on public, service-role only on
private. Stops a student `select`-ing the answers before taking the
task. `(student_id, task_type, attempt_number)` gets a unique
constraint so resume = update existing row, not insert new.

```sql
-- A bank of task prompts, role-scoped, versioned for re-test variants.
create table public.discovery_task_prompts (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in (
    'email_writing','listen_paraphrase','read_summarise','vocab_cloze'
  )),
  role_id uuid references public.roles(id) on delete set null,
  -- null role_id = generic prompt usable for any role
  difficulty_band text not null check (difficulty_band in
    ('A2','B1','B2','C1','C2')),
  variant_bucket text not null,
  -- Items in the same bucket are equivalent-difficulty so they can be
  -- swapped between attempt 1 and attempt N. Re-test query MUST also
  -- match cefr_band so mixed-difficulty buckets can't silently drift.
  prompt_public jsonb not null,
  -- Reads: any authenticated user (the battery UI needs it).
  -- email_writing: { scenario, target_word_count, persona }
  -- listen_paraphrase: { audio_url, instructions }
  -- read_summarise: { body, instructions }
  -- vocab_cloze: { stem, options, instructions }
  prompt_private jsonb not null,
  -- Reads: service role only (the scorer needs it).
  -- email_writing: { rubric_anchors }
  -- listen_paraphrase: { transcript, key_points }
  -- read_summarise: { surface_ask, subtext, expected_summary_outline }
  -- vocab_cloze: { correct, distractor_rationales }
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per task instance shown to a student.
create table public.discovery_task_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  discovery_session_id uuid references public.discovery_sessions(id),
  task_prompt_id uuid not null references public.discovery_task_prompts(id),
  task_type text not null,
  -- denormalised so the unique constraint can include it without a join
  attempt_number int not null default 1,
  -- attempt 1 = onboarding, 2+ = scheduled re-test
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  response_json jsonb not null,
  -- email_writing: { text, word_count, paste_count, total_keystrokes, total_seconds }
  --                ^ anti-cheat fields captured client-side, not enforced
  -- listen_paraphrase: { points: [...], plays_used }
  -- read_summarise: { summary }
  -- vocab_cloze: { selected, correct, time_taken_ms }
  score int check (score between 0 and 1000),
  cefr_band text,
  evidence text,
  scored_at timestamptz,
  scoring_model text,
  -- so we can re-score on rubric updates
  created_at timestamptz not null default now(),
  unique (student_id, task_type, attempt_number)
);

-- Index for the battery-complete check (Section 8).
create index discovery_task_responses_session_scored_idx
  on public.discovery_task_responses (discovery_session_id, scored_at);

-- Behavioural learning-style observations keyed to a discovery session.
-- Phase 0b.4 only — out of scope for Phase 0b.1.
create table public.discovery_learning_signals (
  id uuid primary key default gen_random_uuid(),
  discovery_session_id uuid not null references public.discovery_sessions(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'feedback_engagement',     -- which feedback panel they chose
    'explanation_format',      -- which explanation tab they used
    'pacing'                   -- time deltas between tasks
  )),
  signal_json jsonb not null,
  observed_at timestamptz not null default now()
);
create index discovery_learning_signals_session_idx
  on public.discovery_learning_signals (discovery_session_id, signal_type);
```

### 7.2 Existing tables touched

- `discovery_sessions` — no schema change. Battery completion is computed
  from `discovery_task_responses` row counts (see Section 8). Avoids a
  status column that can drift from reality.
- `discovery_sessions.profile_json.learning_style` becomes a structured
  object derived from `discovery_learning_signals` (no migration to
  existing rows; nullable). Phase 0b.4 only.
- `gap_scores` — gains two columns: `source text` (`'voice_transcript'` |
  `'battery_task'`) and `is_canonical boolean default true`. Lets us
  store both voice and battery scores for the same skill while only one
  shows on the dashboard. Audit trail + delta tracking.

### 7.3 RLS

- `discovery_task_prompts`: read-public for authenticated users (so the battery UI can fetch them). Insert/update/delete via service role only — task prompts are content the team curates.
- `discovery_task_responses`: students can read+insert their own (`student_id = auth.uid()`); employer admins can read for their cohort via the existing employer scoping path; service role for scoring writes.
- `discovery_learning_signals`: same as responses.

## 8. Scoring pipeline

**Decision (eng review):** Use Next.js `after()` to defer scoring past the
HTTP response. Vercel function timeouts (60s on Pro) won't accommodate a
synchronous Sonnet call (~8-15s) reliably across four sequential tasks.
`after()` keeps scoring in-process from a code-org standpoint while
freeing the response. Belt-and-suspenders: a Vercel cron at 5-min
intervals re-scores any rows where `submitted_at < now() - 2min AND
scored_at IS NULL` to recover from cold-start retries.

```
Task submitted
  → API: POST /api/onboarding/battery/submit
    - validates response shape
    - inserts task_response row with scored_at = NULL
    - returns 200 immediately
    - schedules scoring via after()
  → Scorer (after() callback):
    - Pulls prompt (private columns) + response + role_baseline
    - vocab_cloze: deterministic scoring
    - others: Claude call with task-specific rubric prompt
  → On scoring complete:
    - Update task_response with score/cefr/evidence/scored_at
  → Recovery cron (vercel.json crons, every 5 min):
    - Picks up rows where submitted_at < now() - 2min AND scored_at IS NULL
    - Re-runs scorer
  → Aggregator (called when all 4 battery tasks scored):
    - Reads battery scores + voice transcript scores
    - Picks per source-precedence table (Section 8 mapping)
    - Writes final gap_scores rows with source = 'battery_task' or 'voice_transcript'
    - Marks one row per skill as is_canonical = true (the rest stay
      as audit trail)
```

**Status computation, NOT a column.** Drop the `discovery_sessions.phase_0b_status`
column from the spec. Compute "battery complete" from
`count(discovery_task_responses) where session_id = X AND scored_at IS NOT NULL`.
Index covers it. Lets the dashboard banner and the artefacts tab read
the same source of truth without race conditions.

**Skill → source mapping** for the unified `gap_scores`:

| Skill | Voice (Phase 0a) | Battery (Phase 0b) | Winner |
|---|---|---|---|
| `speaking_fluency` | Measured | — | Voice |
| `listening_comprehension` | Sarah/Mark only | Listen & paraphrase | **Battery** |
| `writing_formal` | Inferred | Email writing | **Battery** |
| `reading_intent` | Spoken email | Read & summarise | **Battery** |
| `business_vocabulary` | Spoken vocab | Vocab cloze | **Battery** (with voice as supporting evidence) |
| `presentation_delivery` | Inferred | — | Voice (acknowledged weakness; addressed in Phase 1) |

`presentation_delivery` stays voice-only for MVP. Adding a recorded-presentation task is a Phase 1 item — out of scope for this spec.

## 9. Repeatability / re-test

The variant_bucket column is the load-bearing piece. Each task type has 2-3 buckets per role, each containing 4-5 equivalent-difficulty prompts. On attempt 1 we pull one prompt per bucket. On attempt 2 (typically 4-6 weeks later, triggered by the lessons engine when X criteria met), we pull a different prompt from the same bucket.

Score delta = attempt N score − attempt 1 score, per skill. The buyer dashboard shows this as the "progress trend" — the artefact they bought.

## 10. UI surfaces (new)

- `/onboarding/battery` — the page itself, single-page app with task-by-task progress.
- `/onboarding/battery/[taskId]` — individual task pages (or panes within the SPA, depending on auth flow).
- `/employer/students/[id]` — gains a "Phase 0b artefacts" tab showing the student's actual responses + scores. This is what the employer sees when they click into a student.
- Re-test trigger UI — out of scope for this doc; assumed to live wherever lesson scheduling lives.

## 10b. Type safety (eng review addition)

`prompt_public`, `prompt_private`, and `response_json` carry four
different shapes per `task_type`. To stop runtime explosions when one
consumer reads the wrong shape:

`src/lib/onboarding/battery/types.ts` defines a discriminated union:

```typescript
type EmailWritingPromptPublic = { scenario: string; target_word_count: { min: number; max: number }; persona: string };
type ListenParaphrasePromptPublic = { audio_url: string; instructions: string };
// etc.

type TaskPromptPublic =
  | { task_type: "email_writing"; data: EmailWritingPromptPublic }
  | { task_type: "listen_paraphrase"; data: ListenParaphrasePromptPublic }
  | ...

const TaskPromptPublicSchema = z.discriminatedUnion("task_type", [...]);
```

Single `parseTaskPromptPublic(row)` and `parseTaskResponse(row)` exports.
Every consumer routes through them. No raw `prompt_json as any`.

## 11. Phasing

**Decision (eng review):** Ship Phase 0b.1 first. ~1 week. Closes the
biggest credibility hole (writing) with the smallest blast radius.

If we build the whole thing in one go it'll take 4-6 weeks. Suggested incremental ship order:

**Phase 0b.1 — Writing only (FIRST SHIP).** ~1 week. Adds the
email-writing task, scoring via `after()`, and the unified `gap_scores`
write. Replaces the inferred `writing_formal` score immediately. This
is the highest-leverage single change. Includes:

- Migration with `discovery_task_prompts` (public + private split) and
  `discovery_task_responses` (with unique constraint).
- `gap_scores.source` + `is_canonical` columns.
- `src/lib/onboarding/battery/types.ts` discriminated unions.
- `src/lib/onboarding/battery/scoreEmailWriting.ts` scorer.
- `src/app/api/onboarding/battery/submit/route.ts` with `after()` defer.
- `src/app/(app)/onboarding/battery/page.tsx` with paste/keystroke logging.
- Aggregator that reconciles voice + battery scores per skill.
- Vercel cron at 5-min intervals to recover stuck rows.
- Aria handoff: closing phrase change in `scripts/discovery-system-prompt.ts`,
  `endAndExit` routes to `/onboarding/battery` instead of `/dashboard`.
- Feature flag `BATTERY_ENABLED` so we can ship dark and roll out per-cohort.

**Phase 0b.2 — Reading + Vocab.** ~1 week. The other two typed tasks. Both reuse the same submit pipeline, no new infrastructure beyond more prompt content.

**Phase 0b.3 — Listen & paraphrase + audio playback UI.** ~1 week. The audio task is more UI work (clip player, replay limits, accessibility) and depends on TTS clip generation tooling.

**Phase 0b.4 — Learning-style behavioural probes.** ~3-5 days. The three signals + the structured `learning_style` profile_json change. Lower priority because it's a *better* version of something we already do (badly). Ship after the measurement gaps are closed.

Re-test variant scaffolding is built from Phase 0b.1 onwards (it's just `variant_bucket`); the actual re-test trigger is a Phase 1 problem.

## 12. Open questions

1. **Anti-cheat for the writing task.** Pasting from ChatGPT is the obvious failure mode. Lightweight: log keystroke timing (typing rhythm vs paste-and-leave is detectable). Heavier: typing-only mode that disables paste. Open question: is the cohort honest enough that we don't need this, or is it day-one critical?

2. **Time pressure.** Should each task be timed? Pros: signal value (someone who takes 20 min to write a 200-word email is sending a signal). Cons: stressful, may depress scores below the student's true ceiling. Recommendation: track time as a signal, don't enforce it as a deadline. Open.

3. **Skip / pause in the battery.** If a student abandons mid-battery, what's the dashboard show? Recommend: their voice score plus `phase_0b_status = 'in_progress'` with an "Resume battery" CTA on the dashboard, no auto-fail.

4. **Mobile.** Email writing on a phone is brutal. Listen & paraphrase is fine. Vocab cloze is fine. Read & summarise is borderline. Recommendation: force the writing task to landscape on mobile + min-screen-width gate, OR offer a "complete on desktop" deferral. Decision needed.

5. **Audio storage.** Listen & paraphrase clips — generate at task-prompt seeding time and store in Supabase Storage, OR generate on demand via ElevenLabs API per session? On-demand is fresher but slower and incurs TTS spend per session. Recommendation: pre-generate at seed time, version per role.

6. **Scoring queue vs in-process.** For MVP, in-process inside the submit handler is fine — Claude scoring takes ~5-15 sec per task. At 1k students and re-tests every 4 weeks, that's ~250 scorings/week peak. Doable inline. At 10k+ this needs a real queue. When do we cut over?

## 13. Out of scope for this spec

- Re-test scheduling logic (when does the lessons engine decide it's time?)
- Presentation_delivery measurement (recorded presentation task — Phase 1)
- Pronunciation isolation (separate from speaking fluency)
- Bilingual scaffolding for low-A2 students (current floor is A2; below that the battery isn't useful)
- Any anti-cheat beyond keystroke logging
- Employer-side scoring overrides ("we think this employee is actually B1 not A2")

---

## Decisions needed before build

1. Phase order — confirm 0b.1 (writing) ships first?
2. Anti-cheat — paste detection at MVP, or trust until we see evidence of cheating?
3. Time pressure — track-only or enforced deadlines?
4. Mobile policy — force desktop or graceful deferral?
5. Audio strategy — pre-generated clips or on-demand TTS?
6. Where does the prompt content come from? Curated by us, or do employers contribute role-relevant prompts during role discovery?

Each of these has a working default in the spec; this list is just the ones worth a five-minute conversation before we write the migration.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 14 issues raised, 3 user decisions locked, 4 obvious-fix issues folded into spec, 0 critical gaps remaining |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0 (all 3 user-facing decisions locked: after() scoring, Phase 0b.1 first, paste/keystroke logging at day one)

**VERDICT:** ENG CLEARED — ready to implement Phase 0b.1.

### Decisions locked
- **Scoring queue:** Next.js `after()` + 5-min recovery cron (over real queue or in-process await).
- **Phase order:** Phase 0b.1 (writing only) ships first.
- **Anti-cheat:** Log `paste_count` + `total_keystrokes` + `total_seconds` from day one; surface to admin, don't block.

### Obvious-fix items folded into spec without separate decision
- `prompt_json` split into `prompt_public` + `prompt_private` for RLS safety (answers no longer readable by students).
- `discovery_task_responses` gains `unique (student_id, task_type, attempt_number)` so resume = update.
- `phase_0b_status` column dropped from `discovery_sessions`; computed from row counts.
- `gap_scores` gains `source` + `is_canonical` columns to reconcile voice + battery scores per skill.
- `src/lib/onboarding/battery/types.ts` added as the single source of truth for discriminated unions across the four task types.
- Aria handoff explicitly listed as a Phase 0b.1 task (closing-phrase prompt update + redirect change).

### Open questions remaining (out of scope for this review, decide before each later phase)
1. Anti-cheat beyond paste/keystroke (Phase 0b.4 question)
2. Time pressure on tasks (Phase 0b.2 question)
3. Mobile policy (Phase 0b.1 — desktop-only is the implicit default; revisit if data shows mobile usage)
4. Audio strategy: pre-generated vs on-demand TTS (Phase 0b.3 question)
5. Where prompt content comes from — curated by us or contributed by employers during role discovery (Phase 1 question)

