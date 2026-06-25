# Investor Dataroom Agent — Build Spec

> **Status:** Draft for review (2026-06-25). No code written yet.
> **Goal:** Give investors a gated portal where they can (a) **ask any question** about LingoPure
> and get a specific, cited answer instead of fossicking through 70 files, and (b) **generate any
> report / download** they need for their assessment (investment memo, DD summary, financials brief,
> etc.) as a branded PDF.
> **Pattern source:** the F2K-Projects "Morgan" reports agent (`F2K-Projects/src/app/admin/reports/*`,
> `src/lib/reports/*`). We port its *interaction + report-generation spine* and add the **RAG
> retrieval layer** F2K never needed (F2K queries DB tables; LingoPure must read unstructured docs).

---

## 0. The core design decision (read first)

F2K's reports agent is a **structured-query engine over Postgres tables**. The LLM composes a
Zod-validated `ReportQuerySpec` and a read-only executor runs *parameterised SQL*. There is **no
document reading**.

LingoPure's dataroom is **70 unstructured files / 116 MB** — PDFs, DOCX, an XLSX financial model,
and many image-only diagrams. So we keep F2K's spine but add retrieval:

- **Reuse from F2K:** the discovery→confirm→run voice/chat loop, `@caistech/ai-client` wiring,
  `@caistech/elevenlabs-convai` widget + text fallback, the Zod-spec safety boundary
  (LLM composes structured params, never raw SQL/queries), the client-side download UX.
- **New for LingoPure:** an **ingestion pipeline**, a **pgvector RAG index**, **citation-grounded
  answering**, **branded PDF export** (`@caistech/report-generator` — F2K only did CSV), and a
  **confidentiality-tiered, audited investor portal**.

### Locked decisions (2026-06-25)
1. **Surface:** dedicated **gated investor portal at `/investor`** — investors as a third audience
   alongside student/employer. Each investor = an account + an access grant. Full audit + watermarking.
2. **Confidentiality:** **two tiers, gated by NDA** (confirmed by Daniel Maneveld, 2026-06-25:
   *"without NDA → main data room; with NDA → deep dive"*). `main` = the "LingoPure main documents"
   corpus — available to **any admitted investor, no NDA**. `restricted` = the "LP Deep Dive
   Documents" board-IC materials — unlocked **only after the investor executes an NDA**. The agent
   never surfaces restricted chunks (or even their existence) to an investor who hasn't accepted the
   NDA. **The NDA is the gate** (not a manual per-investor decision): accepting it flips
   `max_tier` `main → restricted` and is recorded with a timestamp + NDA version for the audit trail.
3. **Embeddings:** **OpenAI `text-embedding-3-large` requested at `dimensions: 1536`** —
   `OPENAI_API_KEY` is already in the repo (used for Whisper). No new key, fast, cheap.
   *Why 1536, not the native 3072:* pgvector's ANN indexes (ivfflat/hnsw) cap at 2000 dims, so
   3072 can't be indexed; OpenAI's `dimensions` param truncates 3-large to 1536 with negligible
   quality loss and lets us use a proper HNSW index. (Decided during Phase 1 build.)
4. **Image captioning model:** **`claude-sonnet-4-6`** (vision) for the 25 image-only diagrams —
   strong vision at a fraction of Opus cost for a batch job; `ANTHROPIC_API_KEY` already present.
   Overridable via `VISION_MODEL`.

---

## 0a. Where it sits in the repo (structural awareness)

LingoPure wasn't designed for this — but it already has the **exact pattern** we need: a second
gated audience portal living *alongside* the student app. The investor agent is a **third audience**,
mirroring how `employer/` was added as a second.

**Precedent in the tree today:**
- `src/app/(app)/**` — the student app (route group, auth-gated).
- `src/app/employer/` + `src/app/employer/(authed)/**` — the **employer portal**: its own
  `login`, its own authed area, gated separately in `src/middleware.ts`.
- `src/lib/employer/**` — employer-only domain logic, kept out of the student code.
- `src/app/api/employer/**` — employer-only API routes.
- `src/app/api/convai/**` — the voice stack, **already wired** (token + webhook) → reused, not rebuilt.
- `supabase/migrations/0001…0019` — investor migration is the next number, **`0020`**.

**So the investor agent slots in as a sibling of `employer/`, touching almost nothing existing:**

