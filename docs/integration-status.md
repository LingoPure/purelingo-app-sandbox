# Integration Status — One-Page Reference

For the LingoPure board demo. Use this when someone asks "is X working
or is that fake?" — you get to give an honest, specific answer instead
of a vague one.

## TL;DR

| System | Status | What you see in the demo |
|---|---|---|
| ElevenLabs ConvAI (Aria voice agent) | **Real, live** | Real 20-min discovery call, real transcript, real gap-scoring against role baseline |
| Supabase auth + data | **Real, live** | Magic-link invites, RLS-scoped employer dashboards, persisted gap scores and progress |
| Resend email | **Real, live** | Invitations and nudge emails delivered through real SMTP |
| HeyGen "Meet Aria" intro | **Real, pre-rendered** | One-time render plays before the live call. ~$1 to render once, infinite plays. |
| Supabase RLS + employer scoping | **Real, live** | Employer admins see only their own cohort; students see only their own data |
| Anthropic Claude (scoring + nudges) | **Real, live** | Real LLM evaluation of the discovery transcript and lesson submissions |
| **ClassIn live classroom** | **Stubbed** | Embed surface renders, sync doesn't run (waiting on EEO SDK creds) |
| **TrackTest CEFR certification** | **Stubbed (simulate path)** | Student can take a mock exam and see a fake-but-realistic result |
| Phase 0b assessment battery | **Schema only** | Spec + DB tables exist; UI/scorer is next sprint |

Everything in the table marked "Real, live" actually does the thing. The
two that are stubbed are stubbed for **deliberate, external reasons** —
not because we couldn't build them — and the moment the partner unblocks
us, only the adapter file changes.

---

## What's stubbed and why

### 1. ClassIn live classroom (Vietnamese live-class platform)

**Files:** `src/lib/classin/token.ts`, `src/lib/classin/api.ts`,
`src/app/api/classin/session-end/route.ts`

**What works in the demo:**
- The classroom embed surface renders (`/classroom/[sessionId]`)
- Session scheduling works in Supabase (`classin_sessions` table)
- The "session ended" callback updates `attended` and `duration_mins`
- A "paste your transcript" fallback path lets a teacher manually upload
  the lesson outcome so the rest of the pipeline (Whisper → Claude eval
  → `gap_scores` write) still completes end-to-end

**What's stubbed:**
- ClassIn SDK token signing (`token.ts:8` — placeholder algorithm)
- Session analytics fetch (`api.ts:54` — throws `ClassinUnavailableError`)
- Recording download from CDN (`api.ts:76` — auth header signing)
- Post-session sync trigger (`session-end/route.ts:60`)

**Why stubbed:** ClassIn is distributed in Vietnam through EEO. We're
waiting on:
1. Real `CLASSIN_APP_ID` + `CLASSIN_APP_SECRET` from EEO
2. The exact analytics endpoint path
3. The token signing algorithm
4. Confirmation of the recording auth scheme

**To unstub:** EEO sends creds + docs → only `src/lib/classin/` files
change. Everything that consumes the adapter (the sync route, the
classroom embed, the dashboards) stays untouched. The shape returned by
`fetchSessionAnalytics()` is locked, so no schema migration needed.

**Board answer:** "The classroom embed is the real architecture — once
EEO provides the SDK credentials, only the adapter file changes. We
already built it as a swap-in adapter so we're not blocked on it for
the rest of the platform to ship."

---

### 2. TrackTest CEFR certification

**Files:** `src/lib/tracktest/sso.ts`, `src/app/exam/[id]/page.tsx`,
`src/app/api/exam/simulate/route.ts`

**What works in the demo:**
- Cert eligibility check (gap score ≥ band threshold)
- Exam scheduling row written to Supabase (`certifications` table)
- "Take exam" → routes to a simulate page that produces a realistic-looking
  CEFR result using a deterministic mapping from gap scores
- Webhook receiver shape is real — when a real result arrives, it lands
  in the `certifications.result_json` column

**What's stubbed:**
- SSO URL signing (`sso.ts:42` — returns an unsigned URL pattern that
  exercises routing but won't actually authenticate against TrackTest's host)
- The simulate endpoint replaces the real exam roundtrip

