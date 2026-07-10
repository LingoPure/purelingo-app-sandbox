-- 0026_qa_content_admin.sql
-- Seed the standard portfolio QA admin-agent (PRODUCT_STANDARDS §9.5) as a
-- content-admin editor so automated testers (/naive-tester) can walk the
-- content admin. Idempotent; matched by auth.users email if present, else a
-- user_id-null row that current_content_role() resolves by email on login.
insert into public.content_editors (user_id, email, role, accepted_at)
select u.id, e.email, 'admin', now()
from (values ('dennis+qaadmin@factory2key.com.au')) as e(email)
left join auth.users u on lower(u.email) = lower(e.email)
on conflict (email) do nothing;
