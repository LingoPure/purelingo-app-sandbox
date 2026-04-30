# LingoPure — AI-First Business English Platform

Strategic platform demo built on top of [lingopure.com](https://www.lingopure.com)'s existing
language-school operation. Wraps an AI assessment + scoring layer around ClassIn, with
gamified micro-learning and CEFR certification on the roadmap.

Source of truth for build decisions: `briefing-extracted.txt` (originally
`lingopure-claude-code-briefing.docx`).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript |
| Database | Supabase (Postgres + RLS) — project `nbvprbaumwmfczsfcyrv` |
| Auth | Supabase Auth (email/password) via `@supabase/ssr` |
| Voice agent | ElevenLabs Conversational AI via `@caistech/elevenlabs-convai` *(Phase 1, pending agent provisioning)* |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) for gap-scoring rubric |
| Transcription | OpenAI Whisper *(post-session pipeline, Phase 1 step 6)* |
| Live classroom | ClassIn SDK embed *(awaiting EEO commercial credentials)* |
| Hosting | Vercel + Vercel Cron |

## Quick start

```bash
# 1. Copy env template
cp .env.example .env.local
# Then fill in NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY, etc.

# 2. Install
npm install

# 3. Run the schema migration
# Open supabase/migrations/0001_initial_schema.sql and run it against the
# nbvprbaumwmfczsfcyrv project (Supabase dashboard → SQL Editor).

# 4. Dev server
npm run dev
# → http://localhost:3000
```

## Routes

| Path | Purpose | Auth |
|------|---------|------|
| `/` | Marketing landing | public |
| `/login`, `/signup` | Email + password auth | public |
| `/dashboard` | Student dashboard — gap bars, next class, activity log | required |
| `/onboarding` | ElevenLabs ConvAI discovery session launcher | required |
| `/classroom/[sessionId]` | Full-screen ClassIn SDK embed (placeholder until creds) | required |

`src/middleware.ts` redirects unauthenticated requests on protected paths to `/login`.

## MVP build sequence (briefing §06)

| # | Component | Status |
|---|-----------|--------|
| 1 | Project scaffold + auth | ✅ scaffolded |
| 2 | Supabase schema (8 tables + RLS) | ✅ migration ready (apply via dashboard) |
| 3 | ClassIn SDK embed | ⏳ placeholder — awaiting EEO credentials |
| 4 | ElevenLabs ConvAI discovery agent | ⏳ next — needs agent provisioned via `@caistech/elevenlabs-convai` |
| 5 | Gap scoring engine (Claude rubric) | ⏳ depends on #4 |
| 6 | Post-session sync (ClassIn → Whisper → Claude) | ⏳ depends on #3 + #5 |
| 7 | Student dashboard v1 | ⏳ shell rendered; live data hooks in once #4–6 done |
| 8 | Pilot with 5–10 students | ⏳ |

## Out of MVP (Phase 2)

Micro-lesson engine, gamification (XP/streaks/badges/leaderboard), nudge engine
(Twilio + SendGrid), employer dashboard, admin dashboard, TrackTest integration,
mobile app, multi-employer support, RAG knowledge base.

## Required env vars

See `.env.example`. None of these are committed; `.env.local` is gitignored.

| Var | Required for | Source |
|-----|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | All app routes | already set: `https://nbvprbaumwmfczsfcyrv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + reads | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only routes that bypass RLS | Same place — keep server-side only |
| `ANTHROPIC_API_KEY` | Gap scoring (build sequence #5) | console.anthropic.com |
| `OPENAI_API_KEY` | Whisper transcription (#6) | platform.openai.com |
| `ELEVENLABS_API_KEY` | Discovery agent (#4) | elevenlabs.io |
| `ELEVENLABS_WEBHOOK_SECRET` | ConvAI post-call webhook | set when creating webhook |
| `ELEVENLABS_AGENT_ID` | Discovery agent ID | created via `@caistech/elevenlabs-convai` |
| `CLASSIN_APP_ID` / `CLASSIN_APP_SECRET` | ClassIn SDK embed (#3) | EEO commercial agreement |

## Architecture notes

- Three environments (dev / staging / prod) via `.env.*` only — no code branches.
- Idempotent migrations under `supabase/migrations/`. RLS enabled on every table.
- `students.id` references `auth.users.id`; row auto-created on signup via trigger.
- ClassIn classroom layout (`src/app/classroom/[sessionId]/layout.tsx`) is full-screen
  with no LingoPure chrome, per briefing §04.
- ElevenLabs ConvAI replaces Vapi from the briefing — uses the shared
  `@caistech/elevenlabs-convai` package (install needs `GITHUB_PACKAGES_TOKEN`).

## Deploying to Vercel

Project is a vanilla Next.js app — `vercel` from this directory works. Set all env
vars in the Vercel project settings (mark anything beginning with `NEXT_PUBLIC_` as
exposed).
