-- 0020_investor_dataroom.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Investor dataroom agent — the RAG index + access control + audit.
--
-- Investors are a THIRD audience (alongside students and employers). They get a
-- gated portal where they can (a) ask any question about LingoPure and get a
-- cited answer, and (b) generate reports — both grounded ONLY in the dataroom
-- corpus under docs/ (the investor dataroom + the deep-dive board materials).
--
-- Storage split:
--   - the ORIGINAL files (pdf/docx/xlsx/png) live in the private Storage bucket
--     'dataroom' (served to investors only as watermarked, time-limited signed
--     URLs).
--   - the EXTRACTED text + image captions + embeddings live in the tables below
--     (this is what the agent actually searches).
--
-- Confidentiality (Dan, 2026-06-25): no NDA -> 'main' corpus only; accepting the
-- NDA flips an investor to 'restricted' and unlocks the deep-dive corpus. Tier
-- filtering is enforced INSIDE the retrieval function so a route bug can't leak.
--
-- RLS posture: dataroom_documents/dataroom_chunks are NEVER client-readable
-- (RLS on, no policy -> only the service-role server reads them). Investors can
-- read only their OWN investors / audit / reports / nda rows. All writes happen
-- through the service-role client (bypasses RLS).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── 1. Document registry (one row per source file) ──────────────────────────
create table if not exists public.dataroom_documents (
  id uuid primary key default gen_random_uuid(),
  source_file text not null unique,        -- relative path under docs/
  display_name text not null,
  category text not null,                   -- financial | legal | tech | gtm | market | team | cefr | other
  confidentiality_tier text not null default 'main'
    check (confidentiality_tier in ('main','restricted')),
  format text not null,                     -- pdf | docx | xlsx | png | jpeg
  storage_path text,                        -- path in the 'dataroom' Storage bucket
  page_count int,
  content_hash text,                        -- skip re-ingest when unchanged
  ingested_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 2. Chunks (the RAG index) ───────────────────────────────────────────────
-- embedding dim 1536: text-embedding-3-large requested at dimensions=1536 so it
-- fits pgvector's ANN index limit while keeping 3-large's quality.
create table if not exists public.dataroom_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.dataroom_documents(id) on delete cascade,
  confidentiality_tier text not null        -- denormalised from parent for fast filtering
    check (confidentiality_tier in ('main','restricted')),
  page int,
  chunk_index int not null,
  content text not null,                     -- text, or a Claude-vision caption for image docs
  is_vision_caption boolean not null default false,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists dataroom_chunks_embedding_idx
  on public.dataroom_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists dataroom_chunks_tier_idx
  on public.dataroom_chunks (confidentiality_tier);
create index if not exists dataroom_chunks_document_idx
  on public.dataroom_chunks (document_id);

-- ── 3. Investors + the NDA-driven access tier ───────────────────────────────
create table if not exists public.investors (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  firm text,
  email text not null,
  max_tier text not null default 'main'
    check (max_tier in ('main','restricted')),
  -- NDA gate: null = no NDA yet = 'main' only. Accepting flips max_tier.
  nda_accepted_at timestamptz,
  nda_version text,
  nda_signer_name text,
  status text not null default 'active'
    check (status in ('active','revoked')),
  invited_by text,
  created_at timestamptz not null default now()
);

-- Durable NDA acceptance ledger (survives a later grant revoke).
create table if not exists public.investor_nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  nda_version text not null,
  signer_name text not null,
  ip_address text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

-- ── 4. Audit — every question + every download (confidentiality-critical) ───
create table if not exists public.dataroom_audit (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete set null,
  action text not null,                      -- ask | answer | report_generate | download | nda_accept | doc_view
  detail jsonb,                              -- question, cited docs, report spec, file name, etc.
  created_at timestamptz not null default now()
);
create index if not exists dataroom_audit_investor_idx
  on public.dataroom_audit (investor_id, created_at);

-- ── 5. Generated reports (re-download + audit trail) ────────────────────────
create table if not exists public.dataroom_reports (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete cascade,
  report_type text not null,
  spec jsonb not null,
  storage_path text,                         -- 'dataroom' bucket path to the rendered PDF
  created_at timestamptz not null default now()
);
create index if not exists dataroom_reports_investor_idx
  on public.dataroom_reports (investor_id, created_at);

-- ── 6. Private Storage bucket for the original files ─────────────────────────
insert into storage.buckets (id, name, public)
values ('dataroom', 'dataroom', false)
on conflict (id) do nothing;
-- No storage policies: clients get NO direct object access; the server issues
-- watermarked, time-limited signed URLs via the service role.

-- ── 7. Tier-filtered retrieval (the security boundary) ──────────────────────
-- SECURITY DEFINER so it can read the client-invisible chunk table, but the tier
-- filter lives INSIDE it. EXECUTE is revoked from clients (see grants below) so
-- an investor can't call it with allowed_tiers => ['main','restricted'] to self-
-- elevate — only the service-role server invokes it, passing the tiers the
-- caller's max_tier permits.
create or replace function public.match_dataroom_chunks(
  query_embedding vector(1536),
  allowed_tiers text[],
  match_count int default 12
)
returns table (
  chunk_id uuid,
  document_id uuid,
  display_name text,
  page int,
  content text,
  is_vision_caption boolean,
  confidentiality_tier text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    d.display_name,
    c.page,
    c.content,
    c.is_vision_caption,
    c.confidentiality_tier,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.dataroom_chunks c
  join public.dataroom_documents d on d.id = c.document_id
  where c.confidentiality_tier = any(allowed_tiers)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_dataroom_chunks(vector, text[], int) from public;
revoke all on function public.match_dataroom_chunks(vector, text[], int) from anon;
revoke all on function public.match_dataroom_chunks(vector, text[], int) from authenticated;
grant execute on function public.match_dataroom_chunks(vector, text[], int) to service_role;

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
-- Corpus tables: RLS on, NO policy => only service-role (which bypasses RLS) reads them.
alter table public.dataroom_documents enable row level security;
alter table public.dataroom_chunks    enable row level security;

-- Investor-owned tables: each investor reads only their own rows.
alter table public.investors                 enable row level security;
alter table public.investor_nda_acceptances  enable row level security;
alter table public.dataroom_audit            enable row level security;
alter table public.dataroom_reports          enable row level security;

drop policy if exists "investors_self_select" on public.investors;
create policy "investors_self_select" on public.investors
  for select to authenticated using (id = auth.uid());

drop policy if exists "investor_nda_self_select" on public.investor_nda_acceptances;
create policy "investor_nda_self_select" on public.investor_nda_acceptances
  for select to authenticated using (investor_id = auth.uid());

drop policy if exists "dataroom_audit_self_select" on public.dataroom_audit;
create policy "dataroom_audit_self_select" on public.dataroom_audit
  for select to authenticated using (investor_id = auth.uid());

drop policy if exists "dataroom_reports_self_select" on public.dataroom_reports;
create policy "dataroom_reports_self_select" on public.dataroom_reports
  for select to authenticated using (investor_id = auth.uid());

-- All inserts/updates (ingestion, audit writes, tier flips, report rows) go
-- through the service-role client, which bypasses RLS by design.
