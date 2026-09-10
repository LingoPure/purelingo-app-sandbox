# LingoPure Handover — Minh

Date: 2026-09-11
Prepared by: Dennis McMahon
Audience: Minh (LingoPure developer)
Estimated total time: 60–90 minutes once you start

## At a glance

One GitHub repo is being transferred from Dennis's account to the LingoPure org:

1. **caistech/LingoPureAI → LingoPure/lingopure** — the LingoPure web application itself, with full git history (201 commits, all branches, issues and PRs move with it).
2. **Vercel** — the existing project `lingo-pure-ai` is reconnected to the new repo. All environment variables are already in place; this is a verify, not a rebuild.
3. **Supabase** — project `nbvprbaumwmfczsfcyrv` (Tokyo) **stays as-is today** (Option A). The heavier "move into a LingoPure-owned project" migration is documented in Step 5, Option B, and is a deliberate deferral — exactly the same choice the MMC handover made.

### Guidance

Unlike the MMC handover, **this repo keeps consuming `@caistech/*` packages from Dennis's GitHub Packages registry.** The MMC carve-out (rename `@caistech/*` → `@mmcbuild/*` + a trimmed shared monorepo) existed because a third party took over the substrate. LingoPure stays on the shared substrate (`cais-shared-services` is the portfolio moat — see `BUSINESS_MODEL.md`), so there is **no rename and no code change** in this handover. The work is: transfer the repo, move the CI secrets, reconnect Vercel, verify. Appendix A covers the optional MMC-style carve-out if the LingoPure org ever needs it.

---

## Decisions baked into this plan

| Decision | This plan (default) | Alternative |
|---|---|---|
| D1 — Substrate | **Keep `@caistech/*` as-is** — no package rename, no source edits | MMC-style `@lingopure/*` carve-out (Appendix A) |
| D2 — Vercel team | **Keep the `Corporate AI Solutions` team** and just reconnect the repo | New LingoPure Vercel team (needs a paid plan) |
| D3 — Supabase | **Option A: keep project `nbvprbaumwmfczsfcyrv`** — zero data motion | Option B: migrate to a LingoPure-owned Supabase project (Step 5) |

---

## Architecture before and after

```
BEFORE (today)                          AFTER (post-handover)
==============                          =====================

lingo-pure-ai.vercel.app                lingo-pure-ai.vercel.app
        |                                       |
        v                                       v
  caistech/LingoPureAI                    LingoPure/lingopure
  (Dennis's repo)                         (your repo — full history)
        |                                       |
        | imports                               | imports (unchanged)
        v                                       v
  @caistech/* packages                    @caistech/* packages
  (Dennis's GitHub                         (Dennis's GitHub
   Packages registry)                       Packages registry)
        ^                                       ^
        |                                       |
        | published from                        | published from
        |                                       |
  caistech/cais-shared-services           caistech/cais-shared-services
  (Dennis's source)                       (Dennis's source — unchanged)

  Supabase nbvprbaumwmfczsfcyrv           Supabase nbvprbaumwmfczsfcyrv
  (CAS-owned, Tokyo)                      (unchanged — Option A)
```

---

## Prerequisites — confirm before you start

Tick each box before running any of the steps below.

- [ ] You can create repos under the **LingoPure GitHub org** and (for Step 3) add repo/org **secrets and variables**. Note: `dennissolver` is a member, not owner, of the org — the transfer acceptance in Step 1 needs an **org owner** (see 1.2).
- [ ] You can access the Vercel project at **vercel.com/corporate-ai-solutions/lingo-pure-ai** with permission to change the Git connection and trigger redeploys.
- [ ] You have **git**, **node (v20+; project and Vercel run 24.x)**, **npm** (this repo uses `package-lock.json` — not pnpm), and the **GitHub CLI (`gh`)** installed locally.
- [ ] You have been invited to the LingoPure GitHub org, or Dennis has run the transfer for you (Step 1).
- [ ] For Step 5 Option B only: a `SUPABASE_ACCESS_TOKEN` from https://supabase.com/dashboard/account/tokens and admin on the target Supabase org.
- [ ] You have read this entire document once before starting.

