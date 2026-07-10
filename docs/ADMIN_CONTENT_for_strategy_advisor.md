# LingoPure — admin backend & content management, in code (update for the strategy advisor)

**Purpose.** A factual, code-grounded update on what the **admin backend + content-management** functionality now does in this repo, so the strategy advisor reasons from the real system, not a plan. Companion to `docs/REPO_REALITY_for_strategy_advisor.md` (the derived-layer / ClassIn update) and `docs/AUDIT_REPORT.md` (the Phase-A audit that scoped this). Built 2026-07-10; migrations `0023`–`0025` applied to the **Tokyo** DB (`nbvprbaumwmfczsfcyrv`, region `ap-northeast-1`).

---

## 1. One-line orientation

There is now a **row-backed marketing-content admin**: non-engineers edit the marketing site's copy, testimonials and client logos — with roles, invites, preview, publish and an audit trail — **without a developer or a deploy**. It is a **separate, global content role**, RLS-isolated from all learner/telemetry data. The audit that preceded it (`AUDIT_REPORT.md`) recommended "rows not files"; this is that, built.

---

## 2. Two admin surfaces exist — keep them distinct

1. **Content admin (NEW, `/admin/*`)** — the marketing-content backend below. Global (portfolio-level), gated by a `content_editors` role, touches **content only**.
2. **Investor dataroom admin (`/investor/admin/*`, existing)** — investor management, documents, cited Q&A, reports, access log; gated by the `ADMIN_EMAILS` operator allowlist (`lib/investor/operator-auth.ts`). Domain tool, unrelated to content. *(Separate brief: `docs/INVESTOR_ADMIN_BRIEF_for_Dan.md`.)*
3. **Employer cohort admin (`/employer/*`, existing)** — a customer's HR managing their learners (tenant-scoped, `employer_admins`). Learner data.

The content admin was built as a *separate* role precisely so marketing editors never touch (2) or (3).

---

## 3. Roles, invites, RLS (migration `0023`)

- **`content_editors`** table: roles `admin | marketing | readonly`, resolved for the current user by `current_content_role()` (SQL, matches by `user_id` OR email so a seeded admin works on first login). RLS: own-row read, admin reads all, **writes are service-role only**. The two operator emails are seeded as the first admins.
- **Invites** reuse the *exact* magic-link transport as the employer/investor invites (`/api/admin/content-editors/invite`, `sendContentEditorInviteEmail`) — an admin invites by email + role; the invitee gets a Resend magic link.
- **The boundary is RLS, not app code:** content roles have policies only on the content tables. The learner/telemetry tables (`gap_scores`, `discovery_sessions`, …) are RLS-scoped to `student_id = auth.uid()`, so a content editor — who is not a student — reads nothing there. *"Touch content, not the instrument"* holds by construction.

---

## 4. Row-backed editing: draft → preview → publish (migration `0024`)

- **`marketing_content`** — one row per editable copy block (`page`, `section`, `block_key` dotted-path), with **published** (`en`/`vi`) and **draft** (`draft_en`/`draft_vi`) columns + per-block `status`. Public read; **marketing/admin-only writes (RLS)**.
- **Overlay** (`src/content/resolve.ts`): `getHomeContent()` merges rows onto the static `src/content/home.ts` — the source file is the **seed + fallback**. The public page reads **published**; the gated `/preview` route renders the **same real component** from **drafts**. Un-edited blocks fall back to source, so the page always renders.
- **Editor** (`/admin/content`): block-by-block editing, English + Vietnamese side by side, per-block status, **Save draft → Preview → Publish** (`PUT /api/admin/content`, `POST /api/admin/content/publish`). The homepage JSX was extracted to `HomeView` so `/` (published) and `/preview` (draft) render identically.
- **Append-only audit** (`marketing_content_audit` + a definer trigger): every draft/status/publish change is recorded (who, what, old→new, when).

---

## 5. Testimonials & logos: CRUD + image upload (migration `0025`)

- **`marketing_testimonials`** and **`marketing_logos`** — variable-length structured items with images, ordering, and a `published` (draft-vs-live) boolean. **Logos additionally require `consent = true` to display anywhere** (the legal gate the clean-view patch established). Public sees published (+consent for logos); preview sees drafts.
- **Editors** (`/admin/testimonials`, `/admin/logos`): add/edit/delete, image upload, order, consent, draft→publish. Uploads go through `/api/admin/assets/upload` (service-role → a public `marketing-assets` bucket, 2 MB image cap). The public homepage now renders real testimonial cards + a logo strip, falling back to the pending empty slots when none exist (the section gating flips accordingly).
- **`/admin/audit`** — the change-history viewer (who/what/when/old→new), append-only.

---

## 6. Why this matters to the strategy conversation

- It's another piece of the portfolio **substrate** built once here (roles + invites + RLS + row-backed content + preview/publish + audit) — reusable across products, and consistent with the "own the capture/edit layer" posture.
- **Data residency:** all of it lives in **LingoPure's own Tokyo Supabase**, RLS-isolated — reinforcing the line for Dan that the derived/owned layer is in Japan, not the PRC.
- **Governance:** every content change is attributable and append-only-audited; the "pending is intentionally empty" discipline is enforced in the UI, not just docs — the same evidence-over-assertion posture the moat argument rests on.

**Not yet built (honest):** a live end-to-end editor click-through hasn't been exercised headlessly (it's behind auth); next/image optimisation for uploaded assets is deferred (plain `<img>` today); and the content admin has no bespoke `/settings`/team-admin layer yet (single-purpose operator tool).
