# LingoPure Technical Migration & Infrastructure Ownership Plan

Date: 11 September 2026
Prepared by: Dennis McMahon
Audience: Minh and LingoPure Management
Status: DRAFT — FOR REVIEW AND APPROVAL BEFORE EXECUTION

## 1. Purpose of this document

This document defines the proposed technical migration of the LingoPure application from infrastructure controlled by Corporate AI Solutions / Dennis to infrastructure owned and controlled by LingoPure.

The objective is not simply to transfer the GitHub repository.

The intended end state is that LingoPure has operational ownership and administrative control of:
- GitHub
- Vercel
- Supabase
- production domains
- application secrets and credentials
- CI/CD
- production application data
- authentication
- storage
- deployment infrastructure

The migration is designed to be performed in controlled stages, with validation and rollback points between each stage.

No production migration or destructive change should be undertaken until this document has been reviewed and approved by Minh/LingoPure management.

## 2. Executive summary

The current LingoPure application is distributed across infrastructure controlled by Dennis/CAS.

The proposed migration is:

**CURRENT STATE**
CAS / Dennis
├── GitHub
│   └── caistech/LingoPureAI
├── Vercel
│   └── lingo-pure-ai
├── Supabase
│   └── nbvprbaumwmfczsfcyrv
├── Domains / DNS
└── CI/CD credentials

**MIGRATION**

**TARGET STATE**
LingoPure
├── GitHub
│   └── LingoPure/LingoPureAI *(Note: Repository mirrored instead of transferred)*
├── Vercel
│   └── LingoPure-owned project
├── Supabase
│   └── LingoPure-owned project
├── Production domain
│   └── LingoPure-controlled
└── CI/CD + production credentials
    └── LingoPure-controlled

The migration should not be treated as one large cutover.
It should be performed as a series of independently validated stages:
- Approval and preparation
- GitHub copy/replication
- LingoPure Vercel environment creation
- LingoPure Supabase environment creation
- Database/authentication/storage migration
- Vercel → Supabase integration
- Domain/DNS migration
- Production cutover
- Post-cutover validation
- Decommissioning of superseded CAS infrastructure

## 3. Important architectural boundary

There is an important distinction between LingoPure application ownership and the CAS shared technology substrate.