Also confirm: this app's build installs six private `@caistech/*` packages from `https://npm.pkg.github.com` (corporate-components, dataroom-core, elevenlabs-convai, sayfix-embed, webmcp-kit, and dev portfolio-gate). Any install — locally, in GitHub Actions, or on Vercel — must present a token for that registry. That is covered by Steps 2–4; it is not an outage, it's just a prerequisite to understand.

---

## Step 1 — Take ownership of the repo (10 min)

### 1.1 — Dennis runs the transfer

From Dennis's machine (source repo, `caistech` side):

```
gh repo transfer caistech/LingoPureAI LingoPure --new-name lingopure
```

This moves the repo with **full history**: 201 commits, every branch (17), issues, PRs, and `dependabot.yml` config all come with it.

### 1.2 — The LingoPure org owner accepts

GitHub emails the org owners an approval notice. A member **cannot** accept an org transfer — an **owner** must:
1. Open the notification/email and click **Approve transfer**, or
2. If the transfer is blocked, promote `dennissolver` to owner temporarily (Settings → Members) and Dennis re-runs 1.1.

### 1.3 — Invite Dennis back as a collaborator

For the new repo: **Settings → Collaborators → Add people → `dennissolver` → Write**. Without this, Dennis can't push fixes if anything goes wrong in later steps.

### 1.4 — Verify

```
gh repo view LingoPure/lingopure
```

Should print metadata without errors.

### 1.5 — Branch note (do this first, don't skip)

`main` is the deployment source of truth. There is committed but **unmerged** work on this machine: branch `fix/data-residency-disclosure` is **1 commit ahead of `origin/main`** (`f573ebb fix(privacy): disclose overseas storage`), and the working tree holds uncommitted changes plus 6 untracked files. Before the first deploy from the new repo:

- merge `f573ebb` into `main` (or PR it) so the new repo's default branch carries the privacy fix, and
- commit/stash the working-tree changes.

---

## Step 2 — Generate a GitHub Personal Access Token (5 min)

Open this pre-filled link in your browser:

```
https://github.com/settings/tokens/new?scopes=repo,read:packages,write:packages&description=lingopure-github-packages
```

1. Pick an expiration (90 days or 1 year is fine).
2. Click **Generate token**.
3. Copy the `ghp_...` value immediately — you won't see it again.
4. Save it in your password manager. You'll use it in Steps 3 and 4.

Verify it works against GitHub Packages:

```
npm whoami --registry=https://npm.pkg.github.com
```

This prints your GitHub username. If it errors, the token lacks `read:packages` or was mistyped.

> The repo-level `.npmrc` references `${NODE_AUTH_TOKEN}` — it contains **no token**, so it is safe to commit. Whenever you run `npm ci` locally, either `export NODE_AUTH_TOKEN=ghp_...` first, or add `//npm.pkg.github.com/:_authToken=ghp_...` to your **user-level** `~/.npmrc` (that file is outside any repo and must never be committed).

---

## Step 3 — Move the CI secrets and variables to the LingoPure org (10 min)

The repo's workflows were wired to secrets set **org-wide on the `caistech` org**. Org secrets don't survive a transfer — they must be recreated **on the `LingoPure` org** (then they apply to the transferred repo automatically) or **on the repo itself**.

When Dennis runs the transfer he'll hand you the current values. Recreate on the LingoPure org:

**Secrets (Settings → Secrets and variables → Actions → New secret):**

