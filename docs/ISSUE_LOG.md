# LingoPure — Issue Log (audit trail)

Companion to `docs/ISSUES_TRACKER.md`. That file is a **build-phase checklist** (what's done,
grouped by phase). This file is a **per-issue audit trail**: when an issue was raised, who raised
it, what was done about it, and when it closed. Never delete a row — closed issues stay for
history.

## How to use

- **New issue** → append a row: `ISS#`, `Raised` (date the feedback was given, not the date you
  logged it), `Source`, one-line `Description`, `Status`, blank `Action Taken` / `Resolved`.
- **Work starts** → set `Status` to `In progress`, fill `Action Taken` with what you're doing.
- **Work finishes** → set `Status` to `Resolved`/`Closed`/`Won't fix` (with reason), fill
  `Resolved` with the date + commit hash.
- **Cross-reference** the matching `ISS-###` checkbox in `ISSUES_TRACKER.md` — keep both in sync;
  this file has the narrative, that file has the phase/build-sequence position.

---

## Log

| ISS# | Raised | Source | Description | Status | Action Taken | Resolved |
|---|---|---|---|---|---|---|
| ISS-047 | 2026-09-20 | Daniel Maneveld — `LingoPure_Sandbox_Testing_Feedback.docx` §04 | Dashboard shows overall B2.3, My Programme shows B1, from the same six `gap_scores` rows | Resolved (code; live verification pending) | Root cause: the two pages computed the overall band two different ways — `/plan` averaged live `gap_scores`, Dashboard partly read the frozen `discovery_sessions.profile_json` snapshot. `678ea53` made both read the SAME live `gap_scores` rows through the SAME `scoreToCefrBand`/`scoreToLp18` functions in `rubric.ts` (now documented there as the one place that conversion happens); Dashboard's `profile.overall_cefr` is now only a fallback for the zero-scores case, never a competing live value. Checked against Daniel's own six scores (672/685/590/541/652/601, avg 623.5): both formulas now agree on B2 macro / B2.3 micro — matching what he saw on Dashboard, meaning `/plan`'s B1 was the wrong one. **Not yet independently verified live** — bundled into the same Vercel-deploy-SHA + `gap_scores` DB check already pending from the Phase-2 taxonomy ship. | 2026-09-22, `678ea53` (landed as a side effect of the taxonomy migration, not scoped as its own commit) |
| ISS-048 | 2026-09-20 | Daniel Maneveld — docx §02 + reference `LingoPure_LP18_Master_Brain_Web_v6.1...html` | Sandbox's six capability dimensions don't match Daniel's reference framework (Speaking/Listening/Writing/Reading intent/Vocabulary/Presenting vs. required Reading/Writing/Speaking/Grammar/Listening/Live Interaction) | Open | Logged. Not yet scoped — needs a decision on canonical taxonomy before any fix. | — |
| ISS-049 | 2026-09-20 | Daniel Maneveld — docx §03, Review Section 08 screenshot | Org setup throws raw `organisations_slug_key` duplicate-key Postgres error when slug "prelabz" already exists; random name succeeds | Resolved | `runSelfSetup()` retries the insert with a random slug suffix on `23505` (up to 5 attempts), returns a friendly message on the non-recoverable path — the raw-error crash is fixed. **Join flow added**: a normalised-slug lookup runs BEFORE any insert; a match routes into a `pending` `organisation_memberships` row against the EXISTING org (no duplicate org/employer/role/baselines, no `students.employer_id`/`role_id` until approved) — "a matching name alone must not grant membership" per Daniel's review. New "Pending join requests" card on `/employer` lets an admin assign a role (scoped to that org's own roles only) and approve, or decline. 15/15 `tests/org/self-setup.test.ts` pass (3 new), `npx tsc --noEmit` and `npm run build` clean. | 2026-09-22, `8218c2e` (crash fix) + this session (join flow) |
| ISS-050 | 2026-09-20 | Daniel Maneveld — docx §02/§04 | Target badge shows C2.1 while skill target line + My Programme show C1 | Resolved | Target badge no longer fabricates an LP-18 micro-band from a hardcoded `TARGET_SCORE` constant — renders the plain CEFR letter, sourced from the same `target_level` field as `/plan`. | 2026-09-21, `678ea53` (Phase 1) |
| ISS-051 | 2026-09-20 | Shamini — `WhatsApp Image 2026-09-19 at 23.31.05.jpeg` | Magic-link login shows "Email link is invalid or has expired" | Resolved | Structural root cause: `/auth/callback` was a server route, but Supabase sends the session in the URL fragment, which a server can never see. Converted to a client page handling all 4 link shapes; fixed for 5 shared flows, not just this one. Verified live end-to-end with a real headless browser (fresh link + re-clicked/pre-fetched link, both correct). | 2026-09-21, `7fbb3b9` |
| ISS-052 | 2026-09-20 | Daniel Maneveld — docx §03, Review Section 08 screenshot | No live/interim transcript during discovery call — only completed turns render; no mic-input indicator | Open | Logged. Not yet scoped. | — |
| ISS-053 | 2026-09-20 | Thao — voice memo (`Thao voice message lingopurePtt 2026-09-20 at 10.47.59.ogg`, transcribed via OpenAI Whisper) | Aria re-asks an already-answered question (role, then "responsibility in the meeting," then again) | In progress | Prompt cross-references Dimension 1/3 in `scripts/discovery-system-prompt.ts` so the agent builds on a given answer. **Not yet pushed to the live ElevenLabs agent** — needs `npx tsx scripts/update-discovery-prompt.ts --target prod` with `ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID`, unavailable to this session's tool permissions. | — |
| ISS-054 | 2026-09-20 | Thao — voice memo (transcribed) | Aria should mirror the student's spoken sentence complexity | In progress | Same `8218c2e` prompt change (mirror-complexity instruction added), same live-push blocker as ISS-053. | — |
| ISS-055 | 2026-09-20 | Daniel Maneveld — docx §04 | Role drifted between setup ("Inbound Customer Service") and results ("Inbound Sales") | Open | Logged. Needs Daniel to confirm whether he changed it himself. | — |
| ISS-056 | 2026-09-20 | Daniel Maneveld — docx §03, Review Section 07 screenshot | Intro video duration label says 60s, actual clip is 0:26 | Resolved | Reads real duration from the video element's `loadedmetadata` event instead of a hardcoded guess. | 2026-09-21, `8218c2e` |
| ISS-057 | 2026-09-20 | Daniel Maneveld — docx §03/§04 | Copy bugs: placeholder `"for your role as your role"`; "Learning style" → "Learning preferences"; unlabeled N/A-score sample programme | Resolved | First two bullets fixed `e5e89e0`; third (N/A labeling + gap-driven duration) fixed `45fc6be` — see ISS-057-b row below. | 2026-09-22 |
| ISS-058 | 2026-09-20 | Daniel Maneveld — docx §02 | CEFR-18 micro-levels not carried into My Programme or Aria's spoken explanation | Open | Logged. Not yet scoped. | — |
| ISS-059 | 2026-09-20 | Daniel Maneveld — docx §04 | Role-minimum gap vs target-level gap not distinguished — 5/6 role gaps show 0 while C1 remains a stated goal | Open | Logged. Not yet scoped. | — |
| ISS-060 | 2026-09-20 | Daniel Maneveld — docx §02 | Missing/insufficient evidence must render as "Not assessed," never silently become a zero score or "no gap" | Open | Logged. Not yet scoped. | — |
| ISS-061 | 2026-09-20 | Daniel Maneveld — docx §05 + reference "LP Telemetry Framework" infographic | Live Interaction capability needs its 12 supporting telemetry signals exposed individually with evidence status | Resolved (with caveat) | New "Live interaction telemetry" section on `/dashboard/journey`, all 12 signals + evidence-status pill, verified live in browser. Caveat: that page is fed by the separate 2K assessment pipeline, which the live discovery→battery→plan flow doesn't populate — real testers see the honest empty state, not data, until that pipeline is wired up. | 2026-09-22, `71f4bb4` |
| ISS-062 | 2026-09-20 | Daniel Maneveld — docx §02/§07 + screenshot | Radar chart labels clipped at left edge; ambiguous paired band/score display | Resolved (partial) | Label clipping fixed (widened SVG viewBox with dedicated margin). The ambiguous paired band/score display convention is still open. | 2026-09-21, `8218c2e` (clipping only) |
| ISS-063 | 2026-09-20 | Daniel Maneveld — docx §05, "Checks required to close the review" | Full evidence-chain + cross-page persistence demo requested (responses → evidence → result → gaps → activities → duration), gates sign-off | Open | Logged. Verification/demo task, not a code fix per se. | — |
| ISS-064 | 2026-09-21 | Dennis, relaying Stephen Munich + Shamini (mid-session) | No email sent when a student's programme is generated/committed — confirmed by reading `api/plan/delivery/route.ts` (no email call in GET or POST) | Resolved | `sendPlanReadyEmailOnce()` wired into `GET /api/plan/delivery`, guarded by `students.plan_report_sent_at` (migration 0059) — fires once, best-effort, never blocks rendering. | 2026-09-22, `52244de` |
| ISS-065 | 2026-09-21 | Dennis (mid-session clarification) | Plan-delivery closing moment needs reframing as a sales-funnel step: the generated programme is a sample/preview, not active/enrolled — `/plan` page, Aria's voice script, and the ISS-064 email all need to say so explicitly and end on a "Book a call" CTA instead of a "commit to this programme" framing | Resolved | `/plan` page, Aria's system prompt (`compilePlanPrompt`), and the plan-ready email all reframed around "free sample, book a call if useful"; CTA points at existing `/book-a-demo`. Open question (does the CTA need to branch by audience) not yet answered — still worth a follow-up if it becomes relevant. | 2026-09-22, `52244de` |
| ISS-057-b | 2026-09-21 | Daniel Maneveld — docx §03/§04 (third bullet of ISS-057: "a pre-assessment programme/commitment CTA appeared with N/A scores, unlabeled as sample data") | The `/plan` page showed a fixed 16-week programme for every student regardless of gap profile, and gave no visual cue when it was a generic N/A sample vs. a personalised one | Resolved | `totalWeeks`/phase-count/activity-frequency now derive from `estimateTotalWeeks()` (actual assessed gap), with a labelled fallback + an amber N/A banner on `/plan` when nothing is assessed yet. `tests/plan/plan-delivery.test.ts` (5 tests). | 2026-09-22, `45fc6be` |

---

## Notes on provenance

- **Raised** dates come from the source material's own date (docx dated 20 September 2026; image
  EXIF/on-screen timestamps and the WhatsApp filename dates agree). Where only a date and not a
  time-of-day is available from the source, only the date is recorded.
- All 17 rows above were **logged into this file and `ISSUES_TRACKER.md` on 2026-09-21**, the
  session after the feedback folder was dropped into the repo (2026-09-20) and sat unread.
- Full narrative, screenshots, and the reference LP-18 framework Daniel is comparing against live
  in `docs/lingopure feedback folder 20092026/` (untracked in git as of 2026-09-21 — a decision on
  committing it has not been made).
