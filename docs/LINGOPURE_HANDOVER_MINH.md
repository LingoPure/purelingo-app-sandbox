# LingoPure Handover — Minh (Operational Runbook)

Date: 11 September 2026
Prepared by: Dennis McMahon
Audience: Minh (LingoPure developer)
**Status:** Updated to reflect Master Migration Plan (`LINGOPURE_MIGRATION_PLAN.md`)

## At a glance

This document provides the step-by-step operational commands to execute the infrastructure migration. It works in tandem with the comprehensive **[LingoPure Technical Migration & Infrastructure Ownership Plan](LINGOPURE_MIGRATION_PLAN.md)**.

1. **GitHub** — Mirror copy the application repository to `LingoPure/LingoPureAI` (retaining the original as a rollback backup).
2. **Vercel** — Reconnect the existing project `lingo-pure-ai` to the new repo.
3. **Supabase** — Deferred to Phase 4 of the master plan (LingoPure creates their own project and migrates data).

### Guidance

Unlike the MMC handover, **this repo keeps consuming `@caistech/*` packages from Dennis's GitHub Packages registry.** The MMC carve-out (rename `@caistech/*` → `@mmcbuild/*` + a trimmed shared monorepo) existed because a third party took over the substrate. LingoPure stays on the shared substrate (`cais-shared-services` is the portfolio moat — see `BUSINESS_MODEL.md`), so there is **no rename and no code change** in this handover.

---

## Decisions baked into this plan

| Decision | This plan | Alternative |
|---|---|---|
| D1 — Substrate | **Keep `@caistech/*` as-is** | MMC-style `@lingopure/*` carve-out (Appendix A) |
| D2 — GitHub Strategy | **Mirror Copy** (Retain CAS repo) | Transfer (Destroys CAS repo) |
| D3 — Vercel team | **Create New LingoPure Team** (per Master Plan) | Keep Corporate AI Solutions team |
| D4 — Supabase | **Phase 4** (Full migration to LingoPure-owned) | Option A: Keep CAS Supabase |

---

## Prerequisites — confirm before you start

Tick each box before running any of the steps below.

- [ ] You can create repos under the **LingoPure GitHub org** and have admin permissions for Actions secrets.
- [ ] You have **git**, **node (v20+)**, **npm** (this repo uses `package-lock.json` — not pnpm), and the **GitHub CLI (`gh`)** installed locally.
- [ ] You have been added as an admin to the LingoPure GitHub org.
- [ ] You have read the Master Migration Plan (`LINGOPURE_MIGRATION_PLAN.md`).
- [ ] **LingoPure Org Owner** is standing by to approve repository creation.

Also confirm: this app's build installs six private `@caistech/*` packages from `https://npm.pkg.github.com`. Any install must present a token for that registry. That is covered by Steps 2–4; it is not an outage, it's just a prerequisite to understand.

---

## Step 1 — Mirror Repository to LingoPure (10 min)

*Note: We are using a mirror copy instead of a transfer to ensure Dennis retains the original environment for rollback until LingoPure is fully validated.*

### 1.1 — Create the empty target repo
You (or the LingoPure org owner) must create the empty repo first.

```bash
gh repo create LingoPure/LingoPureAI --private
```

### 1.2 — Dennis executes the mirror push
From Dennis's local machine (where the repo is currently cloned):

```bash
# 1. Add LingoPure repo as a remote 
git remote add lingopure https://github.com/LingoPure/LingoPureAI.git

# 2. Push ALL branches, tags, and historical refs
git push lingopure --all
git push lingopure --tags

# 3. Remove the remote once complete
git remote remove lingopure
```

### 1.3 — Verify
```bash
gh repo view LingoPure/LingoPureAI
```

Should print metadata without errors and contain the full branch history.

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

```bash
npm whoami --registry=https://npm.pkg.github.com
```

This prints your GitHub username. If it errors, the token lacks `read:packages` or was mistyped.

> The repo-level `.npmrc` references `${NODE_AUTH_TOKEN}` — it contains **no token**, so it is safe to commit. Whenever you run `npm ci` locally, either `export NODE_AUTH_TOKEN=ghp_...` first, or add `//npm.pkg.github.com/:_authToken=ghp_...` to your **user-level** `~/.npmrc`.

---

## Step 3 — Move the CI secrets and variables to the LingoPure org (10 min)

The repo's workflows were wired to secrets set **org-wide on the `caistech` org**. Org secrets don't survive a copy — they must be recreated **on the `LingoPure` org** or **on the `LingoPure/LingoPureAI` repository itself**.

**Secrets (Settings → Secrets and variables → Actions → New secret):**

| Name | Used by | Note |
|---|---|---|
| `CAISTECH_PACKAGES_TOKEN` | `gate.yml`, `health-sensors.yml`, `dependabot.yml` | Registry read for the `@caistech/*` install — needs `read:packages`. Use this for the Actions side |
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

