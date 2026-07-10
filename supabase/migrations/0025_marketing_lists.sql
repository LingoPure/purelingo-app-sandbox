-- 0025_marketing_lists.sql
-- List-type marketing content: testimonials and client logos (CRUD + ordering +
-- draft/publish + image upload). Separate from the scalar marketing_content
-- (0024) because these are variable-length structured items with assets.
-- Draft = published:false (preview shows drafts; public shows published only).
-- Logos additionally require consent:true to display anywhere (legal gate).
-- Idempotent. Same content-role write boundary; audited via the shared trigger.

-- ── Testimonials ────────────────────────────────────────────────────────────
create table if not exists public.marketing_testimonials (
  id          uuid primary key default gen_random_uuid(),
  quote       text not null,
  name        text not null,           -- first name
  role        text,
  company     text,
  photo_url   text,
  published   boolean not null default false,
  sort_order  int not null default 0,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists marketing_testimonials_updated_at on public.marketing_testimonials;
create trigger marketing_testimonials_updated_at
  before update on public.marketing_testimonials
  for each row execute function public.update_updated_at();

alter table public.marketing_testimonials enable row level security;

-- Public sees PUBLISHED only; content editors see all (for preview/manage).
drop policy if exists "marketing_testimonials_read" on public.marketing_testimonials;
create policy "marketing_testimonials_read" on public.marketing_testimonials
  for select using (published = true or public.current_content_role() is not null);

drop policy if exists "marketing_testimonials_write" on public.marketing_testimonials;
create policy "marketing_testimonials_write" on public.marketing_testimonials
  for all to authenticated
  using (public.current_content_role() in ('marketing', 'admin'))
  with check (public.current_content_role() in ('marketing', 'admin'));

-- ── Client logos ────────────────────────────────────────────────────────────
create table if not exists public.marketing_logos (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  consent     boolean not null default false,   -- written consent to display
  published   boolean not null default false,
  sort_order  int not null default 0,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists marketing_logos_updated_at on public.marketing_logos;
create trigger marketing_logos_updated_at
  before update on public.marketing_logos
  for each row execute function public.update_updated_at();

alter table public.marketing_logos enable row level security;

drop policy if exists "marketing_logos_read" on public.marketing_logos;
create policy "marketing_logos_read" on public.marketing_logos
  for select using (published = true or public.current_content_role() is not null);

drop policy if exists "marketing_logos_write" on public.marketing_logos;
create policy "marketing_logos_write" on public.marketing_logos
  for all to authenticated
  using (public.current_content_role() in ('marketing', 'admin'))
  with check (public.current_content_role() in ('marketing', 'admin'));

-- ── Shared audit trigger for the list tables ────────────────────────────────
create or replace function public.log_marketing_list_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sect text := case tg_table_name
                 when 'marketing_testimonials' then 'testimonials'
                 when 'marketing_logos' then 'logos'
                 else tg_table_name end;
begin
  if tg_op = 'DELETE' then
    insert into public.marketing_content_audit (section, block_key, field, old_value, changed_by)
    values (sect, old.id::text, 'deleted', coalesce(old.name, ''), old.updated_by);
    return old;
  end if;
  insert into public.marketing_content_audit (section, block_key, field, new_value, changed_by)
  values (sect, new.id::text, lower(tg_op), coalesce(new.name, ''), new.updated_by);
  return new;
end;
$$;

drop trigger if exists marketing_testimonials_audit_trg on public.marketing_testimonials;
create trigger marketing_testimonials_audit_trg
  after insert or update or delete on public.marketing_testimonials
  for each row execute function public.log_marketing_list_change();

drop trigger if exists marketing_logos_audit_trg on public.marketing_logos;
create trigger marketing_logos_audit_trg
  after insert or update or delete on public.marketing_logos
  for each row execute function public.log_marketing_list_change();
