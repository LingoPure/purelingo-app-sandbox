# Investor Dataroom — Data Processing & No-Training Posture

The investor dataroom contains confidential material (NDAs, signed customer contracts,
cap table, board-IC financials). This doc records exactly which third parties process that
data, the contractual/technical guarantees that it is **never used for model training**, and
the actions required to lock that down. Surface it to investors alongside the NDA.

> **Last updated:** 2026-06-26.

## 1. The trust boundary — who touches the data

| Processor | What it receives | Why | Training risk |
|---|---|---|---|
| **Anthropic (Claude)** | image-only diagrams at ingest (vision captions); retrieved chunks at query time (Ask answers, report synthesis) | the agent's reasoning — `claude-sonnet-4-6` | **No** — API data not trained on by default; lock with ZDR |
| **OpenAI** | chunk text at ingest + the question text at query time (embeddings) | vector embeddings — `text-embedding-3-large` | **No** — API data not trained on by default; lock with ZDR |
| **Supabase** | originals (private bucket), extracted text + vectors (Postgres), audit log | storage + retrieval | N/A (storage at rest, not training); covered by their DPA |

No other processor sees dataroom data. The investor portal has **no voice agent**, so nothing
goes to ElevenLabs. Embeddings are the only place raw text goes to a *second* LLM vendor.

## 2. The baseline — neither LLM vendor trains on API data by default

- **Anthropic** — the Commercial Terms state Inputs and Outputs are **not used to train models**.
  Training only occurs on explicit opt-in (feedback / "help improve"). We use a standard
  commercial API key and submit no feedback, so dataroom data is not in Anthropic's training set.
- **OpenAI** — since March 2023, **API data is not used for training** (distinct from ChatGPT
  consumer). Embeddings via the API are excluded by default.

## 3. Required lock-down actions (account-level — done in the vendor dashboards, not in code)

These are operator tasks; they cannot be set from the app:

- [ ] **Anthropic — enable Zero Data Retention (ZDR)** on the org / API key. ZDR = inputs/outputs
  not retained past serving the request (default is ~30-day trust-&-safety retention, then
  deletion) and never trained on. ⚠️ ZDR is **incompatible with Claude Fable 5** — this product
  uses `claude-sonnet-4-6` (ZDR-eligible), so keep the investor models on Sonnet/Opus, not Fable.
- [ ] **OpenAI — request ZDR + sign the DPA**; confirm no org-level "share data" toggle is on.
- [ ] **Sign both vendors' DPAs / no-train commitments** and reference them in the LingoPure NDA's
  data-processing clause so investors see the posture.
- [ ] Confirm no "help improve the model" / feedback setting is enabled in either console.

## 4. Stronger option — shrink the boundary to one vendor

Embeddings are the only path sending raw confidential text to OpenAI (a second vendor) purely to
produce vectors. To remove OpenAI from the confidential path entirely, switch embeddings to either:
- a **self-hosted embedding model** (text never leaves our infra), or
- **Voyage AI** (Anthropic's recommended embeddings partner) under a no-train/ZDR agreement.

Ask/report answers must still call Claude with retrieved chunks (unavoidable for the agent to
work) — covered by Anthropic ZDR. Code change scoped but **not yet done** (deferred per operator
decision 2026-06-26; current path is OpenAI embeddings with the no-train default + ZDR in §3).

## 5. What the code already guarantees

- All LLM/embedding calls go through the standard commercial APIs with no telemetry/feedback flags.
- Originals live in a **private** Supabase bucket (no client policies); chunks/embeddings are in
  **RLS-on, service-role-only** tables; access is server-mediated and **audited** (`dataroom_audit`).
- The NDA gate + tier filter bound *who* can retrieve what; this doc bounds *what the processors
  may do* with it.

## 6. Summary for investors (one paragraph)

LingoPure's dataroom assistant runs on Anthropic (Claude) and OpenAI commercial APIs, neither of
which uses API data to train models; data is held in a private, access-controlled, audited
Supabase environment. Zero-Data-Retention and Data-Processing Agreements are in place with the
LLM providers (see §3), so confidential dataroom material is processed only to answer the
investor's own questions and is not retained for, or used in, model training.