**Dependabot** reads `CAISTECH_PACKAGES_TOKEN` as a *Dependabot secret*, not an Actions secret (Settings → Secrets and variables → Dependabot) — same value.

### Verify after Step 1–3

Open a trivial PR (or re-run the gate on an existing PR) and confirm the workflow gets past `npm ci` with no 401/403.

---

## Step 4 — Wire Vercel and deploy (10 min)

### 4.1 — Confirm the env vars are present

The current project already has across Development, Preview and Production:
`GITHUB_PACKAGES_TOKEN`, `NODE_AUTH_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMPLOYER_DEMO_PASSWORD`, `HEYGEN_API_KEY`, `NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID`, `NEXT_PUBLIC_CANVAS_MODE`, `ADMIN_EMAILS`.

### 4.2 — Switch the connected GitHub repo

Vercel currently auto-deploys from `caistech/LingoPureAI`.

1. **Settings → Git → Disconnect** the current repo.
2. **Connect Git Repository →** choose **`LingoPure/LingoPureAI`**.
3. Confirm the **Production branch = `main`**.

### 4.3 — Do NOT rename the project or domain

`lingo-pure-ai.vercel.app` is baked into `supabase/config.toml` and into every confirmation/password-reset email already sent. Renaming the project creates a new URL and silently breaks signup links. Keep the name.

### 4.4 — Trigger a redeploy

1. **Deployments → most recent → ⋯ → Redeploy →** "Use existing Build Cache" **off**.
2. Watch the log — the `npm ci` step must resolve the six `@caistech/*` packages.

### Verify

- Build completes with a green tick.
- `curl -I https://lingo-pure-ai.vercel.app/` returns HTTP/2 200.
- Click through sign-in + dashboard in a browser; confirm no runtime errors.

---

## Definition of Done (Phase 1 & 2)

You are finished with this runbook when all of these are true:

- [ ] `LingoPure/LingoPureAI` exists in the org, default branch = `main`
- [ ] The Step 3 secrets + `PORTFOLIO_GATE_PREVIEW_URL` variable are set on the LingoPure org; a CI run passes `npm ci` and the gate is green
- [ ] Vercel project `lingo-pure-ai` is connected to `LingoPure/LingoPureAI`
- [ ] `GITHUB_PACKAGES_TOKEN` / `NODE_AUTH_TOKEN` are set on Vercel (Development, Preview, Production)
- [ ] Latest Vercel deployment is green and `https://lingo-pure-ai.vercel.app/` responds 200
- [ ] Sign-in + dashboard smoke test passes

**Next:** Proceed to Phase 3 and 4 of the Master Plan (LingoPure Vercel team creation and Supabase migration).

---

## Not in scope today

- **DNS cutover** — bringing a custom domain onto Vercel.
- **`@lingopure/*` package carve-out** — covered in Appendix A, only on request.
- **Supabase data migration** — scheduled as Phase 4 of the Master Plan.

---

## When to ping me

1. **GitHub org approval for the transfer** — if permissions fail.
2. **Secrets values** — I hold the current values for every secret in Step 3.
3. **401/403 during install after reconnect** — almost always the token, on whichever runner is failing.

---

## Reference — repos and URLs

| Resource | URL |
|---|---|
| Current repo (retained for rollback) | https://github.com/caistech/LingoPureAI |
| Target repo | https://github.com/LingoPure/LingoPureAI |
| Target org | https://github.com/LingoPure |
| Vercel project | https://vercel.com/corporate-ai-solutions/lingo-pure-ai |
| Live deployment | https://lingo-pure-ai.vercel.app/ |
| GitHub Packages registry (npm) | https://npm.pkg.github.com |
| Supabase (to be migrated in Phase 4) | https://supabase.com/dashboard/project/nbvprbaumwmfczsfcyrv |
| Auth config baked into deploys | `supabase/config.toml` (in this repo) |
| CI workflows that need secrets | `.github/workflows/gate.yml`, `health-sensors.yml`, `hr-module.yml`, `claude-code.yml`, `dependabot.yml` |
| Master Migration Plan | `docs/LINGOPURE_MIGRATION_PLAN.md` |

---

## Appendix A — (optional) MMC-style `@lingopure/*` carve-out

Not needed for this handover. If the LingoPure org later needs to own the *substrate*, the mechanics are identical to the MMC Build handover (which was done for exactly this reason when a third party took over the substrate):

1. Trim `cais-shared-services` (Dennis's repo) down to the six packages LingoPure actually consumes, into `LingoPure/lingopure-shared`.
2. Rename scopes `@caistech/*` → `@lingopure/*`, bump versions, publish from the LingoPure GitHub Packages registry.
3. Swap `package.json`, `.npmrc`, and all `src/` imports; update the `@caistech` scope in `gate.yml` + `dependabot.yml`.

Before doing this, weigh it against `BUSINESS_MODEL.md` — the shared `@caistech/*` substrate is the portfolio moat, and forking it fragments the shared fixes that dependabot propagates across all ~38 products. Only carve out if the LingoPure org genuinely operates independently.