```
src/
├ app/
│  ├ investor/                      ← NEW. mirrors src/app/employer/
│  │  ├ login/ · signup/ · forgot-password/      (invite-gated AuthForm)
│  │  └ (authed)/
│  │     ├ ask/                     ← Q&A agent  (requirement a)
│  │     ├ reports/                 ← report generator (requirement b)
│  │     ├ documents/               ← watermarked doc viewer
│  │     ├ nda/                     ← click-through NDA gate → unlocks deep-dive tier
│  │     └ settings/
│  ├ api/
│  │  └ investor/                   ← NEW. mirrors src/app/api/employer
│  │     ├ ask/ · reports/voice/ · reports/run/ · documents/ · nda/accept/
│  └ api/convai/                    ← REUSED as-is (voice token + webhook)
├ lib/
│  └ investor/                      ← NEW. mirrors src/lib/employer
│     ├ retrieval.ts · ask-prompt.mjs · report-spec.ts · build-report.ts
│     ├ ingest helpers · tiers.ts (NDA→tier mapping)
├ middleware.ts                     ← EDITED: add `/investor/*` matcher (one block, like employer)
└ ...
scripts/ingest-dataroom.mjs         ← NEW (one-off / re-runnable, not in the request path)
supabase/migrations/0020_investor_dataroom.sql   ← NEW
```

**Blast radius on existing code = one line of middleware + one nav entry.** Everything else is new
files under `investor/` namespaces. The student and employer apps are untouched. This is why adding
it here is cheap: the repo already proved the multi-audience shape with `employer/`, and the voice
plumbing is already live.

**Why it belongs here at all (Dennis's rationale, recorded):** (a) the dataroom corpus is *available*
in `docs/`, and (b) putting it in the live product lets investors *see where LingoPure is going* —
the agent is itself a demonstration of the product's own AI capability, not just a document chat.

---

## 1. Architecture (4 components)

```
                          ┌─────────────────────────────────────────────┐
  docs/                   │  1. INGESTION (scripts/ingest-dataroom.mjs)  │
  ├ LingoPure main docs ─►│  parse → caption images (Claude vision) →    │
  └ LP Deep Dive docs   ─►│  chunk → embed (OpenAI) → upsert pgvector     │
                          └───────────────────┬─────────────────────────┘
                                              ▼
                          ┌─────────────────────────────────────────────┐
                          │  Supabase: dataroom_documents, dataroom_chunks│
                          │  (pgvector), investor_grants, dataroom_audit  │
                          └───────────────────┬─────────────────────────┘
                          ┌───────────────────┴───────────────────┐
                          ▼                                        ▼
        ┌───────────────────────────────┐      ┌───────────────────────────────────┐
        │ 2. Q&A AGENT  (answers "a")   │      │ 3. REPORT GENERATOR (answers "b") │
        │ /investor/ask                 │      │ /investor/reports                  │
        │ question → retrieve(tier) →   │      │ discovery → ReportSpec → per-       │
        │ Claude answer + citations     │      │ section retrieve+synthesise →      │
        │ voice + text                  │      │ branded watermarked PDF/MD/CSV     │
        └───────────────────────────────┘      └───────────────────────────────────┘
                          └───────────────────┬───────────────────┘
                                              ▼
                          ┌─────────────────────────────────────────────┐
                          │ 4. PORTAL + ACCESS  (/investor)              │
                          │ investor auth · per-investor grant · tier    │
                          │ gating · audit every Q + download · watermark│
                          └─────────────────────────────────────────────┘
```

---

## 2. Supabase schema (new migrations)

Project ref `nbvprbaumwmfczsfcyrv`. Requires `create extension if not exists vector;`.
New migration `0020_investor_dataroom.sql` (idempotent, RLS on every table).

```sql
-- pgvector
create extension if not exists vector;

-- 2.1 Document registry (one row per source file)
create table dataroom_documents (
  id uuid primary key default gen_random_uuid(),
  source_file text not null unique,        -- relative path under docs/
  display_name text not null,
  category text not null,                  -- financial | legal | tech | gtm | market | team | cefr | ...
  confidentiality_tier text not null default 'main'  -- 'main' | 'restricted'
    check (confidentiality_tier in ('main','restricted')),
  format text not null,                    -- pdf | docx | xlsx | png | jpeg
  page_count int,
  content_hash text,                       -- skip re-ingest if unchanged
  ingested_at timestamptz,
  created_at timestamptz default now()
);

-- 2.2 Chunks (the RAG index)
create table dataroom_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references dataroom_documents(id) on delete cascade,
  confidentiality_tier text not null,      -- denormalised from parent for fast filtering
  page int,
  chunk_index int not null,
  content text not null,                   -- text, or Claude-vision caption for image docs
  is_vision_caption boolean default false,
  embedding vector(1536),                  -- text-embedding-3-large @ dimensions=1536
  created_at timestamptz default now()
);
create index on dataroom_chunks using hnsw (embedding vector_cosine_ops);
create index on dataroom_chunks (confidentiality_tier);

-- 2.3 Investors + access grants
create table investors (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, firm text, email text not null,
  max_tier text not null default 'main' check (max_tier in ('main','restricted')),
  -- NDA gate (Dan, 2026-06-25): no NDA → 'main' only; accepting the NDA flips to 'restricted'.
  nda_accepted_at timestamptz,             -- null = no NDA yet = main only
  nda_version text,                        -- which NDA text they accepted
  nda_signer_name text,                    -- typed name at acceptance (click-through execution)
  status text not null default 'active',   -- active | revoked
  invited_by text, created_at timestamptz default now()
);

-- 2.3b NDA acceptance ledger (durable record, even if a grant is later revoked)
create table investor_nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references investors(id) on delete cascade,
  nda_version text not null,
  signer_name text not null,
  ip_address text, user_agent text,
  accepted_at timestamptz default now()
);

-- 2.4 Audit (every question + every download) — confidentiality-critical
create table dataroom_audit (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references investors(id),
  action text not null,                    -- ask | answer | report_generate | download
  detail jsonb,                            -- question text, cited docs, report spec, file name
  created_at timestamptz default now()
);

-- 2.5 Generated reports (so investors can re-download; also audit trail)
create table dataroom_reports (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references investors(id),
  report_type text not null,
  spec jsonb not null,
  storage_path text,                       -- Supabase Storage path to the rendered PDF
  created_at timestamptz default now()
);
```

### Storage split — buckets vs tables (what goes where)
The raw dataroom is **not** "dumped" into one place. Two destinations, by purpose:

| What | Where | Why |
|---|---|---|
| **Original files** (PDF/DOCX/XLSX/PNG) | Supabase **Storage** — a **private** bucket `dataroom/`, mirroring the folder tree, with a `main/` and `restricted/` prefix | so `/investor/documents` can serve **watermarked, time-limited signed URLs** for viewing/download. Never public. |
| **Extracted text + vision captions** | table `dataroom_chunks.content` | this is what the agent searches — the bytes of a PDF aren't searchable, the text is. |
| **Embeddings** | `dataroom_chunks.embedding` (pgvector) | the actual RAG index. |
| **File metadata** (name, tier, category, hash) | `dataroom_documents` | registry + idempotent re-ingest. |

So: **buckets hold the files investors open; tables hold the searchable text + vectors the agent
reasons over.** Ingestion reads `docs/`, uploads each original to the bucket, and writes its
text/captions/embedding to the tables in the same pass.

**RLS:** investors read only their own `investors`/`dataroom_audit`/`dataroom_reports` rows.
`dataroom_chunks`/`dataroom_documents` are **never exposed to the client** — only the server
(service role) reads them, and only after the route has checked the caller's `max_tier`. The
retrieval SQL **always** filters `confidentiality_tier in (allowed tiers for this investor)`.

**Retrieval RPC** (`match_dataroom_chunks`) — a `SECURITY DEFINER` function taking
`query_embedding`, `allowed_tiers text[]`, `match_count int`; returns top-k by cosine distance
**within the allowed tiers only**. Tier filtering lives in the DB function so it can't be bypassed
by a route bug.

---

## 3. Ingestion pipeline (`scripts/ingest-dataroom.mjs`)

Re-runnable, idempotent (skips files whose `content_hash` is unchanged). Steps per file:

1. **Classify** tier + category from the folder + filename:
   - `docs/LingoPure main documents/**` → tier `main`
   - `docs/LP Deep Dive Documents/**` → tier `restricted`
   - category from a keyword map (cap table/ESOP/model → `financial`; contract/NDA/agreement → `legal`;
     telemetry/architecture/roadmap → `tech`; GTM/case study → `gtm`; etc.)
2. **Extract** by format:
   - **PDF** with a text layer → `pdf-parse` / `mupdf` (already a F2K devDep) per-page text.
   - **DOCX** → `mammoth` → text.
   - **XLSX** (financial model) → `xlsx` (SheetJS) → flatten each sheet to labelled rows
     (`Sheet: Revenue | Row: ARR 2027 = ...`) so figures are queryable.
   - **Image-only PDFs / PNG / JPEG** (the telemetry dashboards, architecture diagrams, friction
     charts) → **Claude vision** (`@caistech/ai-client`) → a structured caption: what the diagram
     shows, axes/labels, the claim it makes. Store as a chunk with `is_vision_caption = true`.
     *This is the part F2K had no analog for and is essential — a large fraction of the corpus is
     image-only.*
3. **Chunk** text ~800 tokens, ~120 overlap, page-aware (never split across a page boundary
   silently — keep `page` accurate for citations).
4. **Embed** each chunk with OpenAI `text-embedding-3-large` (batch).
5. **Upsert** `dataroom_documents` + `dataroom_chunks`; stamp `ingested_at` + `content_hash`.

Run: `node scripts/ingest-dataroom.mjs` (full) / `--only "<glob>"` (single file re-ingest).
Logs a summary: files, chunks, vision-captioned count, skipped-unchanged, any parse failures
(**no silent drops** — a file that fails to parse is reported, per the no-silent-caps rule).

---

## 4. Q&A agent — answers requirement (a)

### Route `POST /api/investor/ask`
1. Resolve investor from session → load `max_tier` + `status` (reject `revoked`).
2. Embed the question (OpenAI).
3. `match_dataroom_chunks(embedding, allowedTiers, 12)` — tier-filtered retrieval.
4. Build a grounded prompt: system instruction + the retrieved chunks (each tagged with its
   `display_name` + page) + the question.
5. Claude (`@caistech/ai-client`, Sonnet) answers **only from the chunks**, citing sources as
   `[display_name, p.N]`. **Degrade-don't-fake:** if the chunks don't contain the answer, it says so
   and suggests the closest available document — it does **not** invent figures.
6. Write `dataroom_audit` rows (`ask` + `answer` with cited doc ids).
7. Return `{ answer, citations: [{document_id, display_name, page}] }`.

### System prompt (sketch — `src/lib/investor/ask-prompt.mjs`)
```
You are the LingoPure investor analyst. Answer ONLY from the provided dataroom excerpts.
Every factual claim cites its source as [Document name, p.N]. If the excerpts do not contain
the answer, say so plainly and name the closest document the investor should open — never
estimate or fabricate a number. Be concise and specific; investors are assessing, not browsing.
Do not reveal the existence of documents outside the excerpts you were given.
```
(The last line matters: a `main`-tier investor must not learn restricted board-IC docs exist.)

### UI `/investor/ask`
- Chat transcript + input, citations rendered as clickable chips that open the source doc in the
  viewer (Supabase Storage signed URL, watermarked).
- **Voice**: the `@caistech/elevenlabs-convai` `VoiceWidget` (already in the repo) in
  `mode: "discovery"`, `textFallback: true` — same wiring as F2K's `ReportsVoiceAgent.tsx`.
  Persona "investor analyst"; the widget's text fallback POSTs to `/api/investor/ask`.
- Explanatory header (§5 standard), responsive, ≥44px targets.

---

## 5. Report generator — answers requirement (b)

This is the **direct F2K port**, swapping the DB executor for retrieval-synthesis.

### The spec (Zod — `src/lib/investor/report-spec.ts`, mirrors F2K `query-spec.ts`)
```ts
ReportSpec = {
  reportType: "investment_memo" | "dd_summary" | "financials_brief"
            | "traction_summary" | "team_and_captable" | "tech_defensibility"
            | "risk_register" | "custom",
  topic?: string,                 // free-text focus for dd_summary / custom
  sections: string[],            // ordered section headings to fill
  tier: "main" | "restricted",   // capped at the investor's max_tier server-side
  format: "pdf" | "markdown" | "csv",
}
```
A **capability manifest** (like F2K's `REPORT_CAPABILITIES`) lists the report types, their default
section sets, and what each draws on — so the discovery agent composes only within what the corpus
can actually support and declares gaps honestly.

### Discovery agent (`POST /api/investor/reports/voice`) — copy of F2K `reports/voice/route.ts`
Morgan-for-investors: discovery → reframe → confirm → emit a validated `ReportSpec`. Same
JSON-output contract (`{"reply": "...", "spec": null | ReportSpec}`), same defensive Zod validation,
same `@caistech/ai-client` client with OpenRouter→Anthropic fallback.

### Executor (`POST /api/investor/reports/run` → `src/lib/investor/build-report.ts`)
For each section heading: run a tier-filtered retrieval for that heading+topic, synthesise the
section from the chunks with citations, assemble a markdown document, then:
- `format: "pdf"` → **`@caistech/report-generator`** (markdown → branded PDF, with disclaimer +
  **per-investor watermark** "Confidential — prepared for {firm} {date}" + page numbers).
- `format: "markdown" | "csv"` → client-side blob download (F2K's `downloadCsv` pattern).
Store the PDF in Supabase Storage, write `dataroom_reports` + a `report_generate`/`download`
`dataroom_audit` row.

### Report catalogue (default section sets)
| Type | Default sections | Draws on |
|---|---|---|
| `investment_memo` | Thesis · Market · Product · Traction · Team · Financials · Risks · Ask | whole corpus |
| `dd_summary` | (topic-driven) Findings · Evidence · Open questions | topic retrieval |
| `financials_brief` | Revenue model · Unit economics · Projections · Cap table · Use of funds | financial + XLSX |
| `traction_summary` | Customers · Contracts · Reviews · Pipeline | legal + gtm + reviews |
| `team_and_captable` | Founders · Advisors · Cap table · ESOP | team + financial |
| `tech_defensibility` | Architecture · IP · LP-1000 telemetry · Roadmap | tech (incl. vision captions) |
| `risk_register` | Risks by category + mitigations | whole corpus |

### UI `/investor/reports`
Two doors, exactly like F2K's `admin/reports/page.tsx`:
1. **Voice/chat panel** (Morgan) for natural-language requests.
2. **Building-block form**: report-type dropdown → editable section list → format → "Generate".
Result view: rendered preview + **Download** (PDF/MD/CSV) + a "my reports" list (re-download from
`dataroom_reports`).

---

## 6. Portal, auth & access control (`/investor`)

- **Auth**: investors are a third Supabase-auth audience. New `/investor/login` + `/investor/signup`
  (invite-gated — investors are admitted, not open signup) using the canonical
  `@caistech/corporate-components` `AuthForm` (forgot-password, password visibility toggle,
  magic-link — full §2 auth pattern). Reset flow scoped to `/investor`.
- **Middleware**: extend `src/middleware.ts` — `/investor/*` requires auth + an `investors` row with
  `status='active'`. Admin grant management gated to operators.
- **Chrome** (§4): persistent left navbar on every `/investor` route — *Ask · Reports · Documents ·
  My downloads · Settings · Sign Out*. Collapses to a drawer on mobile.
- **Tier gating**: every retrieval + report capped at the investor's `max_tier`. A `main` investor
  literally cannot retrieve, cite, or learn of `restricted` chunks.
- **NDA gate (the tier unlock)**: an admitted investor lands on `main` immediately. The deep-dive
  (`restricted`) corpus is fronted by `/investor/nda` — a click-through NDA (display the NDA text →
  type full name → accept). `POST /api/investor/nda/accept` writes the ledger row, sets
  `nda_accepted_at` + flips `max_tier` to `restricted` (service-role; the client can't self-elevate),
  and audits it. Until then, deep-dive nav items are hidden and the corpus is invisible — matching
  Dan's rule: *no NDA = main only; NDA = deep dive*.
  - **NDA source text:** the real agreement already exists in the dataroom —
    `docs/LingoPure main documents/Legal/LINGOPURE NDA, NON-COMPETE, NON-CIRCUMVENTION AND
    INTELLECTUAL PROPERTY PROTECTION AGREEMENT.pdf`. Extract its text into
    `src/lib/investor/nda-text.ts` (versioned, e.g. `nda_version = "2026-06"`) so the gate displays
    the genuine LingoPure NDA, not a placeholder. Legal should confirm a click-through execution is
    acceptable for deep-dive access (vs. a counter-signed PDF) — if a wet/counter-signed copy is
    required, the gate captures the typed acceptance *and* flags the investor for operator
    counter-signing before `max_tier` flips.
- **Document viewer**: `/investor/documents` lists permitted docs by category; opening one serves a
  **watermarked**, time-limited Supabase Storage signed URL.
- **Audit**: every `ask`, `answer`, `report_generate`, `download` is logged with investor id —
  so we can show each investor exactly what they accessed, and detect anomalies.

---

## 7. Standards compliance (CAIS pre-ship gate)

| Standard | Plan |
|---|---|
| §1 Responsive | All `/investor` surfaces mobile-first; chat + form + tables reflow; ≥44px targets, ≥16px text. |
| §2 Auth pattern | `AuthForm` — forgot-password, visibility toggle, magic-link. |
| §4 Chrome + Settings | Persistent navbar + `/investor/settings` (Profile, Password, Sign-out-everywhere). |
| §5 Explanatory headers | Every surface: what it is / what to do / why it matters. |
| §6 Voice AI | `@caistech/elevenlabs-convai` widget on Ask + Reports (guide/clarifier function); BYOK not applicable (operator-run investor tool — note as a principled divergence). |
| §7 Metadata | Real `<title>` = "LingoPure — Investor Dataroom". |
| §9 Consequence clarity | Downloads state "watermarked, logged to your account" before the click. |
| §9 Confidentiality | NDAs/contracts/cap-table corpus → tier gating + audit + watermark are **release-blocking**, not polish. |
| Supabase | Migration via CLI to ref `nbvprbaumwmfczsfcyrv`; RLS on every table; service-role never client-side; retrieval RPC `SECURITY DEFINER` with tier filter. |
| `@caistech`-first | Consume `ai-client`, `elevenlabs-convai`, `report-generator`, `corporate-components` — no forks. |

> **Risk-tier note:** the corpus is signed contracts, NDAs, cap table, and PII. Treat access
> control + audit + watermarking with REGULATED-tier discipline — a `main` investor seeing a
> `restricted` board-IC figure, or an un-watermarked contract leaving the portal, is a security
> incident, not a bug.

---

## 7a. Canonical conformance — build to the canonicals on THIS pass (not retrofit)

The investor portal is a **new audience** bolted onto a repo that predates several canonicals. The
rule for this build: every new investor surface consumes the **same canonical** the rest of the
portfolio uses — we do not hand-roll an investor-specific auth/voice/chrome and "align it later."

| Surface | Canonical to consume (not fork) | Source |
|---|---|---|
| `/investor` auth (login/signup/forgot/reset) | `@caistech/corporate-components` **`AuthForm`** (theme-able, `extraFields`, token_hash callback) | `SHARED_SERVICES.md`; `[[project_canonical_auth_foundation]]` |
| Auth-email links | **`token_hash`** links (never ConfirmationURL/PKCE), callback handles token_hash first | `[[reference_auth_email_token_hash_canon]]` |
| Custom SMTP / templates / rate-limit | Resend custom SMTP + `rate_limit_email_sent` raised + branded templates, set via Management API | PRODUCT_STANDARDS §9 codicil |
| Voice (Ask + Reports clarifier) | **`@caistech/elevenlabs-convai`** server + `/react` `VoiceWidget`; memory loop per `VOICE_MEMORY_STANDARD` | PRODUCT_STANDARDS §6 |
| Chrome + Settings | persistent navbar + `/investor/settings` (Profile/Password/Notifications) + `profiles` table + trigger | PRODUCT_STANDARDS §4 |
| Audience segregation | treat investor as a **third dual-auth-style portal** — its own landing CTA, gated routes, cross-access protection | PRODUCT_STANDARDS §8.5 |
| QA accounts | the 4 standard accounts + `QA_TEST_USER_/ADMIN_*` env + `docs/TESTING.md` (incl. investor persona) | PRODUCT_STANDARDS §9.5 |

**Pre-ship gates (run BOTH portals — investor user + operator admin):** `/naive-tester` (investor
persona walks Ask + Reports + NDA gate), `/voice-auditor` (voice placement + working memory loop on
Ask/Reports), `/gtm-auditor` only if a public surface is added. Any ❌ is release-blocking.

> **Existing-repo conformance (actioned after the new functions are written).** The same canonicals
> are audited across LingoPure's *current* student + employer surfaces (auth flow, voice, admin/QA)
> in this pass — see the conformance audit report. Gaps there are remediated **after** the investor
> functions land, but the investor build reuses whatever is already conformant so we don't fork.

---

## 8. Build phases (sequencing)

1. **Phase 1 — Ingestion + index (foundation). ✅ DONE (2026-06-25).** `0020` applied + verified;
   `scripts/ingest-dataroom.mjs` (pdf v2 / SheetJS / Claude-vision, retry, ASCII-safe storage keys,
   idempotent). 68 docs / 387 chunks (59 main, 9 restricted). `scripts/retrieval-test.mjs` proves
   cited retrieval + the tier gate (zero restricted leak on a main-only query).
2. **Phase 2 — Q&A agent. ✅ DONE (code, core-verified, 2026-06-25).** Built to canonicals (raw
   `@anthropic-ai/sdk`/`openai`/`@supabase/ssr`, service-role only for the RPC, layout-level gate):
   `src/lib/supabase/admin.ts`, `src/lib/investor/{auth,retrieval,ask-prompt,answer}.ts`,
   `POST /api/investor/ask` (auth → server-derived tiers → retrieve → cited answer → audit ask+answer),
   `/investor/(authed)/ask` UI (lean canonical chrome + chat, responsive, ≥44px/≥16px) +
   `InvestorSignOut`. Typecheck + eslint clean; `scripts/answer-test.mjs` proves a grounded, cited
   Sonnet answer on the live index (degrade-don't-fake; even surfaced a real cap-table discrepancy).
   **Deferred to Phase 3:** live HTTP/auth end-to-end + the in-chrome voice clarifier (needs the
   investor auth flow + a QA investor account — G5).
3. **Phase 3 — Investor portal + auth + NDA tier gate. ✅ SPINE DONE (2026-06-25).** Built to repo
   canonicals (existing proven auth pattern — `@caistech` AuthForm adoption is gap G1, *blocked* by a
   broken corporate-components v0.3.0 install). Shipped: `/investor/login` (own actions, password +
   magic-link, redirectTo→/investor/ask) + shared `PasswordInput` (toggle, §2); `/investor` →
   login redirect; the **NDA click-through gate** (`/investor/nda` + `POST /api/investor/nda/accept`)
   that writes the acceptance ledger, flips `max_tier` main→restricted (service-role, never client),
   and audits it; tier-aware nav ("Unlock deep dive" only for main); `scripts/invite-investor.mjs`
   (operator provisioning); `docs/TESTING.md` (G5 — QA investor + Mode A/B). NDA text auto-generated
   from the real PDF (`nda-text.ts`, `scripts/gen-nda-text.mjs`). **Verified:** `next build` green
   (all routes compile), typecheck + eslint clean, and `scripts/phase3-verify.mjs` proves the
   provision→accept→escalate→restricted-unlock flow end-to-end (7/7) with cascade cleanup.
   **Phase 3b (deferred, stated):** documents viewer w/ watermarked signed URLs; full §4 Settings
   (Profile/Password/Notifications + `profiles` table); operator grant-admin UI; in-chrome voice
   clarifier (G3); AuthForm v0.5.1 adoption (G1); main-site landing investor CTA; browser HTTP
   login E2E (data-layer + build verified; browser pass per TESTING.md, /browse renderer caveat).
4. **Phase 4 — Report generator. ✅ DONE (code, engine-verified, 2026-06-25).** F2K pattern ported
   to narrative-over-RAG: `src/lib/investor/report-spec.ts` (Zod `ReportSpec` + capability manifest,
   8 report types), `build-report.ts` (per-section tier-filtered retrieve+synthesise in parallel,
   degrade-don't-fake), `report-pdf.ts` (**watermarked branded PDF via `pdf-lib`** — @caistech/
   report-generator unusable here, same broken-@caistech-dist blocker as G1). Routes:
   `POST /api/investor/reports/voice` (Morgan discovery → validated ReportSpec envelope),
   `…/reports/run` (build → store PDF in bucket → `dataroom_reports` row → audit report_generate),
   `…/reports/[id]/download` (ownership-checked signed re-download + audit). UI `/investor/reports`:
   two doors (Morgan chat + building-block form) + result + my-reports list. Nav updated.
   **Verified:** tsc + eslint clean, `next build` green, `scripts/report-test.mjs` synthesised 3
   sourced sections on live data + rendered a valid 4-page watermarked PDF. **CSV dropped**
   (narrative reports aren't tabular). **Deferred:** the ElevenLabs voice widget on the reports door
   (G3; the door is text-chat discovery meanwhile) + HTTP/auth E2E (data-layer + build verified).
5. **Phase 5 — Hardening. ✅ CORE DONE (2026-06-25).** `scripts/security-test.mjs` proves the
   release-blocking tier-leak invariant: a `main` investor leaks restricted on **0/5** deep-dive ask
   queries (5/5 positive control when allowed), the documents listing excludes all 9 restricted docs,
   and the download tier-check rejects every restricted doc for a main investor. Watermarking verified
   (`docs-test.mjs` + `report-test.mjs`); re-ingest idempotency verified (Phase 1); audit wiring in
   every route (fires on real HTTP). **G2 email-compliance = N/A** — the invite prints a magic link;
   no commercial email is sent (wire `@caistech/email-compliance` only if/when investor outreach
   emails are added). **Remaining (needs a deployment + headed browser, per `docs/TESTING.md`):**
   `/naive-tester` (investor persona, both portals) + `/voice-auditor` live passes — deferred to a
   deploy because `/browse` crashes on heavy Next pages.

---

## Build verdict (2026-06-25)

**Phases 1–5 + 3b are built and verified** against the live index/DB: ingest → ask → portal/auth/NDA
→ documents/settings → reports → tier-leak hardening. Every phase is `tsc` + `eslint` clean and
`next build` green, each proven by a `scripts/*.mjs` check. The two original asks are delivered:
investors can **ask cited questions** and **generate watermarked report downloads**, both NDA-tier-gated
and audited.

**Open (tracked, non-blocking for an internal/strategic tool):** browser tester gates (need a deploy);
operator grant-admin UI; `@caistech/corporate-components` AuthForm + `@caistech/report-generator`
adoption (G1 — blocked by a broken v0.3.0 install); in-chrome ElevenLabs voice clarifier (G3);
Notifications/`profiles` table (the investors row serves as the profile). The `SUPABASE_ACCESS_TOKEN`
env mis-set to a `vcp_` token remains for the operator to fix/rotate.

---

## 9. Env vars & dependencies

**Already present in LingoPure:** `OPENAI_API_KEY` (embeddings + vision-fallback unnecessary — use
Claude vision), `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ELEVENLABS_*`, `@caistech/ai-client`-relevant config.

**To add:**
- `@caistech/report-generator` (branded PDF) — new dependency.
- `@caistech/ai-client` — add (LingoPure currently uses `@anthropic-ai/sdk` directly; standardise).
- Embedding model env: `EMBEDDING_MODEL=text-embedding-3-large` (default).
- A new ElevenLabs investor agent id (or reuse the discovery agent with a per-surface prompt override,
  as F2K reuses Morgan): `NEXT_PUBLIC_ELEVENLABS_INVESTOR_AGENT_ID`.
- Parsing deps: `mammoth` (docx), `xlsx` (SheetJS); `mupdf`/`pdf-parse` for PDF.

---

## 9b. Canonical conformance audit — results (2026-06-25)

Read-only audit of LingoPure's *existing* student + employer surfaces vs the canonicals. Drives
two things: what the investor portal **reuses as-is**, and the **gap list actioned after** the
investor functions land.

**Already conformant → the investor portal REUSES these (do not re-fork):**
- **Dual-auth precedent (§8.5)** — the exact shape to mirror. `src/app/auth/callback/route.ts`
  (routes admin vs user, handles PKCE `code=` **and** `token_hash=` OTP), `src/lib/employer/auth.ts`
  (`loadEmployerAdmin` gate), `src/app/employer/(authed)/layout.tsx` (admin-only chrome gate),
  `src/middleware.ts` segregation. **→ investor mirrors `employer/` as a third audience.**
- **Auth page pattern (§2)** — login/signup/forgot/reset + magic-link + password toggle all present.
- **Auth-email = token_hash (canon)** — callback already token_hash-first. ✅
- **Chrome + Settings (§4)** — persistent navbar + drawer; `/settings` Profile/Password/Account;
  `on_auth_user_created` trigger (onto `students`). Reuse the layout + settings structure.
- **Voice memory loop (§6)** — `@caistech/elevenlabs-convai` v0.4.0 consumed; webhook HMAC-verified;
  recall→distil→persist loop wired (`convai_*` tables). Reuse the webhook + token-proxy pattern.
- **Email transport** — Resend (not the built-in mailer), verified sender. Reuse the wrapper.
- **Metadata (§7)** ✅. **SayFix** widget present.

**Gaps → ACTION AFTER the investor functions are written (tracked here, not patched ad hoc):**

| # | Gap | Canonical | Severity |
|---|---|---|---|
| G1 | `@caistech/corporate-components` installed (v0.3.0) but **auth forms are hand-rolled**; password toggle duplicated | adopt `AuthForm` + shared `PasswordInput` | high (fork-debt) |
| G2 | **No `@caistech/email-compliance`** — sends lack Spam Act footer / ABN / unsubscribe / jurisdiction guard | wire `withComplianceFooter` + `assertCompliant` | **blocking before ANY investor outreach** |
| G3 | **Voice not reachable from chrome** — only on `/onboarding/session` (>3 clicks); no FAB; no in-context clarifier | chrome-level `VoiceWidget` + clarifier | high (fails §0 gate) |
| G4 | **No `voice.config.ts`** — agent id is `ELEVENLABS_AGENT_ID` env, not wizard-scaffolded | `buildVoiceConfig`/`renderVoiceConfigModule` | med |
| G5 | **No `docs/TESTING.md`** + no QA accounts / `QA_TEST_USER_/ADMIN_*` / session-minter | §9.5 standard accounts | high (blocks `/naive-tester`) |
| G6 | `/dashboard` lacks an explanatory header (§5) | add header | low |
| G7 | No Notifications section in Settings; no canonical `profiles` table (uses `students`) | §4 — intentional single-operator deferral, record it | low |
| G8 | Team admin org/member layer absent (§8) | deferred until multi-operator | low (deferral) |
| G9 | Agent-readiness Layer 1 (`/llms.txt`, JSON-LD) absent (§11) | only if investor portal gets a public surface | low |

**Investor-portal package install list (from the audit):** `@caistech/corporate-components`
(use it this time, don't hand-roll), `@caistech/elevenlabs-convai` (have), `@caistech/sayfix-embed`
(have), **`@caistech/email-compliance`** (add — G2). Investor portal does **not** need
`abn-lookup`/`mapbox` (no ABN/address fields) unless a firm-profile form is added.

> **Sequencing per Dennis (2026-06-25):** the investor functions (Phases 1–4) are built **to the
> canonicals from the start** (§7a) — reusing the conformant assets above so we don't fork. The
> G1–G9 remediations on the *existing* student/employer surfaces are actioned **after** the investor
> functions are written, except **G2 (email-compliance) is blocking** the moment investor outreach
> emails are sent, and **G5 (TESTING.md/QA)** is required before the Phase-5 tester gates run.

---

## 10. Open risks / things to validate during the build

- **Image-heavy corpus:** a large share of the dataroom is image-only diagrams. Vision-captioning
  quality directly determines whether tech/telemetry questions can be answered — validate caption
  fidelity in Phase 1 on the LP-1000 telemetry + architecture PNGs before trusting them.
- **XLSX financial model:** flattening sheets to text is lossy for formula-driven figures; verify the
  key outputs (ARR, unit economics, projections) survive ingestion and are retrievable by name.
- **Embedding dimension:** resolved — `text-embedding-3-large` requested at `dimensions: 1536`
  (native 3072 exceeds pgvector's 2000-dim ANN cap); HNSW index on `vector(1536)`. Revisit only if
  retrieval quality on the real corpus proves the truncation lossy.
- **Image-only PDFs:** `pdf-parse` reads the text layer only; a scanned/image-only PDF (e.g. parts
  of the pitch deck) yields ~no text and is **reported, not dropped** (`lowTextPdfs` in the run
  summary). Phase-1 follow-up if any appear: render those pages to images and vision-caption them
  (needs `pdfjs` + a canvas backend) — deferred until the summary shows it's needed.
- **Tier leakage** is the headline security risk — the `SECURITY DEFINER` RPC + the "don't reveal
  documents outside your excerpts" prompt line + an explicit Phase-5 leak test together close it.
- **Lane fit:** this is an *internal/strategic* investor tool, not a lane-1 distributor product —
  BYOK + multi-tenant scale infra are out of scope; build the experience, not the platform.
```

---

## 11. Voice Morgan — the spoken clarifier (built 2026-06-26)

The investor makes a **conscious choice** at the top of "Ask the dataroom" (`/investor/ask`):

- **"Text only — I know what I need"** → the existing cited written analyst (`AskChat`), retained
  unchanged.
- **"Talk to Morgan — help me figure out what I need"** → the canonical portfolio voice surface.

**Morgan is a CLARIFIER, not a voice-RAG-answerer.** She helps an investor turn a broad interest
into the specific questions the dataroom can answer, then hands them to the cited written analyst
(one tap, same screen). This is deliberate and matches the canonical discovery-Morgan pattern (Aria
has no RAG tools either) — and it is the *secure* choice: ElevenLabs server-tools can't enforce the
main/deep-dive NDA tier (the tool body is LLM-filled and spoofable), so **only the authenticated
browser path (`/api/investor/ask`, server-tier-checked) ever emits tier-gated content.** A voice
call carries no confidential-data egress.

**Implementation (all `@caistech` substrate — no per-product re-fork):**
- **Surface:** `@caistech/elevenlabs-convai/react` `VoiceWidget` with `placement="fullpage"`,
  `avatarUrl="/female_avatar.jpeg"`, `coachName="Morgan"`, `transcript`, `textFallback`
  (`src/app/investor/(authed)/ask/investor-voice-morgan.tsx`). The conscious choice lives in
  `ask-mode.tsx`; the server page (`ask/page.tsx`) computes recall.
- **Auto-handoff (voice → cited answer):** the same component captures the investor's spoken
  questions (`onMessage` user turns) as one-tap candidates + an editable composer, and runs the
  chosen question through the authed `/api/investor/ask` (tier/NDA-gated, audited), rendering the
  cited answer inline. This closes path (b) — shape with Morgan, answer from the written analyst —
  with NO ElevenLabs tooling (pure browser, identity from the session). It carries a visible
  **confidentiality rationale**: the answer comes back as cited text (not spoken) because the
  dataroom is access-controlled across main + NDA-gated deep dive, so every question runs the same
  audited, tier-checked path — voice never bypasses the guardrail. (Voice-triggered document
  lookup / report generation remain deferred; Documents + Reports are already first-class nav pages.)
- **Agent:** provisioned by `scripts/provision-investor-morgan.mjs` via `provisionVoiceAgent`
  (idempotent; uses the workspace `ELEVENLABS_API_KEY` — **no operator key/agent-id hand-fetch**).
  Reuses the discovery agent's voice; allowlisted; shares the workspace post-call webhook bound to
  `/api/convai/webhook`. Sets `NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID`.
- **Memory loop** (VOICE_MEMORY_STANDARD): **recall** — `loadVoiceRecall()` reads prior calls via
  the `get_conversation_context` RPC and the page injects a welcome-back greeting as a per-session
  `firstMessage` override (degrade-don't-fake: fresh greeting on no history). **Persist** — the
  post-call webhook branches on the Morgan agent id, persists via `handlePostCallWebhook` and
  distils to `convai_memory` via `morganMemoryExtractor` (Anthropic). A `convai_agents` row is
  seeded so persistence doesn't hit "Agent not found".
- **Identity (server-trusted):** `VoiceWidget onConnect` → `POST /api/investor/voice/bind` (authed)
  writes `investor_voice_sessions(elevenlabs_conversation_id → investor_id)` (migration 0022); the
  post-call webhook resolves the investor from THIS binding, not the client-supplied `user_id`
  dynamic var — a tampered client can't write into another investor's memory.

**Go-live:** run the provision script, add `NEXT_PUBLIC_INVESTOR_MORGAN_AGENT_ID` to `.env.local` +
Vercel (plain, prod+preview), redeploy. Until the env var is present the "Talk to Morgan" tile shows
a graceful "use the text Ask" fallback.

**Known caveat:** `@elevenlabs/react` 1.3.0 has the iOS-Safari-18 `ConversationProvider` connect
bug (the same reason discovery uses raw `@elevenlabs/client` WebSocket). Acceptable for a
desktop-primary investor audience + `textFallback`; revisit if mobile investors hit it (the fix is a
hub-level `VoiceWidget` change, not per-product).