The LingoPure application currently consumes private @caistech/* packages from the CAS GitHub Packages registry.

The proposed infrastructure migration does not automatically require those packages to be renamed or forked.

The initial proposed architecture is therefore:
- LingoPure-owned application
- LingoPure GitHub
- LingoPure Vercel
- LingoPure Supabase
- LingoPure domain
- ↓
- LingoPure application
- ↓
- @caistech/* shared packages
- ↓
- CAS cais-shared-services

This means:
- LingoPure owns and operates its product and infrastructure while continuing, initially, to consume the shared CAS technology substrate.
- A future decision can determine whether the packages themselves should be carved out and transferred to LingoPure.
- That decision should be treated separately because combining a package/substrate migration with the infrastructure migration materially increases risk.

## 4. Decisions requiring approval

Before execution, Minh/LingoPure should explicitly approve the following.

| Decision | Proposed position |
|---|---|
| GitHub ownership | Mirror application repository to LingoPure GitHub organisation *(Note: Original retained in CAS)* |
| Vercel ownership | Create/use LingoPure-owned Vercel team/account |
| Supabase ownership | Create/use LingoPure-owned Supabase organisation/project |
| Supabase data strategy | **Path A — clean greenfield rebuild** from `supabase/migrations/` (schema + seed only; existing production data is NOT carried over) |
| Production domain | Move to LingoPure-controlled domain/DNS |
| CI/CD | Move required secrets and variables to LingoPure-controlled GitHub/Vercel environments |
| Application database | Migrate from CAS Supabase to LingoPure Supabase |
| Authentication | Migrate/validate as part of Supabase migration |
| Storage | Migrate buckets, objects and policies |
| CAS shared packages | Remain CAS-owned initially |
| @lingopure/* package carve-out | Not part of this migration unless separately approved |
| Old CAS infrastructure | Retain temporarily for rollback, then decommission after agreed stability period |

## 5. Current-state inventory

| Component | Current state |
|---|---|
| GitHub repository | caistech/LingoPureAI |
| Target GitHub repository | LingoPure/LingoPureAI |
| Vercel team | New LingoPure-owned project — TBD (Phase 3) |
| Supabase project | **TBD — new LingoPure-owned project** (Phase 4). Do NOT use `htycbbjbhokaztvtwvdo` (that project belongs to `LingoPure/purelingo-app`, an unreachable/phantom production repo — out of scope) |
| Shared packages | @caistech/* |
| Shared package source | caistech/cais-shared-services |
| Package registry | GitHub Packages |
| Application source | Next.js |
| Package manager | npm / package-lock.json |
| CI/CD | GitHub Actions + Vercel |
| Authentication | Supabase Auth |
| Production domain | To be confirmed as part of migration |
| Existing application data | Current CAS Supabase project |

## 6. Target ownership model

The desired final state is:

| Asset | Target owner |
|---|---|
| LingoPure GitHub organisation | LingoPure |
| LingoPure application repository | LingoPure |
| GitHub Actions | LingoPure |
| GitHub repository secrets | LingoPure |
| Vercel organisation/team | LingoPure |
| Vercel project | LingoPure |
| Vercel environment variables | LingoPure |
| Production domain | LingoPure |
| DNS | LingoPure |
| Supabase organisation | LingoPure |
| Supabase production project | LingoPure |
| Application database | LingoPure |
| Supabase Auth | LingoPure |
| Supabase Storage | LingoPure |
| Production credentials | LingoPure |
| CAS shared services | CAS |
| cais-shared-services | CAS |
| @caistech/* packages | CAS initially |

## 7. Migration principles

The migration should follow these principles:

### 7.1 No unnecessary production downtime
The existing production system remains operational while the new LingoPure infrastructure is prepared.

### 7.2 Build before cutover
The new GitHub/Vercel/Supabase environment should be constructed and tested before production DNS or application traffic is moved.

### 7.3 Preserve rollback
The current CAS environment should not be deleted immediately.
It becomes the rollback environment until the new LingoPure environment has operated successfully for an agreed period.

### 7.4 Validate each layer independently
GitHub, Vercel, Supabase, authentication, storage, email, application functionality and DNS should each be validated separately.

### 7.5 No credential sharing where avoidable
LingoPure should receive its own credentials and administrative access.
Dennis should not remain the operational dependency for routine LingoPure production administration.

## 8. Phase 0 — Approval and preparation

Estimated time: 30–60 minutes

No production changes occur during this phase.

### 8.1 Confirm LingoPure accounts
Before migration begins, confirm that LingoPure has:
- GitHub organisation
- GitHub organisation owner
- Vercel account/team
- Vercel billing/plan
- Supabase organisation
- Supabase billing/plan
- domain/DNS access
- required administrators

### 8.2 Confirm personnel
At least one LingoPure administrator should have administrative access to:
- GitHub
- Vercel
- Supabase
- DNS/domain
- production email/integration services where applicable

### 8.3 Create migration backups
Before modifying production:
- database backup
- storage inventory
- configuration inventory
- environment variable inventory
- GitHub repository backup
- Vercel configuration inventory
- Supabase configuration inventory

### 8.4 Record current production state
Record:
- current Git commit
- current Vercel deployment
- current Supabase project
- current production domain
- current environment variables
- current package versions
- current database migration state

### 8.5 Migration approval gate
**STOP HERE.**
Minh/LingoPure approves the migration plan before execution continues.

## 9. Phase 1 — GitHub migration

Estimated time: 15–30 minutes

### 9.1 Pre-migration repository check
The current repository contains:
- full Git history
- current branches
- GitHub Actions
- Dependabot configuration
- private @caistech/* package dependencies

**Completed Pre-requisite:**
The privacy disclosure fix (`f573ebb`) has been successfully merged and pushed to `origin/main` (commit `2619fbe`). The working tree is clean and ready for replication.

### 9.2 Mirror Repository to LingoPure
To ensure zero risk to the current environment while enabling full LingoPure control, we will execute a **Mirror Copy** (pushing to a new empty repo) rather than transferring the repository.

**Commands for Dennis:**
```bash
# 1. Create the new empty private repo under the LingoPure org
gh repo create LingoPure/LingoPureAI --private

# 2. Add LingoPure repo as a remote 
git remote add lingopure https://github.com/LingoPure/LingoPureAI.git

# 3. Push ALL branches, tags, and historical refs
git push lingopure --all
git push lingopure --tags

# 4. Remove the remote once complete
git remote remove lingopure
```

Target:
https://github.com/LingoPure/LingoPureAI

### 9.3 Repository validation
Confirm `LingoPure/LingoPureAI` contains:
- `main` branch
- Git history
- branches required for development
- tags
- Actions workflows
- Dependabot configuration

### 9.4 Access
Dennis will retain access to the CAS repo. LingoPure should verify they have full administrative access to their new copy.

## 10. Phase 2 — GitHub Actions and package access

Repository copying does not automatically transfer organisation-level secrets.
The following must be recreated under the LingoPure GitHub organisation or repository as appropriate.

### 10.1 Actions secrets
| Secret | Purpose |
|---|---|
| CAISTECH_PACKAGES_TOKEN | Private @caistech/* package installation |
| GITHUB_PACKAGES_TOKEN | GitHub Packages access |
| NEXT_PUBLIC_SUPABASE_URL | Supabase connection |
| SUPABASE_SERVICE_ROLE_KEY | Server-side Supabase access |
| QA_TEST_USER_ID | Voice/memory-loop testing |
| CONVAI_TOOL_SECRET | Voice webhook protection |
| ANTHROPIC_API_KEY | Claude workflow |
| GH_PAT | GitHub automation |
| EASY_CLAUDE_API_KEY | Easy-Claude-Code integration |

*The exact secret list should be revalidated against the current workflow files immediately before migration.*

### 10.2 Actions variables
| Variable | Purpose |
|---|---|
| PORTFOLIO_GATE_PREVIEW_URL | Portfolio gate smoke testing |

### 10.3 Dependabot
If Dependabot requires package credentials, recreate the relevant Dependabot secret separately.

### 10.4 Package authentication
The application currently consumes six private packages:
- @caistech/corporate-components
- @caistech/dataroom-core
- @caistech/elevenlabs-convai
- @caistech/sayfix-embed
- @caistech/webmcp-kit
- portfolio-gate package

The repository .npmrc uses NODE_AUTH_TOKEN.
No package token should ever be committed to the repository.

### 10.5 CI validation
Before proceeding:
- open a test PR
- execute GitHub Actions
- confirm npm ci
- confirm private package installation
- confirm gate workflow
- confirm no 401/403 errors

**GO / NO-GO CHECKPOINT**
GitHub must be operational before Vercel migration proceeds.

## 11. Phase 3 — Create LingoPure Vercel environment

Estimated time: 20–40 minutes

The existing Vercel project should not simply be transferred if the objective is full LingoPure infrastructure ownership.
Instead, prepare the LingoPure Vercel environment first.

### 11.1 Create/confirm LingoPure Vercel team
Confirm:
- LingoPure owns the team/account
- billing is controlled by LingoPure
- Minh has appropriate administrative access
- required developers have access

### 11.2 Create/import the project
Create/import the application as:
- `lingo-pure-ai`
Connect it to:
- `LingoPure/LingoPureAI`
Production branch:
- `main`

### 11.3 Recreate Vercel environment variables
The existing project currently contains values including:
- GITHUB_PACKAGES_TOKEN
- NODE_AUTH_TOKEN
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- ELEVENLABS_API_KEY
- ELEVENLABS_AGENT_ID
- ELEVENLABS_WEBHOOK_SECRET
- RESEND_API_KEY
- EMPLOYER_DEMO_PASSWORD
- HEYGEN_API_KEY
- NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID
- NEXT_PUBLIC_CANVAS_MODE
- ADMIN_EMAILS

The final list must be verified against the current production project before migration.
Each variable should be classified as:
- Development
- Preview
- Production

*Do not assume that a variable should automatically have the same value in all three environments.*

### 11.4 Vercel build configuration
Verify:
- Node version
- build command
- install command
- output configuration
- environment configuration
- Git integration
- production branch

*The application currently uses npm and package-lock.json.*

### 11.5 Preview deployment
Deploy the new LingoPure Vercel project without changing production DNS.
Validate:
- build
- application startup
- package installation
- Supabase connectivity
- authentication
- dashboard
- application routes
- voice
- investor functionality
- HR functionality

## 12. Phase 4 — Create LingoPure Supabase project

Estimated time: 30–60 minutes plus migration time

Create a new Supabase organisation/project controlled by LingoPure.
Preferably use the same geographic region as the existing project:
- Tokyo / Northeast Asia

### 12.1 Create target project
Record:
- project reference
- project URL
- anon key
- service-role key
- database connection information

*These credentials must be stored securely.*

### 12.2 Apply database schema — Path A (greenfield rebuild, APPROVED)

The source repository contains 29 versioned migration files in `supabase/migrations/`.

Approved approach: build the LingoPure database **from the migrations** on a fresh project — do NOT carry over the existing production data.

```bash
# From this repo, with the target project ref substituted:
supabase link --project-ref <NEW_LINGOPURE_REF>   # prompted for the NEW project's DB password
supabase db push                                    # applies all unapplied migrations in order
```

Verified properties of the migration set (2026-09-11):
- all 29 migrations are idempotent (`on conflict do nothing`, `create or replace function`)
- only 2 extensions required: `pgcrypto` and `vector` — both preavailable on any Supabase project (enabled inline in `0002`, `0020`)
- grants reference only standard roles (`authenticated`, `service_role`) — present on every fresh project
- fixed seed content is included: HR org + leave types (`0027`), battery prompts (`0017`), marketing content (`0024`/`0025`), dataroom bucket registration (`0020`)

Live production data does NOT exist in these migrations and is NOT carried over. What is lost under Path A:
- `auth.users` identities and passwords
- students, discovery sessions, gap scores, classroom schedules
- teacher/employer records, HR balances, leaves, calendar
- dataroom chunks and tier contents (NDA-gated files)
- storage objects (bucket is registered, files are not)

### 12.3 Post-push drift check

After `supabase db push`, spot-check the fresh schema against the migration set:
- confirm the migration history table matches 29 rows
- confirm RLS is enforced on the key tables (spot-check a few `0001`/`0006`/`0016` policies)
- confirm the `dataroom` bucket exists in Storage

### 12.4 Data migration — NOT APPLICABLE under Path A

There is no production data migration. The existing CAS project's data is superseded.
Any decision to re-bring data is a separate, explicitly approved task.

## 13. Phase 5 — Supabase Authentication migration

**CRITICAL**

Authentication must be treated separately from ordinary database migration.
The target environment must be tested for existing-user authentication before production cutover.

Review and migrate/configure:
- users
- identities
- authentication providers
- email configuration
- redirect URLs
- site URL
- password reset
- magic-link authentication
- confirmation emails
- OAuth configuration if applicable

The current application uses:
- `supabase/config.toml`

and currently references:
- `lingo-pure-ai.vercel.app`

*These settings must be reviewed and updated as part of the final domain migration.*

**Path A note:** because the LingoPure DB is rebuilt greenfield from migrations (`supabase db push`), the target's Auth/email SMTP, confirmations and site URL are configured on the fresh LingoPure project directly — they are not inherited from the paused CAS project.

**Authentication acceptance test**
At minimum test:
- existing user sign-in
- new user signup if enabled
- magic link
- password reset
- redirect after authentication
- dashboard access
- logout/login cycle

*No production cutover should occur until this passes.*

## 14. Phase 6 — Supabase Storage migration

Inventory all storage buckets.
For each bucket migrate/validate:
- bucket name
- public/private setting
- objects
- metadata
- policies
- access controls

Test application functions that read/write storage.

## 15. Phase 7 — Other Supabase services

Inventory and migrate any:
- Edge Functions
- webhooks
- database webhooks
- scheduled functions
- cron jobs
- secrets
- extensions
- integrations

*These should not be assumed from the database schema.*

## 16. Phase 8 — Connect LingoPure Vercel to LingoPure Supabase

Once the new Supabase environment has been validated:
Update the LingoPure Vercel project.
Required variables include:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Also update relevant GitHub Actions secrets.
Then deploy again.

**Validation**
Confirm:
- application connects to new Supabase
- existing user can authenticate
- dashboard loads
- application data appears correctly
- writes work
- storage works
- voice functionality works
- investor functionality works
- HR functionality works

## 17. Phase 9 — Production domain migration

The current Vercel URL may continue to be used temporarily during migration.
The final production environment should use a LingoPure-controlled domain, for example:
- `app.lingopure.com`

or another domain/subdomain selected by LingoPure.

**Before DNS cutover**
Configure the new domain in LingoPure Vercel.
Verify:
- SSL
- DNS
- Vercel domain configuration
- Supabase site_url
- Supabase redirect URLs
- authentication callback URLs
- email links
- password-reset URLs
- application configuration
- third-party callbacks

**DNS cutover**
Only after the new Vercel + Supabase environment passes the complete test suite:
- change DNS
- wait for propagation
- validate HTTPS
- validate application
- validate authentication
- validate application integrations

*The old Vercel environment remains available during the agreed rollback period.*

## 18. Phase 10 — Production cutover

This is the formal GO/NO-GO point.

**Required checks**
- **GitHub**: LingoPure/LingoPureAI operational; main is up to date; CI passes; private packages install successfully; Dependabot configured.
- **Vercel**: LingoPure owns Vercel team; project connected to LingoPure GitHub; all production variables verified; production deployment green.
- **Supabase**: LingoPure owns Supabase project; schema validated; production data migrated; authentication validated; storage validated; policies validated; functions/webhooks validated.
- **Domain**: LingoPure owns domain/DNS; SSL active; Supabase redirects updated; authentication tested.
- **Application**: sign-in, dashboard, classroom, investor, HR, voice, email, storage, relevant external integrations.
- **Security**: production secrets are LingoPure-controlled; no credentials committed to repository; Dennis/CAS credentials are not required for routine operation.

## 19. Rollback plan

The migration should retain the current CAS infrastructure until the new environment is confirmed stable.

If a critical problem occurs:
1. Identify failure
2. Rollback DNS / deployment
3. Route traffic back to Existing CAS environment
4. Restore service

Rollback may involve:
- reverting DNS
- restoring previous Vercel deployment
- reconnecting the previous environment
- reverting Supabase application configuration

*The exact rollback mechanism should be documented immediately before production cutover.*

## 20. Post-cutover monitoring period

After successful cutover:
- Do not immediately delete the old CAS infrastructure.

Recommended approach:
- **Day 0**: Full production validation.
- **Days 1–3**: Monitor authentication, application errors, database errors, Vercel deployments, Supabase logs, email, voice, storage, external integrations.
- **Days 4–14**: Normal production monitoring. If stable, obtain final confirmation from LingoPure. Only then begin decommissioning the old CAS infrastructure.

*The precise retention period should be approved before cutover.*

## 21. Decommissioning CAS infrastructure

Once the migration has been stable for the agreed period:
- remove obsolete Vercel project/configuration
- remove obsolete CAS production secrets where appropriate
- remove obsolete DNS configuration
- revoke credentials no longer required
- document final infrastructure
- confirm LingoPure has administrator access everywhere
- retain required backups

**Path A note:** the old CAS project (`nbvprbaumwmfczsfcyrv`) is currently **paused (INACTIVE)** and its data is superseded under Path A. Its DB password is never needed again; it can remain paused and be deleted once the agreed retention/backup period has expired.

## 22. @caistech/* shared package decision

The current application consumes private CAS packages.

**Recommended initial position**
Continue using:
- `@caistech/*`
from:
- `caistech/cais-shared-services`

This avoids unnecessarily combining two major migrations.
The LingoPure application can therefore be independently hosted while continuing to consume the shared CAS technology layer.

**Future option**
If LingoPure eventually needs complete technical independence:
- `@caistech/*` → `@lingopure/*`

This would require a separate project covering:
- package extraction
- package repository creation
- scope changes
- package publishing
- source import changes
- .npmrc
- GitHub Actions
- Dependabot
- versioning
- testing

*This is not part of the current migration unless separately approved.*

## 23. Security and credential ownership

The target state must eliminate operational dependence on Dennis’s personal credentials.

LingoPure should control:
- GitHub organisation credentials
- Vercel credentials
- Supabase credentials
- domain/DNS credentials
- production API credentials
- application secrets
- deployment credentials

*Where CAS services remain dependencies, they should use appropriately scoped service credentials rather than personal credentials wherever practical.*

## 24. Known migration risks

| Risk | Mitigation |
|---|---|
| GitHub copy fails | Validate network access and tokens |
| GitHub Actions secrets disappear | Recreate under LingoPure |
| Private package installation fails | Validate CAISTECH_PACKAGES_TOKEN before Vercel cutover |
| Vercel build fails | Preview deploy before DNS migration |
| Supabase schema mismatch | Compare production schema against migrations |
| Production data superseded (Path A) | Explicitly approved — greenfield rebuild; no carry-over |
| Authentication breaks | Dedicated authentication migration/testing |
| Storage objects missing | Separate bucket/object migration and validation |
| Magic links fail | Update Supabase site/redirect URLs |
| DNS issues | Configure domain before cutover and retain old URL |
| Data loss | Full database/storage backup before migration |
| Application regression | Full production smoke-test checklist |
| Rollback required | Keep CAS infrastructure operational during transition |
| Scope creep into package migration | Keep @caistech/* migration separate |

## 25. Definition of Done

The migration is complete when:
- **Ownership**: LingoPure owns the GitHub repository, Vercel team/project, Supabase organisation/project, and controls production domains/DNS and credentials.
- **GitHub**: `LingoPure/LingoPureAI` exists; `main` is up to date; CI passes; private packages install; Dependabot works.
- **Vercel**: LingoPure Vercel project connected to LingoPure GitHub; Development/Preview/Production environments verified; all required environment variables recreated; production deployment green.
- **Supabase**: LingoPure project created; schema rebuilt from migrations (Path A); RLS policies validated; extension availability confirmed; Auth/email SMTP and site URL configured on the fresh project.
- **Domain**: LingoPure production domain configured; SSL verified; DNS cutover complete; Supabase redirects updated; magic links/password reset tested.
- **Application**: sign-in, dashboard, classroom, investor, HR, voice, email, storage, external integrations all validated.
- **Operational independence**: Minh can deploy, manage Vercel, manage Supabase, manage GitHub. LingoPure does not require Dennis for routine infrastructure administration. old CAS infrastructure retained only for agreed rollback period.

## 26. What is explicitly NOT part of this migration

Unless separately approved, this project does not include:
- redesigning the LingoPure application
- changing the application architecture
- rewriting the shared CAS substrate
- renaming @caistech/*
- creating @lingopure/*
- changing application functionality
- changing business logic
- changing the LingoPure product roadmap
- migrating unrelated CAS infrastructure
- transferring cais-shared-services

*The purpose of this migration is ownership and infrastructure separation, not product redevelopment.*

## 27. Reference — current repositories and infrastructure

| Resource | Current |
|---|---|
| Current repository | https://github.com/caistech/LingoPureAI |
| Target repository | https://github.com/LingoPure/LingoPureAI |
| LingoPure GitHub organisation | https://github.com/LingoPure |
| Current Vercel project | lingo-pure-ai (returned HTTP 402 on 2026-09-11 — disabled) |
| Current Vercel URL | https://lingo-pure-ai.vercel.app/ |
| Target Vercel project | **TBD — new LingoPure-owned project** (Phase 3) |
| Supabase (source, paused) | nbvprbaumwmfczsfcyrv |
| Target Supabase project | **TBD — new LingoPure-owned project** (Phase 4) |
| Supabase region (target) | Recommend Tokyo (ap-northeast-1), matching source |
| GitHub Packages | https://npm.pkg.github.com |
| Shared CAS repository | caistech/cais-shared-services |
| Supabase configuration | `supabase/config.toml` |

## 28. Key files requiring review before execution

The following files should be reviewed against the final migration checklist:
- `.github/workflows/gate.yml`
- `.github/workflows/health-sensors.yml`
- `.github/workflows/hr-module.yml`
- `.github/workflows/claude-code.yml`
- `.github/dependabot.yml`
- `package.json`
- `package-lock.json`
- `.npmrc`
- `supabase/config.toml`

*The final environment-variable and secret inventory should be generated from the actual current deployment/workflows immediately before execution rather than relying solely on this document.*

## 29. Execution responsibility

**Dennis**
Responsible for:
- preparing the source environment
- executing the repository copy (mirror push)
- providing current configuration/secret values securely
- assisting with migration
- troubleshooting migration issues
- maintaining rollback capability during transition

**Minh / LingoPure**
Responsible for:
- approving this migration plan
- creating/owning LingoPure infrastructure
- controlling LingoPure accounts and billing
- creating the target GitHub repo
- creating/owning Vercel environment
- creating/owning Supabase environment
- validating production environment
- approving production cutover
- taking ongoing operational ownership

## 30. Final approval

The migration should not begin until the following has been agreed:

**LingoPure Management Approval**
- Migration plan approved: ☐ Yes ☐ No ☐ Changes required
- GitHub migration approved: ☐ Yes ☐ No
- Vercel migration approved: ☐ Yes ☐ No
- Supabase migration approved: ☐ Yes ☐ No
- Production domain migration approved: ☐ Yes ☐ No
- Continue using CAS @caistech/* packages initially: ☐ Yes ☐ No ☐ Separate decision required

Approved by: ______________________________
Date: ______________________________
Comments / required changes:

## 31. Proposed execution sequence after approval

Once approved, the actual implementation sequence will be:
1. APPROVAL
2. BACKUP + INVENTORY
3. GITHUB COPY (Mirror Push)
4. GITHUB ACTIONS / SECRETS
5. CREATE LINGOPURE VERCEL
6. CREATE LINGOPURE SUPABASE
7. REBUILD SCHEMA FROM MIGRATIONS (Path A — `supabase db push`, no data carry-over)
8. CONFIGURE AUTH + STORAGE ON FRESH PROJECT (no migration — greenfield)
9. CONNECT VERCEL → NEW SUPABASE
10. FULL APPLICATION TEST
11. CONFIGURE LINGOPURE DOMAIN
12. GO / NO-GO
13. DNS / PRODUCTION CUT-OVER
14. MONITOR + VALIDATE
15. RETAIN OLD ENVIRONMENT FOR AGREED ROLLBACK PERIOD
16. DECOMMISSION CAS PRODUCTION INFRASTRUCTURE

The migration is complete only when LingoPure can operate, deploy, administer and recover the production application without depending on Dennis/CAS for routine infrastructure access.
