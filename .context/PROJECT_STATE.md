# PROJECT_STATE — LingoPure WOW Phase

**Updated:** 2026-09-22 continued (ISS-053/054 pushed to the LIVE production Aria agent + independently verified)
**Scope doc:** `docs/WOW_PHASE_SCOPE.md` (approved + eng-reviewed; §11 locks all decisions)

## Session log — 2026-09-22 continued #3 (ISS-053/054 actually deployed — a stale-blocker correction)

When asked why ISS-052/053/054/058/063 weren't closed, I repeated an earlier session's note that
ISS-053/054's live push was blocked on missing `ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID` — without
re-checking it myself. Dennis pushed back; checked directly; **both were actually set in
`.env.local` the whole time.** The blocker was stale and I passed it along uncritically — worth
recording as the mistake it was, not glossing over.

**Fixed for real, not just code-complete:**
- Confirmed `scripts/discovery-system-prompt.ts` already contains both fixes (Dimension 1/3
  cross-reference so Aria doesn't re-ask an answered question; the "mirror the student's spoken
  complexity" instruction) before pushing anything.
- Ran `npx tsx scripts/update-discovery-prompt.ts prod` — note the actual argv check in that script
  is a bare `prod` positional argument, NOT the `--target prod` flag form its own comment describes;
  `--target prod` would silently fall through to the sandbox target instead of throwing. Needed
  `set -a; source .env.local; set +a;` first — the script doesn't load `.env.local` itself (only
  reads `process.env` directly), unlike the inline verification scripts elsewhere this session that
  used `require('dotenv').config(...)`.
- **Independently verified** via a fresh `GET /v1/convai/agents/:id` (not trusting the script's own
  "✓ Agent updated" message) — the live prompt on `agent_8701m2eyrep6exysepd25r16msst` now contains
  both fix strings, prompt length 13004 chars.

ISS-053/054 marked Resolved in both trackers. **Still open, unstarted**: ISS-052 (live transcription
— genuinely unbuilt, not blocked), ISS-058 (CEFR-18 depth not carried into Programme/Aria —
genuinely unstarted). **Still genuinely blocked**: ISS-063 (live walkthrough) — confirmed
`QA_TEST_USER_EMAIL`/`QA_TEST_ADMIN_EMAIL` are NOT set in this environment, so this one's blocker is
real, unlike ISS-053/054's turned out to be.

## Session log — 2026-09-22 continued #2 (Tier 3: gap-vs-missing-evidence honesty)

Checked whether ISS-059 (role-floor gap vs target-level gap not distinguished) and ISS-060 (missing
evidence must render "Not assessed", never a zero) were real gaps or another doc-reconciliation miss
— same read-before-editing approach as Tier 2. Both turned out to be MOSTLY already fixed by
`678ea53`, same pattern as ISS-047/048/050:
- `computeGap()` already returns `roleFloorGap`/`targetGap` as two separate values, and `/plan`
  already renders both labeled distinctly. Daniel's original complaint (a single unlabeled "Role
  gap" column) was from the pre-migration version of that page.
- The Dashboard's `ScoreBar` and `/plan`'s skill rows already render "—"/"Not yet assessed" for a
  null score, never a numeric 0.

**One real gap found and fixed today**: `GapRadar` (student dashboard) and `TRadar` (telemetry
surfaces) already gave an unassessed skill a distinct hollow/dashed DOT marker (also landed
`678ea53`), but the FILLED polygon behind it still plotted that axis through 0 — so the chart's
overall shape read as "this skill measured near-zero" while the dot right next to it said "not yet
assessed." A contradiction on the same chart. Both radars now build the score polygon from ONLY the
assessed axes, skipping unassessed ones so the line jumps straight to the next assessed point rather
than dipping to the centre. `tsc --noEmit` + `npm run build` clean.

Reconciled ISS-059/060 in both trackers.

## Session log — 2026-09-22 continued (Tier 2: why grammar/live_interaction never score)

Investigated the "significant functional gap" question directly: is the six-dimension taxonomy
fix (ISS-048) real or hollow? Traced the full write path first (read before editing, per the
workflow contract) — `score-discovery.ts` requires both new dimensions via `GapScoresSchema`,
`loadBaselinesForStudent`/`loadBaselinesForRole` defensively default to flat 800 for any missing
skill, and both role-creation paths (`self-setup.ts`, `/api/employer/roles`) already write all 6
skills correctly for new roles. The code was never broken.

**Root cause, confirmed two ways:**
1. **No discovery session has run since the fix shipped.** Queried the 10 most recent completed
   `discovery_sessions` live — the newest is 2026-09-20, a full day BEFORE `678ea53` (2026-09-21).
   The new-dimension scoring path had simply never been exercised, live or otherwise.
2. **`role_baselines` was never backfilled for the two new dimensions** — genuinely new data, not a
   rename, so migration 0058 had nothing to carry over. Confirmed live: 108 rows across 19 roles,
   zero for grammar/live_interaction.

**Fixed:**
- `supabase/migrations/0060_backfill_grammar_live_interaction_baselines.sql` — applied to the live
  sandbox DB (`uovbwccvxgdghqvlpuql`, ref verified before push). 6 roles whose name matches a
  self-setup.tsx preset got that preset's judgment-call values (grammar/live_interaction, same
  rationale already documented there); the remaining ad-hoc roles got the explicit flat-800 default
  (made explicit rather than relying on the runtime fallback). Live-verified after push:
  `role_baselines` now has 19/19 rows for both new dimensions (was 0/19).
- **Verified the scoring pipeline actually works**, not just that it doesn't crash: ran a synthetic
  transcript (deliberately containing a self-corrected tense error and an explicit "sorry, can you
  repeat?" turn-taking repair) through the REAL `SYSTEM_PROMPT` + `GapScoresSchema` + Claude call —
  no DB write, so no fake data landed against a real student. The model correctly isolated grammar-
  specific errors ("the claim process **take**", "I **offer** to escalate") as distinct from
  speaking fluency, and live_interaction repair behaviour as distinct from presentation_delivery —
  real signal, matching the SYSTEM_PROMPT's own worked examples, not just schema compliance. Script
  was temporary (`scripts/tmp-verify-*.ts`), deleted after use, never committed.

**Still open (unchanged by this fix):** no LIVE discovery session — a real voice call through Aria
— has run since `678ea53` shipped. The write path is now proven correct in isolation (synthetic
transcript) and the baseline data is real, but nobody has watched an actual student's discovery
session write a real grammar/live_interaction row end to end. This is part of what ISS-063 (Daniel's
full evidence-chain demo request) would close.

## Session log — 2026-09-22 (ISS-047 doc reconciliation, DB verification, ISS-049 join flow)

- **ISS-047 (B2.3 vs B1) reconciled, not re-fixed** — the code fix landed as a side effect of
  `678ea53` (Phase 2 taxonomy migration) but was never marked resolved in the trackers. Verified
  against Daniel's real production `gap_scores` (speaking 672/listening 685/writing 590/reading 541,
  avg 622) — both Dashboard and `/plan` now agree on B2/B2.3. `ISSUE_LOG.md` + `ISSUES_TRACKER.md`
  updated with the evidence.
- **DB-side Phase 2 verification closed** — queried live `gap_scores` (70 rows) directly via the
  Supabase REST API (service-role, read-only): zero rows on any old skill name, all correctly
  renamed. **New confirmed finding**: `grammar` and `live_interaction` have **zero rows anywhere**
  in the live DB — no student has ever received either new-dimension score. Stronger than the prior
  "unverified" framing; the write path for the two new primary dimensions has never fired in prod.
- **Deploy-SHA verification still blocked** — same structural gap as last session (no Vercel CLI
  link, MCP scoped to the stale `corporate-ai-solutions`/`lingo-pure-ai` project, no QA test
  credentials in `.env.local` to drive an authenticated live check). `vercel login` was attempted
  twice this session; the device-auth code expired before the browser confirmation completed both
  times. **Next session: re-run `vercel login`, confirm the browser step within the code's window,
  then link `purelingo-app-sandbox` under `dev-lingo-pure`/`lingopure-cloud`.**
