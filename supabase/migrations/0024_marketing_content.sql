-- 0024_marketing_content.sql
-- Row-backed marketing content (the "rows not files" store) + an append-only
-- audit log. Content editors edit DRAFT columns; publishing promotes draft →
-- published (en/vi). The public page reads PUBLISHED; the gated preview reads
-- DRAFT. Idempotent.
--
-- Only content roles may write; the learner/telemetry tables are untouched (the
-- "touch content, not the instrument" boundary from 0023 still holds).

create table if not exists public.marketing_content (
  id          uuid primary key default gen_random_uuid(),
  page        text not null default 'home',
  section     text not null,
  block_key   text not null,              -- dotted path within the section, e.g. 'steps.0.h3'
  en          text,                       -- PUBLISHED English
  vi          text,                       -- PUBLISHED Vietnamese
  draft_en    text,                       -- working English
  draft_vi    text,                       -- working Vietnamese
  status      text not null default 'ready' check (status in ('ready', 'confirm', 'pending')),
  sort_order  int  not null default 0,
  meta        jsonb not null default '{}',
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (page, section, block_key)
);

create index if not exists marketing_content_page_idx on public.marketing_content (page);

drop trigger if exists marketing_content_updated_at on public.marketing_content;
create trigger marketing_content_updated_at
  before update on public.marketing_content
  for each row execute function public.update_updated_at();

alter table public.marketing_content enable row level security;

-- Published marketing copy is public — the server renders it via the anon client.
-- (Draft columns are technically readable via anon; acceptable for a noindexed
--  marketing draft. Column-level hardening can come with the domain purchase.)
drop policy if exists "marketing_content_public_read" on public.marketing_content;
create policy "marketing_content_public_read" on public.marketing_content
  for select using (true);

-- Only marketing/admin content roles may create or edit content rows.
drop policy if exists "marketing_content_editor_insert" on public.marketing_content;
create policy "marketing_content_editor_insert" on public.marketing_content
  for insert to authenticated
  with check (public.current_content_role() in ('marketing', 'admin'));

drop policy if exists "marketing_content_editor_update" on public.marketing_content;
create policy "marketing_content_editor_update" on public.marketing_content
  for update to authenticated
  using (public.current_content_role() in ('marketing', 'admin'))
  with check (public.current_content_role() in ('marketing', 'admin'));

-- ── Append-only audit log ───────────────────────────────────────────────────
create table if not exists public.marketing_content_audit (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid references public.marketing_content(id) on delete set null,
  page        text,
  section     text,
  block_key   text,
  field       text not null,             -- draft_en | draft_vi | status | en | vi
  old_value   text,
  new_value   text,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists marketing_content_audit_content_idx
  on public.marketing_content_audit (content_id);

alter table public.marketing_content_audit enable row level security;

-- Editors can READ the audit trail. No insert/update/delete policy for
-- authenticated → append-only; rows are written only by the definer trigger.
drop policy if exists "marketing_content_audit_read" on public.marketing_content_audit;
create policy "marketing_content_audit_read" on public.marketing_content_audit
  for select to authenticated
  using (public.current_content_role() is not null);

create or replace function public.log_marketing_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.draft_en is distinct from old.draft_en then
    insert into public.marketing_content_audit (content_id, page, section, block_key, field, old_value, new_value, changed_by)
    values (new.id, new.page, new.section, new.block_key, 'draft_en',
            case when tg_op = 'UPDATE' then old.draft_en end, new.draft_en, new.updated_by);
  end if;
  if tg_op = 'INSERT' or new.draft_vi is distinct from old.draft_vi then
    insert into public.marketing_content_audit (content_id, page, section, block_key, field, old_value, new_value, changed_by)
    values (new.id, new.page, new.section, new.block_key, 'draft_vi',
            case when tg_op = 'UPDATE' then old.draft_vi end, new.draft_vi, new.updated_by);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.marketing_content_audit (content_id, page, section, block_key, field, old_value, new_value, changed_by)
    values (new.id, new.page, new.section, new.block_key, 'status', old.status, new.status, new.updated_by);
  end if;
  if tg_op = 'UPDATE' and new.en is distinct from old.en then
    insert into public.marketing_content_audit (content_id, page, section, block_key, field, old_value, new_value, changed_by)
    values (new.id, new.page, new.section, new.block_key, 'en', old.en, new.en, new.updated_by);
  end if;
  if tg_op = 'UPDATE' and new.vi is distinct from old.vi then
    insert into public.marketing_content_audit (content_id, page, section, block_key, field, old_value, new_value, changed_by)
    values (new.id, new.page, new.section, new.block_key, 'vi', old.vi, new.vi, new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_content_audit_trg on public.marketing_content;
create trigger marketing_content_audit_trg
  after insert or update on public.marketing_content
  for each row execute function public.log_marketing_content_change();