**Why stubbed:** TrackTest is a separate B2B partner. We need:
1. Signed partner agreement
2. `TRACKTEST_API_KEY` + `TRACKTEST_PARTNER_ID`
3. Signing algorithm documentation
4. Confirmed SSO host URL (`TRACKTEST_SSO_HOST`)

**To unstub:** Replace the `TODO(TrackTest)` block in `sso.ts:42` with
the partner-spec'd signing. Keep `simulate/route.ts` as the dev fallback
so we can still demo without hitting their staging environment.

**Board answer:** "TrackTest is a partner integration. We have the SSO
pattern wired and a webhook receiver ready — it's a contract issue, not
an engineering one. Day one of the partner agreement, we ship the real
exam path."

---

## What is NOT stubbed (so you can answer with confidence)

These all do the thing for real, in production, today:

- **Aria's discovery interview** — a real 20-minute conversational
  assessment over WebSocket-only audio (we just removed the WebRTC
  fallback that was causing intermittent issues). Aria is briefed
  per-student with name, role, employer, and target level via dynamic
  variables fed from Supabase. The transcript is real, the post-call
  webhook fires, and the LLM scoring writes six real `gap_scores` rows
  per student.

- **Magic-link invitations** — real Resend SMTP. The invite link bypasses
  the broken Supabase verify roundtrip via direct callback URL with a
  hashed token, so the existing-user path actually delivers an email
  instead of just creating a link silently.

- **Employer dashboard** — real RLS scoping (employer admins see only
  their cohort), real bulk-invite UI on `/employer/students`, real
  role-discovery interview that writes to `roles` + `role_baselines`.

- **Native language flow** — employer admin sets `default_native_language`
  on the employer row; staff invites inherit it; the student can override
  on `/onboarding`; Aria opens the call in that language for ~30s, then
  switches to English (per the system prompt's NATIVE LANGUAGE block).

- **Brand pronunciation** — Aria says "Lingo Pyoor" (engineered respelling
  forces TTS through English /pjʊɹ/) regardless of carrier-sentence
  language. UI text stays "LingoPure".

- **Demo banner** — every page, sticky, large gold band that says
  "STRATEGIC DEMO · This is a strategic platform demo — not the real
  LingoPure service. Visit the real LingoPure →". Impossible to miss.

- **Gap radar dashboard** — six dimensions, real scores 0-1000, real CEFR
  band mapping, per-skill targets sourced from `role_baselines`.

- **Micro-lessons** — real LLM-generated speak-score and email-sprint
  exercises, real submission grading, real `gap_scores` updates with
  `source='lesson'`.

- **Nudges engine** — real cron-driven Resend dispatch with cohort
  scoping and unsubscribe handling.

---

## What's coming next (post-demo, NOT stubbed because it's not built yet)

- **Phase 0b.1 writing assessment battery** — schema is in place
  (`discovery_task_prompts`, `discovery_task_responses`, expanded
  `gap_scores.source` enum, `gap_scores.is_canonical` column — see
  `supabase/migrations/0016_phase_0b_battery.sql`). UI + scorer is the
  next sprint. Spec at `docs/phase-0b-assessment-battery.md`.

- **Phase 0b.2-0b.4** — listening, reading, vocab, learning-style probes.
  Scoped in the same spec, ship later.

- **Real ClassIn integration** — gated on EEO creds.

- **Real TrackTest integration** — gated on partner agreement.

---

## If a board member asks "show me the seam"

Best demo path to expose what's real:

1. Open `/employer/students` as the admin → invite yourself as a student.
2. Receive the email (real Resend). Click the link.
3. Land on `/onboarding` → see the demo banner, the "Meet Aria" video,
   and the role/native-language picker.
4. Start the discovery call → 20 minutes of real conversational AI.
5. End → see the gap-radar populate from real LLM scoring (~30-60s).
6. Open `/employer/students/[your id]` as admin → see your gap profile
   land on the cohort dashboard.

The classroom step (between dashboard and a real lesson) is where you
say "this is the embed surface — here's the schedule, here's where the
ClassIn call would launch — and here's the post-session sync we built
to receive analytics. The only thing we're waiting on is creds."