| Name | Used by | Note |
|---|---|---|
| `CAISTECH_PACKAGES_TOKEN` | `gate.yml`, `health-sensors.yml`, `dependabot.yml` | Registry read for the `@caistech/*` install — needs `read:packages`. Use this for the Actions side (Step 2's PAT works) |
| `GITHUB_PACKAGES_TOKEN` | `hr-module.yml` | Falls back to `GITHUB_TOKEN` if missing — set it to the same value |
| `NEXT_PUBLIC_SUPABASE_URL` | `gate.yml` | Same value as Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | `gate.yml` | Same value as Vercel env — server-only |
| `QA_TEST_USER_ID` | `gate.yml` voice memory-loop | A real test user's id |
| `CONVAI_TOOL_SECRET` | `gate.yml` voice memory-loop | Only if webhook routes are secret-guarded |
| `ANTHROPIC_API_KEY` | `claude-code.yml` | Same value as Vercel env |
| `GH_PAT` | `claude-code.yml` | Falls back to `GITHUB_TOKEN` if missing |
| `EASY_CLAUDE_API_KEY` | `claude-code.yml` | Easy-Claude-Code dispatch key |

**Variable (Settings → Secrets and variables → Actions → Variables):**

| Name | Used by | Note |
|---|---|---|
| `PORTFOLIO_GATE_PREVIEW_URL` | `gate.yml`, `health-sensors.yml` | The Vercel preview URL the gate smoke-tests — `lingo-pure-ai.vercel.app` in prod |

**Dependabot** reads `CAISTECH_PACKAGES_TOKEN` as a *Dependabot secret*, not an Actions secret (Settings → Secrets and variables → Dependabot) — same value. This repo's `dependabot.yml` is scoped narrowly to `@caistech/*`, so it keeps working unchanged.

### Verify after Step 1–3

Open a trivial PR (or re-run the gate on an existing PR) and confirm the workflow gets past `npm ci` with no 401/403.

---

## Step 4 — Wire Vercel and deploy (10 min)

### 4.1 — Confirm the env vars are present (they already are)

Checked 2026-09-11 — the project already has across Development, Preview and Production:

`GITHUB_PACKAGES_TOKEN`, `NODE_AUTH_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMPLOYER_DEMO_PASSWORD`, `HEYGEN_API_KEY`, `NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID`, `NEXT_PUBLIC_CANVAS_MODE`, `ADMIN_EMAILS`.

If any are missing: **Settings → Environment Variables**, add with all three environments ticked. `GITHUB_PACKAGES_TOKEN` / `NODE_AUTH_TOKEN` take your PAT from Step 2.

### 4.2 — Switch the connected GitHub repo

Vercel currently auto-deploys from `caistech/LingoPureAI`.

1. **Settings → Git → Disconnect** the current repo.
2. **Connect Git Repository →** choose **`LingoPure/lingopure`**.
3. Confirm the **Production branch = `main`**.

### 4.3 — Do NOT rename the project or domain

`lingo-pure-ai.vercel.app` is baked into `supabase/config.toml` (`site_url` + `additional_redirect_urls`) and into every confirmation/password-reset email already sent. Renaming the project creates a new URL and silently breaks signup links. Keep the name.

### 4.4 — Trigger a redeploy

1. **Deployments → most recent → ⋯ → Redeploy →** "Use existing Build Cache" **off**.
2. Watch the log — the `npm ci` step must resolve the six `@caistech/*` packages from `npm.pkg.github.com` (this is the moment the token matters).

### Verify

- Build completes with a green tick.
- `curl -I https://lingo-pure-ai.vercel.app/` returns HTTP/2 200.
- Click through sign-in + dashboard in a browser; confirm no runtime errors.

---

## Step 5 — Supabase

### Option A (default — recommended today)

**Nothing to migrate.** The app keeps using project `nbvprbaumwmfczsfcyrv` (Tokyo). `supabase/config.toml` stays pointing at it. No `pg_dump`, no storage copy, no env swap, no downtime. The MMC handover deferred the same step and ran on the shared project for months. A later maintenance window can move it (Option B) once the LingoPure org owns a Supabase org — decide that on a date, not during a handover.

### Option B (only if the LingoPure org owns a Supabase project)

Treated as a scheduled migration, 1-hour maintenance window — schedule it and add it to the DoD:

1. **Create the target org + project** at supabase.com (choose Northeast Asia / Tokyo to match the current region).
2. **Dump and restore** (from the existing project):
   ```
   supabase db dump --project-ref nbvprbaumwmfczsfcyrv --password ... > dump.sql
   supabase db push   # or psql the dump against the new project
   ```
   Schema comes from `supabase/migrations/` in this repo — replay them idempotently against the new project, then copy **storage buckets** (objects + policies) separately.
3. **Swap env** on Vercel (all three environments) and the GitHub Actions secret:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Update `supabase/config.toml`**: `project_id`, and confirm `site_url` / redirects still list `lingo-pure-ai.vercel.app`.
5. **Smoke test end-to-end**: sign in, dashboard, investor dataroom Q&A, voice agent, HR module — the same checklist as the original deploy.

---

## Definition of Done

You are finished when all of these are true:

- [ ] `LingoPure/lingopure` exists in the org, default branch = `main`, carrying `f573ebb` (the privacy fix) or later
- [ ] `dennissolver` has been re-added as a collaborator (Write) on the repo
- [ ] The Step 3 secrets + `PORTFOLIO_GATE_PREVIEW_URL` variable are set on the LingoPure org (or repo); a CI run passes `npm ci` and the gate is green
- [ ] Vercel project `lingo-pure-ai` is connected to `LingoPure/lingopure`
- [ ] `GITHUB_PACKAGES_TOKEN` / `NODE_AUTH_TOKEN` are set on Vercel (Development, Preview, Production)
- [ ] Latest Vercel deployment is green and `https://lingo-pure-ai.vercel.app/` responds 200
- [ ] Sign-in + dashboard smoke test passes (and the remaining routes: classroom, investor, HR)
- [ ] Supabase Option A documented as the decision (or Option B complete)
- [ ] Minh has a working local clone: `git clone`, `npm ci`, `npm run dev`

---

## Not in scope today

- **DNS cutover** — bringing a custom domain (e.g. `app.lingopure.com`) onto Vercel and updating `supabase/config.toml` redirects. The existing `lingo-pure-ai.vercel.app` URL stays.
- **`@lingopure/*` package carve-out** — covered in Appendix A, only on request.
- **Vercel team transfer** — moving the project out of `Corporate AI Solutions` needs a separate paid plan.
- **Supabase project transfer** — Option B above, scheduled separately.

---

## When to ping me

Direct me to any blocker not covered by the tables above. Most likely friction points:

1. **GitHub org approval for the transfer** — only an org owner can accept. If it's not you, I'll coordinate.
2. **Secrets values** — I hold the current values for every secret in Step 3.
3. **A 422 on `gh repo transfer`** — the destination org rejected the move; confirm the org slug and (if needed) promote a member to owner for the accept step.
4. **401/403 during install after reconnect** — almost always the token, on whichever runner is failing (Vercel env vs GitHub Actions secret vs your local `~/.npmrc`).

Workflow when something goes wrong:

1. You hit an error → screenshot or paste the exact text.
2. I fix locally and push to `LingoPure/lingopure`.
3. You `git pull` and re-run the failed step.

---

## Reference — repos and URLs

| Resource | URL |
|---|---|
| Current repo (will transfer) | https://github.com/caistech/LingoPureAI |
| Target repo | https://github.com/LingoPure/lingopure |
| Target org | https://github.com/LingoPure |
| Vercel project | https://vercel.com/corporate-ai-solutions/lingo-pure-ai |
| Live deployment | https://lingo-pure-ai.vercel.app/ |
| GitHub Packages registry (npm) | https://npm.pkg.github.com |
| Supabase (in use, unchanged) | https://supabase.com/dashboard/project/nbvprbaumwmfczsfcyrv |
| Auth config baked into deploys | `supabase/config.toml` (in this repo) |
| CI workflows that need secrets | `.github/workflows/gate.yml`, `health-sensors.yml`, `hr-module.yml`, `claude-code.yml`, `dependabot.yml` |

---

## Appendix A — (optional) MMC-style `@lingopure/*` carve-out

Not needed for this handover. If the LingoPure org later needs to own the *substrate*, the mechanics are identical to the MMC Build handover (which was done for exactly this reason when a third party took over the substrate):

1. Trim `cais-shared-services` (Dennis's repo) down to the six packages LingoPure actually consumes, into `LingoPure/lingopure-shared`.
2. Rename scopes `@caistech/*` → `@lingopure/*`, bump versions, publish from the LingoPure GitHub Packages registry.
3. Swap `package.json`, `.npmrc`, and all `src/` imports; update the `@caistech` scope in `gate.yml` + `dependabot.yml`.

Before doing this, weigh it against `BUSINESS_MODEL.md` — the shared `@caistech/*` substrate is the portfolio moat, and forking it fragments the shared fixes that dependabot propagates across all ~38 products. Only carve out if the LingoPure org genuinely operates independently.