- **ISS-049 follow-up shipped — the real "join existing org" flow.** `runSelfSetup()` now looks up
  the normalised slug BEFORE inserting; a match creates a `pending` `organisation_memberships` row
  against the EXISTING org (no duplicate org/employer/role/baselines, no `students.employer_id`/
  `role_id` until approved — "a matching name alone must not grant membership" per Daniel's review).
  Self-setup UI shows a "Request sent — waiting for approval" state instead of routing into
  discovery. New "Pending join requests" card on `/employer` (`PATCH`/`DELETE
  /api/employer/join-requests/[id]`) lets an admin assign a role — scoped to that org's own roles
  only, never a cross-org role — and approve, or decline (deletes the pending row, no tombstone).
  15/15 `tests/org/self-setup.test.ts` (3 new), `npx tsc --noEmit` clean, `npm run build` clean.
  **Not independently verified live** (no QA credentials to drive a real self-setup → collision →
  approve walkthrough in a browser this session).
- **Housekeeping**: caught and flagged a mid-session mistake — an overly broad env-var grep printed
  a live `VERCEL_OIDC_TOKEN` into the conversation transcript while looking up the app URL. Dev-scoped
  and short-lived, for the stale project, so low practical exposure, but flagged to Dennis directly
  rather than quietly moving on. No further env dumps for the rest of the session.

## Session log — 2026-09-21 continued #3 (Phase 2 SHIPPED)

**Pushed + migrated. The taxonomy cutover is live.**

- Commit `678ea53` pushed to both `origin` (caistech/LingoPureAI) and `lingopure`
  (LingoPure/purelingo-app-sandbox) → triggered a Vercel deploy of the sandbox.
- Waited ~4.5 minutes (bounded poll loop; the live site was reachable throughout — Vercel does an
  atomic swap, so a 200 during the window doesn't by itself prove the NEW deploy is live). **Could
  not independently confirm the deployed commit SHA**: the Vercel CLI isn't installed, the connected
  Vercel MCP is scoped to the Corporate AI Solutions team (only sees the STALE `lingo-pure-ai`
  project, not `purelingo-app-sandbox` under the `lingopure-cloud`/`dev-lingo-pure` team), and there's
  no local `.vercel/project.json` link. This is a real gap for next session (see below).
- Then ran `supabase migration list` against the linked ref (`uovbwccvxgdghqvlpuql` — confirmed
  correct, matches the sandbox) — confirmed 0057 already applied remotely, 0058 pending.
- Ran `supabase db push` — **applied cleanly, no errors** ("Applying migration
  0058_backfill_skill_taxonomy_renames.sql... Finished supabase db push."). This is a real Postgres
  connection (not the Management API), so a constraint violation or bad SQL would have surfaced here.
- **Could not independently re-query `gap_scores`/`role_baselines` afterward to eyeball the new skill
  values**: `supabase db query --linked` 403'd ("account does not have the necessary privileges" —
  same Management-API restriction noted in earlier sessions), and reading `.env.local` directly to
  script a service-role verification query was blocked by this session's tool permissions.

**Not verified (be the one to close this next session):**
1. **Deployed commit SHA matches `678ea53`** — recommend `npx portfolio-gate-deploy-status` once the
   Vercel CLI is installed (`npm i -g vercel`) and linked to the correct team, or check the Vercel
   dashboard directly (project `purelingo-app-sandbox`, team `dev-lingo-pure`/`lingopure-cloud`).
2. **`gap_scores`/`role_baselines` actually show the new key names post-backfill** — the migration
   reported success but wasn't independently re-queried. A quick check: `select distinct skill from
   gap_scores` should show `speaking/listening/writing/reading` (not the old names) plus
   `business_vocabulary`/`presentation_delivery` untouched, and zero rows still on
   `speaking_fluency`/`listening_comprehension`/`writing_formal`/`reading_intent`.
3. **A live discovery/battery run actually produces grammar + live_interaction scores** — this is
   the first real end-to-end proof the new dimensions work, not just that the code compiles.

**If either #1 or #2 comes back wrong**, the fix is small (re-push the code / re-run 0058) but should
happen before Daniel/Shamini/Thao/Stephen are asked to re-run discovery (step 5 below) — don't want
them re-assessed against a half-migrated backend.

## Session log — 2026-09-21 continued #2 (Phase 2 code cutover COMPLETE — pushed this session)

**The working tree now compiles clean.** `npx tsc --noEmit` passes with zero errors related to the
taxonomy migration (the only remaining errors are pre-existing, unrelated mock-typing issues in
`tests/org/create-client-org.test.ts`, last touched 2026-09-17, not introduced this session).
`npm run build` completes successfully. `npm run test:curriculum` (20/20), `tests/org/self-setup.test.ts`
(10/10), and `tests/bpo/*.test.ts` (24/24) all pass.

**Finished this session** (completing the ⬜ file list from the prior entry, plus several files the
prior session's audit missed — found via a full `grep -rn` sweep of `src/` for the four old key
strings after the initially-scoped files were done):

- `SYSTEM_PROMPT` in `rubric.ts` rewritten — "THE 6 PRIMARY DIMENSIONS" + "SUPPORTING SIGNALS"
  sections, with the drafted Grammar/Live Interaction content applied verbatim.
- `plan-generator.ts`, `plan-delivery.ts` (+ `PlanData.supportingSkills`), dashboard + `/plan` pages
  (new "Supporting signals" sections on both, rendering business_vocabulary/presentation_delivery
  separately from the radar) — the two supporting-signals UI additions weren't in the original
  per-file list, added to match Daniel's placement request.
- Employer-side label maps (4 files) + `certification-card.tsx`.
- Full battery subsystem: `types.ts` (`TASK_SKILL` now `Record<TaskType, AnySkillKey>`),
  `select-tasks.ts`, `report.ts`, `reconcile.ts`.
- `curriculum-engine.ts` (aliased `AnySkillKey as SkillKey` on import — least-diff way to widen a
  file with ~15 internal `SkillKey` references without touching each one).
- `self-setup.ts` + `self-setup.tsx` — `SELF_SETUP_SKILLS` narrowed to the 6 primary; **new
  grammar/live_interaction baseline numbers judgment-called for all 9 role presets** (no historical
  data exists — derived from each role's existing rationale: grammar tracks written-precision
  demand, live_interaction tracks how real-time/reactive the role is).
- BPO subsystem: `capability-to-skill.ts` (now fully self-consistent — GRM→grammar, INT→live_interaction,
  VOC→business_vocabulary unchanged, no code for "writing"), `intelligence.ts` + `delta-report.ts`
  (deleted local `SKILL_KEYS` duplicates, now import + combine the canonical primary+supporting sets),
  `edge.ts`.
- `session-rubric.ts` (live-class rubric) — added Grammar/Live Interaction nullable sections;
  `score-session.ts`'s write loop widened to cover all 8 dimensions (was 6-primary-only, which would
  have silently stopped writing business_vocabulary/presentation_delivery from session scoring).
- `set-canonical.ts` — `CanonicalWrite.skill` widened `SkillKey → AnySkillKey` (required once any
  writer needed to write a supporting-skill row).
- **Found via the full-repo sweep, not in the original file list**: `email-sprint-rubric.ts` +
  `-evaluate.ts` + `-generate.ts`, `speak-score-rubric.ts` + `-evaluate.ts` + `-generate.ts`, both
  lesson runner UIs, `post-call-status.tsx`, `bpo/edge/ingest/route.ts` (another local `SKILL_KEYS`
  duplicate), `battery/score.ts` doc comments, `discovery/status/route.ts`. All of these had
  `writing_formal`/`reading_intent`/`speaking_fluency`/`listening_comprehension` baked into zod
  schemas or literal arrays that would have either failed to compile or silently stopped writing
  scores post-cutover.
- Seed/demo data (cosmetic but must-compile): `seed-demo.ts` (5 students × scores/evidence + 3 role
  baselines, all renamed + grammar/live_interaction values added), `abc-personas.ts` (6 role
  baselines), `scripts/seed-abc-canned.ts`, `scripts/seed-test-org.ts`.
- `role-discovery/schema.ts` prompt text — the `presentation_delivery` baseline-anchor mentions were
  stale (that skill isn't part of what this schema's `skills` object generates — it's driven by
  `SKILL_KEYS`, now 6 primary only); replaced with `live_interaction`, the closest real generated
  field for "live presentations to non-native audiences."
- Test files: `tests/org/self-setup.test.ts`, all 4 `tests/curriculum/*.test.ts`, all 3
  `tests/bpo/*.test.ts` — bulk-renamed the 4 pure-rename keys.
- **`0058_backfill_skill_taxonomy_renames.sql` REWRITTEN** per the corrected design from the prior
  entry: ONLY the 4 pure renames (`speaking_fluency→speaking`, `listening_comprehension→listening`,
  `writing_formal→writing`, `reading_intent→reading`) in `gap_scores` AND `role_baselines`.
  `business_vocabulary`/`presentation_delivery` are NOT touched (kept live, unrenamed, as supporting
  measures) — the old draft's `is_canonical=false` demotion of those two was the superseded design.
  `grammar`/`live_interaction` get no backfill (genuinely new, start null). **NOT YET PUSHED** — per
  the sequencing constraint below.

**⚠️ NOT YET DONE — this is the next step, don't skip the ordering:**
1. Commit all the above (Phase 1 + Phase 2 code together — they were never split, per the original
   sequencing note).
2. Push to both remotes → triggers Vercel deploy.
3. Wait for the deploy to complete.
4. Push the rewritten `0058` migration immediately after (`supabase db push` or equivalent) — NOT
   before, and NOT more than a few minutes after, per the "no partial-disruption ordering" constraint
   (deploying new code before the rename, or renaming before the new code deploys, both cause all 6
   primary skills to briefly read as unassessed on whichever side hasn't moved yet).
5. Re-assess Daniel/Shamini/Thao/Stephen (fresh discovery/battery run each) once grammar/live_interaction
   are live — there's no historical data for those two dimensions, so their profiles will show
   "not yet assessed" on those two bars until they run a new discovery session.
6. Then proceed to Phase 3 (telemetry/radar UI) → Phase 4 (org setup + magic-link) → Phase 5 (Aria
   prompt) → Phase 6 (copy fixes) → Phase 7 (Daniel sign-off walkthrough) → Phase 8 (sales-funnel
   reframing, ISS-064/065) per the approved build plan.

**Known pre-existing, out-of-scope issue (unchanged from before this session):**
`tests/org/create-client-org.test.ts` has 9 pre-existing `tsc` errors (mock-typing — `Property 'log'
does not exist on type 'never'`), last touched in commit `85dc07e` (2026-09-17), unrelated to the
skill taxonomy. Not fixed as part of this migration — flagged for its own session.

**New background item raised mid-session, not yet actioned:** Dennis shared internal meeting-prep
notes (referencing `docs/LingoPure_Malaysia_Expansion_Next_Steps_Agenda V2.docx`, dropped untracked
in `docs/`) about how to integrate the ClassIn "demo AI teacher" with the current dashboard —
whether to (1) generate a personalised curriculum then map it onto ClassIn's format, (2) reshape the
AI-generated plan to match ClassIn's format directly, or (3) run a hybrid part-ClassIn/part-PureLingo
model. Decision explicitly deferred — "let's see what a personalised plan looks like after these
changes then map it against ClassIn." Relevant to the currently-dormant `curriculum-engine.ts`
(§ C0, unwired from the live `/plan` flow) and to Phase 8's sales-funnel reframing. No code action
taken; surface this when curriculum-engine work or Phase 8 comes up.

## Session log — 2026-09-21 continued (Phase 1 shipped + verified; Phase 2 mid-flight — READ BEFORE TOUCHING CODE)

**⚠️ THE WORKING TREE DOES NOT COMPILE RIGHT NOW.** `src/lib/scoring/rubric.ts` is mid-edit:
`SKILL_KEYS`/`SUPPORTING_SKILL_KEYS`/`SKILL_LABELS`/`GapScoresSchema` have been updated to the NEW
taxonomy, but `SYSTEM_PROMPT` still describes the OLD six dimensions by their old names, and **none**
of the ~20 consumer files have been updated to match the new `SkillKey` union yet. Do not `npm run
build`/deploy/push further migrations until Phase 2's code cutover (below) is complete. Nothing has
been committed or pushed to git this session — the local tree is the only place this half-state
exists; production is unaffected and still runs the pre-Phase-1 code.

### Phase 1 — DONE, verified against live tester data, not yet committed/deployed
Fixes ISS-047/050/058/059/060 (dashboard vs `/plan` contradicting each other). Files changed:
`src/lib/scoring/rubric.ts` (added `scoreToCefrBand()`, `CEFR_TARGET_FLOOR`, `computeGap()` — the one
shared banding/gap module), `src/lib/plan/plan-delivery.ts` (deleted the divergent local
`scoreToCefr()`, `SkillProfile` now carries `roleFloorGap`/`targetGap`/`assessed`/`lp18Band`),
`src/app/(app)/plan/page.tsx` (two labeled gap lines, distinct not-assessed visual), `src/app/(app)/dashboard/page.tsx`
(removed the `TARGET_SCORE` double-conversion bug — the exact cause of the "C2.1 target" bug — and the
"Now" badge now reads live `gap_scores` instead of frozen `discovery_sessions.profile_json`),
`src/components/dashboard/gap-radar.tsx` + `src/components/telemetry/radar.tsx` (unassessed skills get
a distinct hollow/dashed marker, never a real-zero vertex).

**Verified, not just unit-tested**: ran `buildPlan()` directly against the LIVE sandbox DB for Daniel
Maneveld's real account and reproduced his EXACT reported bug from real numbers — his average score
(623.5) landed on B1 under the old `/plan` formula and B2 under the old dashboard formula; the new
`scoreToCefrBand()` puts both at B2. Confirmed for Daniel, Shamini, Thao, and Stephen Munich's real
accounts. Also confirmed the target-badge fix and the not-assessed rendering fix against a partial
account (Olivia Xinyi Nair-Lim, 3/6 skills).

**Not yet done for Phase 1**: commit + push. Should ship together with Phase 2's cutover per the
sequencing note below, not separately.

### Phase 2 — Six-dimension taxonomy migration (ISS-048), IN PROGRESS

**Design, locked this session** (see `docs/ISSUE_LOG.md` for the reasoning trail): six PRIMARY,
CEFR-mapped dimensions exactly matching Daniel's reference framework — **speaking, listening,
writing, reading, grammar, live_interaction**. Two SUPPORTING measures, kept under their ORIGINAL
keys, unrenamed, demoted from headline bars to secondary signals — **business_vocabulary,
presentation_delivery** (Daniel's own words: "vocabulary and presentation can remain supporting
measures"). Grammar and Live Interaction are genuinely NEW dimensions, not relabeled from anything —
CEFR treats Grammatical Accuracy, Vocabulary Range, Spoken Production and Spoken Interaction as four
DISTINCT scales, so neither "vocabulary→grammar" nor "writing→grammar" would have been a clean
mapping; inventing them fresh (with vocab/presentation demoted rather than deleted) was the only
option that didn't misrepresent old evidence as measuring something it didn't.

**DB migrations:**
- `0057_widen_skill_taxonomy.sql` — **PUSHED, LIVE on sandbox `uovbwccvxgdghqvlpuql`, verified
  working** (functionally tested: inserted real rows under all 6 new keys against a disposable test
  student, confirmed accepted, cleaned up). Purely additive — widens the CHECK constraint on all 7
  skill-column sites (`gap_scores`, `role_baselines`, `gap_score_history`, `workplace_observations`,
  `curriculum_lessons`×not exactly — see file, `lesson_completions`, `tutor_feedback`) to accept old
  AND new keys simultaneously. Safe, no data touched, already live.
- `0058_backfill_skill_taxonomy_renames.sql` — **WRITTEN BUT STALE — DO NOT PUSH AS-IS.** This file
  on disk reflects an EARLIER, SUPERSEDED design (it marks `business_vocabulary`/`presentation_delivery`
  rows `is_canonical = false`, treating them as retired). That's now WRONG — under the locked design
  above, those two keys are kept and NOT touched at all (no rename, no `is_canonical` flip — they stay
  exactly as live). **0058 must be rewritten before pushing**: it should now ONLY do the 4 pure
  renames (`speaking_fluency→speaking`, `listening_comprehension→listening`, `writing_formal→writing`,
  `reading_intent→reading`) in `gap_scores` AND `role_baselines`. Nothing else. `grammar`/`live_interaction`
  get no backfill (genuinely new, start null) — Phase 1's `assessed`/gap logic already renders that as
  "not yet assessed" correctly, not as a zero.
- **NOT YET WRITTEN**: the eventual narrow migration (drop old-key CHECK support) — comes after a
  live query confirms zero rows remain under the 4 old-pure-rename keys. Not urgent.

**⚠️ Sequencing constraint, confirmed with Dennis**: deploying new code (which will look up rows by
the NEW key names) before the backfill migration runs — or running the backfill before the new code
deploys — BOTH cause **all 6 primary skills to briefly read as unassessed** on whichever side hasn't
moved yet (DB rename and code deploy are one logical cutover split across two systems). There is no
partial-disruption ordering. Plan: finish ALL code changes below, commit, push to both remotes
(triggers Vercel deploy), then run the (rewritten) 0058 backfill migration as soon as that deploy
completes — minimizes the blackout to the Vercel build+deploy window rather than leaving it open.

**Code changes — status per file** (✅ done this session / ⬜ not started):
- ✅ `src/lib/scoring/rubric.ts` — `SKILL_KEYS`/`SUPPORTING_SKILL_KEYS`/`SKILL_LABELS`/`AnySkillKey`
  type added; `GapScoresSchema` updated to 8 required `SubScore` fields (6 primary + 2 supporting,
  new key names) + `overall_cefr` description updated to say "SIX PRIMARY sub-skills only".
  ⬜ **`SYSTEM_PROMPT` NOT YET REWRITTEN** — still describes the old 6 dimensions under old names.
  Drafted (reviewed + approved by Dennis, ready to paste in) but not yet applied:
  - New **Grammar** section: grammatical accuracy (tense, agreement, articles, word order) —
    explicitly DIFFERENT from speaking's fluency (pace/hesitation), scored from errors AND correct
    forms across the whole transcript, self-correction credited as awareness not penalized twice.
  - New **Live Interaction** section: real-time conversational competence (turn-taking, repair,
    responsiveness to what Aria actually asked) — explicitly DIFFERENT from presentation's monologue
    delivery. CEFR Spoken Interaction, not Spoken Production. A student who asks "sorry, can you
    repeat that?" and then answers correctly scores HIGHER than one who guesses confidently and
    answers the wrong question.
  - Restructure into "## THE 6 PRIMARY DIMENSIONS" (speaking/listening/writing/reading/grammar/
    live_interaction) + "## SUPPORTING SIGNALS" (business_vocabulary/presentation_delivery, content
    unchanged from today, just relabeled as secondary).
  - CALIBRATION ANCHORS worked examples not yet updated to include grammar/live_interaction (Dennis
    deferred this — offered to draft, not requested yet).
- ⬜ `src/lib/lessons/plan-generator.ts` — has its OWN duplicate `SKILL_LABELS` + `SKILL_TO_RECOMMENDATION`
  keyed on old names. Needs both updated; `SKILL_LABELS` should just re-export from `rubric.ts` instead
  of duplicating.
- ⬜ `src/app/(app)/dashboard/page.tsx` — local `SKILLS` array (old keys/labels) needs updating to new
  6 primary; needs a NEW "Supporting signals" section rendering business_vocabulary/presentation_delivery
  separately (Daniel's own suggested placement — not in the radar).
- ⬜ `src/app/(app)/plan/page.tsx` — same supporting-signals section, for consistency with dashboard.
- ⬜ 4 employer-side duplicate label maps: `src/app/employer/(authed)/page.tsx`,
  `src/app/employer/(authed)/students/[id]/page.tsx`, `src/app/employer/(authed)/roles/page.tsx`
  (terser labels), `src/app/employer/(authed)/roles/role-form.tsx` (+ its `SKILL_HINT` map) — all need
  the new 6 keys; ideally all import `SKILL_LABELS` from `rubric.ts` instead of hand-rolling.
- ⬜ `src/components/dashboard/certification-card.tsx` — own `SKILL_LABEL` duplicate, old keys.
- ⬜ Battery subsystem: `src/lib/onboarding/battery/types.ts` (`TASK_SKILL` map — `vocab_cloze` target
  stays `business_vocabulary` UNCHANGED, a nice confirmation the design is right; `email_writing`/
  `listen_paraphrase`/`read_summarise` targets rename to `writing`/`listening`/`reading`),
  `select-tasks.ts` (`ALWAYS_PROBE` set + `ProfileJson` type + the writing_formal fallback reference),
  `report.ts` (`SKILL_LABELS` map), `reconcile.ts` (doc comment only, code is already taxonomy-agnostic).
- ⬜ `src/lib/curriculum/curriculum-engine.ts` — `MODALITY_MAP`/`SKILL_TITLES`/hardcoded `all_skills`
  array. **Low priority**: this pipeline (`curriculum_lessons`/`lesson_completions`/`tutor_feedback`,
  0 live rows) is dormant/unwired from the actual live `/plan` flow (that's `plan-delivery.ts`, already
  fixed). Safe to defer without affecting Daniel/Shamini/Thao/Stephen's live experience.
- ⬜ `src/lib/org/self-setup.ts` (`SELF_SETUP_SKILLS`, 6 keys, seeds `role_baselines` for new self-setup
  orgs — should become the 6 PRIMARY only, no baseline needed for the 2 supporting) and
  `src/app/(app)/onboarding/self-setup.tsx` (`ROLES` — 9 job-role presets × 6 baseline numbers each;
  needs REAL new numbers for grammar/live_interaction per role, not just a rename — no historical
  data exists for these two dimensions, so this needs a judgment call per role, not mechanical).
- ⬜ BPO subsystem (confirmed 0 live rows, safe/low-risk): `src/lib/bpo/capability-to-skill.ts` (the
  ONE canonical 2K-capability↔skill bridge, its own doc comment says "do not duplicate this map
  elsewhere" — under the new design this becomes fully self-consistent for the first time: GRM→grammar,
  INT→live_interaction, VOC→business_vocabulary unchanged, no code for "writing" since 2K's 6-letter
  model doesn't have one, matching Daniel's own "writing is a separate modality" framing),
  `src/lib/bpo/intelligence.ts` + `src/lib/bpo/delta-report.ts` (delete their duplicate local
  `SKILL_KEYS` arrays, import the canonical one instead — per Dennis's framing, BPO was never supposed
  to be a second taxonomy, it's "the same one-person shape, scaled to many people with richer inputs"),
  `src/lib/bpo/edge.ts` (example construct list in a comment/data literal).
- ⬜ `src/lib/scoring/session-rubric.ts` — the live-CLASS scoring rubric (separate from discovery).
  Same restructure as the main rubric: needs its own Grammar/Live Interaction nullable sections added,
  old-key fields renamed. Currently unwired to the live demo (no ClassIn data flows in yet, per HLD
  §5.2) but worth doing in the same pass for consistency.
- ⬜ Seed/test data, lower priority, cosmetic: `src/lib/employer/seed-demo.ts`, `src/lib/seed/abc-personas.ts`
  (hardcoded baseline/score/evidence literals under old keys — these feed demo/QA accounts only).
- ⬜ `src/lib/employer/role-discovery/schema.ts` — AI prompt text mentioning `presentation_delivery`
  by name, needs updating to reflect the supporting-measure framing.
- **Confirmed NEEDING ZERO CHANGES** (already `SkillKey`-generic, will just work once rubric.ts's type
  changes): `src/lib/scoring/baselines.ts`, `src/lib/employer/roles-data.ts`,
  `src/lib/tracktest/eligibility.ts` — TypeScript will catch these as safe automatically.

**Found but OUT OF SCOPE for this migration** (a pre-existing, unrelated bug, noted so it isn't lost):
`src/lib/tracktest/eligibility.ts`'s `FLOORS` (`B1:40, B2:60, C1:80`) are on the OLD 0–100 scale — the
codebase moved to 0–1000 in migration `0011` and this file was never updated. On the current 0–1000
scale these floors are far too low (any real score clears them), meaning TrackTest exam-eligibility
is probably always reporting "ready" regardless of actual level. Not touched this session — flag for
its own fix.

### New issues raised mid-session (ISS-064, ISS-065) — scoped as Phase 8, not yet started
Dennis clarified the discovery→battery→plan flow is a **free self-assessment / lead-gen step**, not
the live enrolled product — Stephen Munich and Shamini both expected an email and were confused
there wasn't a clear next step. The generated programme is a **sample/preview**, not active or
executed. Three surfaces need reframing once Phase 2 lands: (1) `/plan` page's "commitment" section
— currently asks the student to "commit to following the programme," should instead present it as a
sample with a **"Book a call"** CTA; (2) `compilePlanPrompt()` in `plan-delivery.ts` — Aria's voice
script literally instructs her to "get a genuine commitment," needs to become "this is a sample —
next step is a call with the team"; (3) a new completion email (folding in ISS-064) needs to fire at
`/plan` completion, explicitly labeled non-active, with the same Book-a-Call CTA. **Open question for
Dennis, not yet answered**: does "Book a call" need to branch by audience (individual self-assessor
vs. someone evaluating on behalf of a BPO/call-centre), or is one generic CTA fine? See
`docs/ISSUES_TRACKER.md` Phase 10 and `docs/ISSUE_LOG.md` for the full reasoning trail.

### Next session should
1. Finish rewriting `SYSTEM_PROMPT` in `rubric.ts` (the drafted Grammar/Live Interaction sections
   above are ready to paste in).
2. Work through the ⬜ file list above in order — TypeScript compile errors will catch most
   `Record<SkillKey,...>` mismatches automatically once `rubric.ts`'s type changes propagate.
3. Rewrite `0058_backfill_skill_taxonomy_renames.sql` per the corrected design (4 renames only, no
   `is_canonical` touch) — do NOT push the version currently on disk.
4. Run `npx tsc --noEmit` clean before considering the cutover code-complete.
5. Commit, push to both remotes, wait for Vercel deploy, then push the rewritten 0058 migration
   immediately after — per the sequencing constraint above.
6. Re-assess Daniel/Shamini/Thao/Stephen (fresh discovery/battery run each) once grammar/live_interaction
   are live, since there's no historical data for those two dimensions.
7. Then Phase 3 (telemetry/radar UI) → Phase 4 (org setup + magic-link) → Phase 5 (Aria prompt) →
   Phase 6 (copy fixes) → Phase 7 (Daniel sign-off walkthrough) → Phase 8 (sales-funnel reframing,
   ISS-064/065) per the approved build plan.

## Session log — 2026-09-21 (sandbox testing feedback triaged: ISS-047–063 logged)

- **Processed the untracked feedback drop** `docs/lingopure feedback folder 20092026/` (added
  2026-09-20, sitting unread since the prior close-out): `LingoPure_Sandbox_Testing_Feedback.docx`
  (Daniel Maneveld's formal review), 9 screenshots (Daniel + Shamini), 2 reference HTML files + 3
  reference infographics (Dan's own LP-18 spec material, not sandbox bugs), and a voice memo from
  Thao (transcribed via OpenAI Whisper — `openai.audio.transcriptions`, `whisper-1`).
- **17 new issues logged, `ISS-047`–`ISS-063`, in `docs/ISSUES_TRACKER.md` Phase 9** — none scoped
  or actioned yet, this session is scoping only. Highlights:
  - **ISS-047 (CRITICAL)**: Dashboard shows overall B2.3, My Programme shows B1, from the *same*
    six `gap_scores`. Both pages must trace to one canonical saved result.
  - **ISS-048 (CRITICAL)**: Sandbox's six capability dimensions (Speaking/Listening/Writing/Reading
    intent/Vocabulary/Presenting) don't match Daniel's reference framework (Reading/Writing/
    Speaking/Grammar/Listening/Live Interaction) — the exact "competing dimension lists" gap LLD §1
    already flagged as legacy, now hit live by an external reviewer.
  - **ISS-049 (CRITICAL)**: Org setup throws a raw `organisations_slug_key` Postgres error to the
    user when the slug already exists (repro: company name "prelabz"); needs a real
    join-existing-org flow, not just error-message polish.
  - **ISS-050 (HIGH)**: Target badge shows C2.1 vs C1 elsewhere on the same profile.
  - **ISS-051 (HIGH)**: Shamini hit "Email link is invalid or has expired" on magic-link login —
    live auth-flow break, needs repro against current Supabase redirect/token config.
  - **ISS-052 (HIGH)**: No live/interim transcript during the discovery call, only completed turns
    — need to establish whether ConvAI/STT even emits partial transcripts here.
  - **ISS-053/054 (MED, Thao)**: Aria re-asks an already-answered question (role/responsibility);
    should also mirror the student's sentence complexity. ISS-053 needs checking against the
    *currently live* prompt — may be stale from before the 2026-09-19 `125beb7` rewrite.
  - Remaining MED/LOW/VERIFY items (ISS-055–063): role drift, CEFR-18 not carried into Programme,
    role-gap vs target-gap conflation, missing-evidence-as-zero, the 12 Live-Interaction telemetry
    signals not exposed individually, copy/label bugs, and a Daniel-requested live evidence-chain
    demo that gates his sign-off.
- **New file `docs/ISSUE_LOG.md`** — per-issue audit trail (raised/source/description/status/action
  taken/resolved), separate from `ISSUES_TRACKER.md`'s phase-checklist format. Seeded with all 17
  new issues; update its Action Taken + Resolved columns as each is worked, going forward.
- **The feedback folder itself is still untracked in git** (`docs/lingopure feedback folder
  20092026/`) — a decision on whether to commit it (it contains a voice memo + WhatsApp screenshots)
  has not been made; left as-is pending user call.
- **NEXT**: scope ISS-047–063 into a build plan this session (severities are a triage starting
  point, not final).

## Session log — 2026-09-19 (close-out: docs reconciled, brand spelling fixed)

- **Docs reconciled to current state** (commit `7005565`): HLD/LLD/WOW scope/FUNCTIONALITY_WORKFLOWS/integration-status/ISSUES_TRACKER all now reflect the 2026-09-19 reality — plan delivery live, battery→/plan redirect, baseline scale LP-18 0-1000, live deploy = `purelingo-app-sandbox.vercel.app` (Supabase `uovbwccvxgdghqvlpuql`), ISS-043/44/45 closed.
- **Brand spelling fixed**: all "Lingo Pyoor" (TTS respell workaround) removed from written output — prompt, 11 localized first-message strings, QA sim. Written form is ALWAYS `LingoPure`; speech sound stays "LIN-go PYOOR" via prompt instruction. Live agent re-provisioned, QA sim PASS.
- **Diag scripts cleaned**: removed 8 throwaway `diag-*`/`fix-scaled.mts`/`replay-batch.mts` scripts from `scripts/`.
- **OUTSTANDING for next session**: (1) live plan-agent call to re-confirm `plan_status` flip end-to-end (JWT fix deployed but not re-smoked); (2) confirm Supabase region of `uovbwccvxgdghqvlpuql`; (3) optional — TTS re-check if "LingoPure" mispronounces in non-English carrier sentences.

## Session log — 2026-09-19 (plan voice delivery + baseline scale fix + discovery agent hardening)

- **Plan programme shipped** (commits `1c767f3`–`0a4492e`): `buildPlan` generates 3-phase 16-week programme; `/plan` page = on-screen scores + Aria voice walkthrough + commitment capture; `/api/plan/delivery` + `/api/plan/session` routes; dashboard CTA; battery auto-redirects to `/plan` after submit.
- **Aria discovery prompt rewrite** (commit `125beb7`): internal reasoning moved into `<instruction>` blocks (never spoken); Dimension 2 = 3 true turns (consent → email+question → acknowledge); one message per turn; `end_call` tool enabled on live agent; runtime 1200s → 7200s. LIVE on ElevenLabs agent `agent_8701m2eyrep6exysepd25r16msst`.
- **Baseline scale bug fixed** (commits `e859814`/`02bb027`/`b93386d`): `role_baselines` + `gap_scores.target` + `self-setup.tsx` seeds were 0-100 scale, violated LP18 0-1000. Rescaled all ×10 (66 role_baselines rows, 19 gap_scores rows live). This was the "Gap vs role baseline: 0" bug.
  - ⚠️ **BREAKAGE CAUSED + FIXED this session**: the ×10 rescale broke self-setup submit (API validation was `max(100)` → now `max(1000)`) AND BaselineRow bar width (`width: ${score}%` → 600% overflow → now `score/10`). Both fixed, pushed `02bb027`/`b93386d`.
- **Plan webhook JWT-as-UUID fix** (`e859814`): `handlePlanAgentPostCall` used raw anon-session JWT as `student_id` → `invalid input syntax for type uuid`. Now `verifyAnonSessionToken` first, mirroring discovery path.
- **Battery scorer evidence truncation** (`68aa566`): `evidence z.string().max(600)` → `max(2000).transform(s => s.slice(0,600))`. Score 614 was computed but dropped when LLM evidence exceeded 600.
- **Script ESM/CJS fix** (`d99f3c9`): `@caistech/elevenlabs-convai` only exports `import` condition. Scripts stay `.ts`; `update-discovery-prompt.ts` imports via direct `dist/index.js` path; run with `node --import tsx`.
- **Live data**: transcript for discovery conv `conv_5901m2vww36wf7kt6pypkhwrtd6j` replayed (43 msgs) — was transient cold-start persist failure, not schema. Marked `processed_at`.
- **STILL OPEN — user flagged, not yet root-caused**: "email test reverted to 8 words (target 120–220)". Live DB `discovery_task_prompts` email_writing rows have `target_word_count: {min:120, max:220}` (correct, 2 rows). Battery submit gate = `wordCount < 30`. The "8 words" may be from the email-sprint lesson generator (`email-sprint-runner.tsx` shows `{wordCount}/{expected_word_count}`) — expected_word_count schema is `min(40).max(250)`. NOT RESOLVED — needs user clarification on which screen shows 8.
  - ✅ **RESOLVED 2026-09-19**: NOT a bug. `battery-runner.tsx:615` renders `{wordCount} words (target {min}–{max})` — the "8" was the user's LIVE tally (8 words typed); the target range 120–220 was correct. Submit stays disabled until `wordCount >= 30`. No code change needed.

## Session log — 2026-09-16 (env cleanup → CONVAI_TOOL_SECRET → auth redirects → Vercel env)

- **`.env.local` cleanup**: removed all unused `LINGOPUREAI_*` / `LINGOPURE_*` entries (dead dups, wrong key formats, DB password, Postgres conn string). Final 18-line file. `.env.local` is gitignored (confirmed).
- **New Supabase key system**: project `uovbwccvxgdghqvlpuql` (LingoPure Sandbox) uses `sb_publishable_*` / `sb_secret_*` keys. Mapping: `sb_publishable_*` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `sb_secret_*` → `SUPABASE_SERVICE_ROLE_KEY`. Both rotated after being exposed in session.
- **CONVAI_TOOL_SECRET** added to `.env.local`, `.env.example`, and `scripts/provision-discovery-agent.ts` (bakes secret into agent tools via `createConversationTools`). Fixes `[convai] SECURITY` build warning.
- **Canonical domain decision**: the LIVE app is `https://purelingo-app-sandbox.vercel.app` (Vercel project `purelingo-app-sandbox`, team `dev-lingo-pure`). The old `https://lingo-pure-ai.vercel.app` is a STALE project (Corporate AI Solutions team) running old middleware + old Supabase ref — that's the source of the 504s; do NOT use it.
- **Auth redirect fix**: Supabase Dashboard → Auth → URL Configuration → Site URL must be `https://purelingo-app-sandbox.vercel.app`, redirect URLs include `/auth/callback`, `localhost:3000`, `localhost:3000/**`. (Dashboard-only — Supabase CLI lacks privileges on this project.)
- **Middleware hardening** (`src/lib/supabase/middleware.ts`): skip `getUser()` network call when no auth cookie exists; fail OPEN on network error. Prevents a Supabase connectivity blip from 504ing the whole app.
- **Vercel env vars**: added via dashboard (Production+Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CONVAI_TOOL_SECRET`, `ELEVENLABS_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL=https://purelingo-app-sandbox.vercel.app/`.
- **CLI lessons**: `vercel link` fails (multiple teams, project-name validation loop); `vercel env add` needs linked project. Supabase CLI link fails ("account does not have necessary privileges") — use Dashboard instead.
- **Open**: after deploying this commit, in the Supabase dashboard set Site URL + redirects to the sandbox domain, then confirm signup confirmation link lands on `purelingo-app-sandbox.vercel.app` (not localhost, not the old domain).

## Session log — 2026-09-16 (Vercel deployment wiring, waiting on Thao for Supabase keys)

- Wired repo to Vercel project `purelingo-app-sandbox` (team `lingopure-cloud`).
- Pushed empty trigger commit `c8538a0` to `lingopure/main` to fire Vercel build.
- Build succeeded after adding `NODE_AUTH_TOKEN` env var (fixes `@caistech/*` private package install).
- **Blocked:** Missing Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) because Thao has not yet approved entry into the lingopure sandbox Supabase project.
- Once keys are available, will paste them into Vercel dashboard → Settings → Environment Variables (Production + Preview) and redeploy.

## Session log — 2026-09-16 (C7 completion: auth+RLS wiring, report-context security fix, docs snapshot)

- **C7 is DONE** — commit `23236ae` (both remotes): all portals gated (admin/org/teacher/employer), `0049` classin read RLS, **`0050` report-context security fix**, org-RLS harness now runnable + PASSING, role-matrix e2e + ROLE_MATRIX DB grid, responsive pass on C5/C6. Follow-up `c7e2efc`: employer roles table `overflow-hidden` → `overflow-x-auto`.
- **The C7 harness caught a real cross-org leak**: `teacher_report_context` (`0040`, SECURITY DEFINER) returned the target student's full identity (organisation_name, primary_teacher, name/level/language/employer_id) to ANY caller who knew a student uuid. `0050` gates every target-derived field on `can_view` + `jsonb_strip_nulls`. Root cause of the confusing assert: `jsonb_build_object('key', null)` emits a JSON `null` literal, and `r->'key' IS NOT NULL` is TRUE for a jsonb null — stripping the keys is what actually removes them.
- **Full QA pass (autonomous)** — one responsive bug found + fixed (`/employer/roles` table clipped mobile; now scrolls). All C0–C7 features live-checked.
- **Docs snapshot to current state** — `docs/HLD.md` + `docs/LLD.md` both brought to 2026-09-16: 50 migrations (`0001`–`0050`, was 25), role contexts now incl. org memberships + teachers + platform admins, C0–C7 feature blocks added to LLD (curriculum engine, org model, onboarding wizard, platform/org/teacher portals), deployment blocker documented (§7).
- **Deployment blocker (prodn)**: Thao hasn't created the Vercel team/project yet — production cannot deploy until then. Once live: push `main`, set envs in Vercel dashboard (sensitive-env-var rule: never commit), re-run `test:org:db` against live schema, mint a fresh `VERCEL_OIDC_TOKEN`. Local `nickname` is `lingo-pure-ai` (`vercel.json` has 3 crons: nudges, hr holiday-notice, 2k-retention).

### Session log — 2026-09-16 (C2 completion: evidence packets + responsive text pass)
- **Commit `4b4b6dd`** — escape apostrophe in `add-client-org.tsx` success copy (pre-existing JSX lint fix).
- **A1 journey evidence panel wired to real `buildEvidencePackets`** — replaced the telemetry-dims-based "Behavioural evidence" section with real evidence packets from `buildEvidencePackets(latest.analyses)`. Top 3 OBSERVED packets sorted by confidence+quality. Removed now-unused `highDims` variable.
- **Responsive text pass: all sub-12px CSS/JSX bumped to 12px minimum** — `telemetry.css` (eyebrow 10→12, pill 11→12, score-inner label 9→12, metric span 10→12, journey .when 9→12, journey .why 10→12, evidence .source 9→12, evidence p 11→12, evidence .change 11→12, timeline .tag 8→12). `learner-notes.tsx` (alert 11→12, empty-state 11→12, date 10→12). `radar.tsx` label `fontSize` 10.5→12. All three telemetry pages already had JSX-level sub-12px fixed in ac4ebd7; this pass covers the CSS and component layers.
- **`@caistech/discovery-agent`** already in `package.json` (`^0.1.0`) and wired: `DiscoverySession` client component in `onboarding/discovery-session.tsx`, `aria-discovery-config.ts` + `aria-discovery.ts` server-side, webhook route at `api/onboarding/discovery/webhooks/[all]`. Provision script at `scripts/provision-discovery-agent.ts`. §11 lock 4 voice surface is code-complete; live binding blocked on Thao promoting Dennis to ElevenLabs Admin (orphaned agent `agent_8701m2eyrep6exysepd25r16msst` needs webhook binding).
- **C2 is now COMPLETE.** All three telemetry pages (A1/A2/A3) render real engine data, responsive text floor enforced at 12px, evidence packets wired, A3 §7 org wiring done (teacher_report_context + relationship mapping from 77aecd4).

---

## Session log — 2026-09-14 late (LingoPure account swap: ElevenLabs + Resend)

### ElevenLabs — LingoPure workspace swap
- **`LINGOPURE_ELEVENLABS_API_KEY`** (`sk_752f3a...`) in `.env.development.local`; same value now set as `ELEVENLABS_API_KEY` in both `.env.local` + `.env.development.local`. Old buildtech key removed.
- **Seat:** Dennis (`mcmdennis@gmail.com`) is `workspace_lite_member` in the LingoPure ElevenLabs workspace — **cannot manage webhooks** (`403 webhooks_manage`).
- **Orphaned agent:** `agent_8701m2eyrep6exysepd25r16msst` ("LingoPure Discovery Agent") exists in the workspace, created by Dennis, but webhook **not bound**.
- **Blocker:** Thao must promote Dennis to **Admin** in ElevenLabs team settings (or create a new API key as owner). Then re-run provisioning with `existingAgentId: agent_8701m2eyrep6exysepd25r16msst`.
- **Re-provision command** (after role fix): load `.env.local` into env → `node --import tsx scripts/provision-discovery-agent.ts`. The `node --import tsx` is mandatory; see packaging bug below.
- Morgan (`NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID`) blanked + pending same resolution.

### `@caistech/elevenlabs-convai@0.9.0` packaging bug
- **`ERR_PACKAGE_PATH_NOT_EXPORTED`** when tsx resolves the package in CJS mode. Root: `exports` map has only `import`/`types` conditions — no `default`/`require` fallback.
- **Local fix:** added `"default": "./dist/index.js"` to all three export paths in `node_modules/@caistech/elevenlabs-convai/package.json`. Not durable (node_modules).
- **Canonical fix:** needs `cais-shared-services/packages/elevenlabs-convai/package.json` — add `"default"` to exports, bump version, reinstall.

### Resend — LingoPure key + domain swap
- **`RESEND_API_KEY`** swapped to LingoPure key (`re_XTq...`) in both env files; verified valid.
- **All 6 from-addresses flipped** from `noreply@updates.corporateaisolutions.com` → `noreply@lingopure.com` (5 `src/lib/email/*.ts` files + `src/lib/hr/email/send.ts` DEFAULT_FROM).
- **Config/docs updated:** `supabase/config.toml`, `.env.example`, `docs/TEST_PROTOCOL.md`.
- **Blocker:** applingopure Resend team has **zero verified domains** — Thao must verify `lingopure.com` in Resend (add domain → DNS records).

---

## Session log — 2026-09-14 (battery report email, marketing i18n toggle, OmniRoute fix, test docs)
- **Battery-complete report email** (`af828c1`) — migration 0048 (`students.battery_report_sent_at`), `src/lib/emails/battery-report.ts`, `src/lib/scoring/lp18.ts`, trigger `battery_report_on_complete`. Fires once when all 4 battery tasks complete (4-skill completeness + `sent_at` guard). Email: personalised name + target, overall LP-18 band + 6 skill bars, "Book a demo" CTA to `/book-a-demo`. Resend transport, no-reply from address, HTML + text fallback. Taste → report → demo bridge.
- **Marketing i18n — functional EN/VI toggle** (`71c66b2`, pushed both remotes). `src/lib/i18n/dictionary.ts` rebuilt to prod-aligned copy: **67 EN + 67 VI `mkt.*` keys, full parity**, per-section granularity. New: `src/components/marketing/i18n-context.tsx` (client `t()` with EN fallback, cookie `lp_lang`), `src/components/marketing/promo-copy.ts` (server-safe `MarketingHomeCopy` resolver). `Nav.tsx` consumes context + `LanguagePill` (cookie toggle via `/api/i18n/lang`, `router.refresh`). `Footer.tsx` server-side `getDict()`. `HomeView.tsx` + homepage + preview render `lang`. **Verified live:** `lp_lang=vi` → `<html lang="vi">` + VI hero/nav/footer, EN h1 gone; default → EN → `lang="en"`. Font note: Lato lacks `vietnamese` subset in this Next version — VI body diacritics fall back to system; Montserrat + JetBrains Mono carry VI subsets. Landing pages (`/for-companies`, `/for-individuals`, `/method`) keep nav/footer translated; body copy EN until content validated.
- **OmniRoute `lingopure-ai` combo 500 root-caused** — the `POST /api/lessons/[id]/submit` 500 was **not** app code: env routes Claude via `ANTHROPIC_BASE_URL=http://localhost:20128/v1` (OmniRoute bridge, model `lingopure-ai`). App error `401 "Missing API key" / invalid_api_key` was **DeepSeek's verbatim schema** (primary step rejecting in 193ms). Combo test proved it: DeepSeek error → Gemini fallback OK (7838ms). Fix is in OmniRoute dashboard (DeepSeek account key `acct f263b66c`, or promote Gemini to primary). Logged in bug knowledge base via Mnemo `bug-memory.mjs remember`. HLD.md:197 documents the bridge as optional.
- **Test protocol + functionality docs** (`b0c020d`, pushed both remotes) — `docs/TEST_PROTOCOL.md` + `.docx`, `docs/FUNCTIONALITY_WORKFLOWS.md` + `.docx`, generator `scripts/generate-docs.mjs` (`docx` npm package, devDependency). Audience: Thao, Dan, Shamni. Test protocol = 10 sections, tick-box checklists (Student/Employer/Investor/Marketing/Assessment/Email/Mobile), bug-report format, sign-off sheet. Functionality doc = exec summary + architecture + 3 packages + 6 portals page-by-page + assessment/scoring + integrations + role-matrix/env/db appendices. Regenerate .docx with `node scripts/generate-docs.mjs`.

## Session log — 2026-09-13 (landing palette, LP-18 dashboard telemetry, discovery-agent split)
- **Landing palette synced to live lingopure.com brand tokens** (`src/app/(marketing)/marketing.css`, commit `d6fe9e1`). Extracted the real palette from the live site's compiled CSS: warm cream bg `#f8f5ec` / card `#fffdf7` / ink `#151617` / muted `#6e777d` / border `#d8d2c4` / **amber accent `#fbae17`** (this is the "yellow" Dennis perceived, not the teal/green from the old remap). Dark (internal/portals) variant: surface `#181914`, text `#f7f5ed`, gold `#ffba3e`.
- **LP-18 CEFR telemetry surfaced on student dashboard** (`src/lib/scoring/rubric.ts` + `src/app/(app)/dashboard/page.tsx`, commit `b54e273`). Added `scoreToLp18()` (18 micro-bands across the 0–1000 scale: A1.1→C2.3) and now render `score · LP-18 · CEFR` on each ScoreBar + LP-18 on the Now/Target badges. The granular LLM scoring is the thing that supersedes the old single-number scoring; display now matches.
- **`aria-discovery` split client-safe vs server-only** (`aria-discovery-config.ts` + `aria-discovery.ts`, commit `5926438`) — fixing the `supabaseKey is required` runtime error. Client widget imports **config only**; service-role Supabase client + ElevenLabs deps live behind `import "server-only"` (added `server-only` dep). Security: the service key never reaches a client bundle.
- **Session route hardened + agent id wired** (`e94974e`). `startSession()` was throwing (`existingAgentId` never passed) and the route returned an empty 500 that the client couldn't `.json()`. Now `aria-discovery.ts` passes `ELEVENLABS_AGENT_ID`, the route returns JSON errors, and `DiscoverySession` surfaces them.
- **Deferred to Minh (live-config blocker):** at `localhost` the Aria livekit call joins, then the ElevenLabs agent errors (`Cannot read properties of undefined (reading 'error_type')` — vendor SDK crash after the agent's error frame). Diagnosis: agent was provisioned against the **prod app URL/allowlist**, so `npm run dev` isn't the right host to test the live voice path. The working list is: `ELEVENLABS_AGENT_ID` (set), `ELEVENLABS_WEBHOOK_SECRET`, live Supabase (current project paused), Vercel reconnect → then production smoke test, not localhost. Sandbox remains valid for everything except live voice.

## Build sequence (C0–C7) and current position

| Step | Status | Delivered |
|---|---|---|
| **C0. Curriculum Engine** | DONE | `suppabase/migrations/0037_curriculum_engine.sql` (curricula, curriculum_lessons, lesson_completions, tutor_feedback, curriculum_resets, all RLS + append-only triggers) · `src/lib/curriculum/curriculum-engine.ts` (CUR-ENGINE-v1.0.0, deterministic skill-gap/plan/reset) · `tests/curriculum/curriculum-engine.test.ts` (10/10 pass via `npm run test:curriculum`) |
| **C1. Org model (additive)** | DONE | `suppabase/migrations/0038_org_model_additive.sql` (organisations, organisation_memberships, organisation_departments, platform_admins; `current_org_role`, `org_is_owner_or_hr`, `org_employer_id`, `org_can_view_student`, `dept_can_view_student` SECURITY DEFINER; RLS per table). FK fix applied (teachers.id). Org RLS DB-verify: `tests/org/org-rls-verify.sql` + `scripts/org-db-verify.sh` — **9/9 assertions PASS** (`npm run test:org:db`). |
| **C1. platform_admins bootstrap** | DONE | `src/lib/platform-admin.ts` canonical gate (ADMIN_EMAILS first-time sync, table owns after) · `scripts/seed-platform-admins.ts` idempotent bootstrap (`npm run admin:seed-platform`) |
| **C2. Dan dashboards → React** | DONE | `e068562` — telemetry kit + A1/A2/A3 (see below) |
| **C3. Org onboarding wizard** | DONE | `src/lib/org/service.ts` (createOrganisation, selectPackage, setDepartments, allocateStaff, assignTeachers, advanceBaseline, advanceCurriculumAndComplete) · `src/components/org/onboarding/wizard.tsx` (7-step wizard: Package → Departments → Staff → Teachers → Baseline → Curriculum → Done) · `src/app/api/org/[orgId]/onboarding/route.ts` (GET bundle + POST 6 actions) · `src/lib/org/onboarding.ts` (state machine + SERVICE_PACKAGES + PACKAGE_DEPARTMENTS) · tests/org/onboarding-service.test.ts (3/3 pass) |
| **C4. Platform admin console** | DONE | `/admin` gated by `platform_admins` (layout.tsx fail-closed `isPlatformAdmin`) · overview (org directory + subscription + onboarding KPIs) · onboarding (live directory + AddClientOrg → `/api/admin/orgs` creates organisations + org_onboarding + subscriptions) · billing (live table + MRR) · content (now renders the marketing ContentEditorClient via new `loadEditorBlocks` in resolve.ts — was orphaned) · demo-bookings · audit · editors · testimonials · logos · `src/lib/platform/directory.ts` + `auth.ts` · role-matrix e2e covers `/admin` denial · tests/org/content-editor.test.ts (3/3 pass) |
| **C5. Org admin portal** | DONE | `/org/[slug]` layout (nav-branded, role pill, mobile nav, `getOrgIdentity`) · overview + departments + billing (functional from earlier pass) · **staff/students/teachers pages rebuilt from JSON dumps → real gated tables** (owner/hr/teacher list-only per ROLE_MATRIX) · **settings page NEW** (org identity + owners/HR admins + subscription; owner/hr-only) · `loadOrgSettings` in portal-data · NAV + quick-links gain Settings for owner/hr · ROLE_MATRIX doc updated with settings row · tests/org/org-portal-gates.test.ts (7/7 pass: role gates + fail-closed + settings loader) |
| **C6. Teacher portal** | DONE | `/teacher` layout (nav-branded, role pill, mobile nav, getTeacherIdentity gate) · **dashboard rebuilt from bare list → stat cards (students/assessments/upcoming/avg LP1000) + roster table + upcoming classes + recent notes** · **student detail rebuilt → real surface (progress stat cards + ClassIn history table + notes), JSON dump removed** · **classes loaders NEW** (`loadTeacherClasses`, `loadStudentClasses` in teacher/portal-data) + **migration 0049** granting `classin_sessions` org/teacher read (`org_can_view_student`, 0045 pattern — was student self-only) · notes page + composer + LP1000 report page (pre-existing, production) · `loadTeacherNotes` gained optional `studentId` scope · tests/teacher/portal-data.test.ts (8/8 pass) |
| **C7. Wire auth + RLS + responsive + tests** | DONE | **All portals gated** — `/admin` (platform_admins), `/org/[slug]` (getOrgIdentity/requireOrgRole), `/teacher` (getTeacherIdentity), `/employer` (employer_admins) fail-closed layouts · **RLS per org** extended: `0049_classin_org_view.sql` (classin_sessions org/teacher read via `org_can_view_student`, was student self-only) + **`0050_teacher_report_context_gate.sql`** — SECURITY FIX: `teacher_report_context` (0040) leaked target student identity (`organisation_name`, `primary_teacher`, name/level/language/employer_id) to ANY caller who knew the uuid; now gates every target-derived field on `can_view` + `jsonb_strip_nulls` so denied viewers get zero identity keys · **org-rls harness extended** to apply 0004/0049/0050 + classin grid rows per role + learner-self classin/notes — `npm run test:org:db` **PASSES** (was un-runnable pre-Docker; cast up a latent FAIL that 0050 fixes) · **role-matrix**: 06 spec now bounces student off `/employer` too; ROLE_MATRIX DB grid adds `teacher_notes` + `classin_sessions` columns · **responsive pass** on C5/C6 surfaces (2→4 stat cols, stacked→3-col layouts, overflow-x-auto tables) · tsc/lint clean, 55/55 unit tests |

## Key decisions locked (§11 of scope doc)
- Kira org pattern ADDITIVE (no rename, no `persons` table — memberships anchor `auth.users.id`)
- No C0-less dashboards — dynamic reset is the product spine
- Voice = DiscoveryWidget on discovery/onboarding only; classroom voices bespoke
- Billing display-only (synthetic `subscriptions`), departments fixed-nominated set, `platform_admins` canonical with ADMIN_EMAILS bootstrap
- **C2 visual direction: faithful dark telemetry** (Dan's #071019 + cyan/orange/green accents) rendered as dark panels inside the existing (app) light chrome — confirmed by owner 2026-09-12; scoped classes only (`text-t-*` / `.t-card` etc.), never global.

## C2 telemetry pages (committed e068562)
- `src/components/telemetry/telemetry.css` — scoped dark theme; token utilities added to `globals.css` `@theme` (`--color-t-*` → `text-t-*/bg-t-*/border-t-*`).
- `src/components/telemetry/score-ring.tsx`, `radar.tsx` — server-safe SVG (no client deps), dark palette.
- `src/components/telemetry/learner-notes.tsx` — client widget over `learner_notes` (migration 0039).
- `src/lib/2k/journey-data.ts` — `listCompletedAssessments` / `loadResultHistory` / `loadLatestPipeline`; single data path via `loadPipelineResult`.
- **A1** `(app)/dashboard/journey` — LP-1000 ring, narrative state, one-improvement next action, 4D timeline + band-climb journey grid, radar, behavioural evidence, three multi-impact focus behaviours, drift alerts, timing-aware recommendation, streak/XP, My notes. Linked from `/dashboard` (Journey view CTA) when the learner has scores.
- **A2** `(app)/assessment/results/[id]` — Section 1 where-you-stand / 2 what-holds-score-back (telemetry + diagnosis + contradictions) / 3 how-to-reach-next. Linked from the assessment-result phase (`assessment-runner.tsx`).
- **A3** `(app)/teacher/students/[id]/report` — 1 assessment run / 2 12D telemetry+trajectory / 3 diagnosis & recommendation / 4 decision trace / 5 audit·lineage·snapshot. `org_can_view_student` gate + self-view fallback.
- C2 todo: C1-additional — A3 deeper §7 org wiring (teacher→student assignment link, not just `org_can_view_student`), responsive QA on the three pages, evidence-packet panel using real `buildEvidencePackets` output.

## Notes / gotchas
- `0014` teachers PK is `id` (not `teacher_id`) — 0037 uses `teachers(id)`.
- 2K result renders inline in `assessment-runner.tsx`; the dedicated result page (`/assessment/results/[id]`) now exists and is linked from the result phase.
- `@caistech/discovery-agent` NOT yet in package.json — add when wiring voice (C2 discovery surface, §11 lock 4).
- **LLM env split:** `.env.local` = sandbox Supabase (`uovbwccvxgdghqvlpuql`, prod-bound); `.env.development.local` = local Supabase (`localhost:54321`) + `ANTHROPIC_BASE_URL=http://localhost:20128/v1` (OmniRoute bridge, combos by account acct-IDs). Unset base URL → traffic goes straight to Anthropic.
- **Lesson submit 500 signature:** error body `"Missing API key"` with `code: invalid_api_key` is a provider above the bridge rejecting (193ms fast-fail), not the gateway and not app code. Check the combo step authz first.
- **Admin testing account:** `dennis@factory2key.com.au` / `Logoinabc123` (ABC Manufacturer org admin persona, `src/lib/seed/abc-personas.ts`).
- **Pushed commits:** `af828c1` battery-report email, `71c66b2` i18n toggle, `b0c020d` docs — all on `origin` + `lingopure`. No push key needed (already authenticated).
- Two untracked PNGs remain in `docs/` from prior screenshot work (`Lingopurelanding screenshot.png`, `lingopureinternalphoebe.png`) — deliberately uncommitted.

## Environment
- Win32 / PowerShell 7 shell. Tests: `npm run test:curriculum` (node:test + tsx; `@/` path alias resolves).
- Unrelated pre-existing changes in tree: `src/middleware.ts` → `src/proxy.ts` migration in flight (Next 16), `tree.py`, BPO gate fixtures.
- One WIP stash remains: `stash@{0}` "WIP from prior session: demo banner + prod site_url + auth/callback route" — but it actually contains only a `@caistech/elevenlabs-convai` 0.1.4→0.1.5 bump (label is misleading). Drop or keep as is; not needed for the current build.
- `.env.local` (sandbox): VERCEL_OIDC_TOKEN, RESEND_API_KEY (LingoPure `re_XTq...`), OPENAI_API_KEY, ANTHROPIC_API_KEY, both Supabase keys, ELEVENLABS_API_KEY (LingoPure `sk_752f3a...`), ELEVENLABS_AGENT_ID (blank — orphaned `agent_8701m2eyrep6exysepd25r16msst` needs binding), ELEVENLABS_WEBHOOK_SECRET (blank), EMPLOYER_DEMO_PASSWORD, HEYGEN_API_KEY, SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID (blank), LINGOPURE_RESEND_API_KEY, LINGOPURE_ELEVENLABS_API_KEY.
- `.env.development.local` (local dev): local Supabase (`localhost:54321`), same LingoPure keys as above, ANTHROPIC_BASE_URL/module pointing at OmniRoute bridge on localhost:20128, CONVAI_TOOL_SECRET, LINGOPURE_LINGOPURE_SANDBOX_* vars.