-- 0050: teacher_report_context — gate ALL target-derived fields on can_view.
--
-- SECURITY FIX uncovered by the C7 RLS DB-verify (test:org:db, first runnable
-- once Docker was available). Migration 0040's report-context RPC is SECURITY
-- DEFINER but returned the target student's identity unconditionally:
-- student_name, target_level, native_language, employer_id, organisation_id,
-- organisation_name and primary_teacher leaked to ANY caller who knew the
-- student uuid — a cross-org user got "Celadon BPO" and the coach's PII via
-- /teacher/students/[id]/report without any visibility gate. The can_view
-- boolean was consulted by the UI, but the RPC itself leaked the payload.
--
-- Fix: resolve can_view once up-front, then gate every target-derived field
-- on it, and strip null-valued keys from the emitted JSON so a denied viewer
-- gets NO identity/coach keys at all (jsonb_build_object would otherwise emit
-- "key": null, and a jsonb `null` literal still satisfies `-> key IS NOT
-- NULL` — the false sense of privacy). Fail-closed: can_view=false plus zero
-- target-derived keys. Caller-relative fields (viewer_user_id,
-- viewer_org_role, viewer_teacher_id, viewer_assignment_role) remain — they
-- describe the CALLER, never the target.
--
-- Idempotent: create or replace. Same SECURITY DEFINER pattern as 0040 (pinned
-- search_path, stable, no recursion).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.teacher_report_context(target_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select public.org_can_view_student(target_student_id) as can_view
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'can_view', c.can_view,
    'viewer_user_id', auth.uid(),
    'viewer_org_role', (
      select public.current_org_role(e.organisation_id)
      from public.employers e
      where e.id = (select s2.employer_id from public.students s2 where s2.id = target_student_id)
    ),
    'viewer_teacher_id', (
      select t.id
      from public.teachers t
      where t.auth_user_id = auth.uid()
        and exists (
          select 1 from public.student_teacher_assignments sta
          where sta.student_id = target_student_id
            and sta.teacher_id = t.id
            and sta.ended_at is null
        )
      limit 1
    ),
    'viewer_assignment_role', (
      select sta.assignment_role
      from public.student_teacher_assignments sta
      where sta.student_id = target_student_id
        and sta.teacher_id in (
          select t2.id from public.teachers t2 where t2.auth_user_id = auth.uid()
        )
        and sta.ended_at is null
      order by case when sta.assignment_role = 'primary' then 0 else 1 end
      limit 1
    ),
    'student_name', case when c.can_view then (select s3.name from public.students s3 where s3.id = target_student_id) else null end,
    'target_level', case when c.can_view then (select s4.target_level from public.students s4 where s4.id = target_student_id) else null end,
    'native_language', case when c.can_view then (select s5.native_language from public.students s5 where s5.id = target_student_id) else null end,
    'employer_id', case when c.can_view then (select s6.employer_id from public.students s6 where s6.id = target_student_id) else null end,
    'organisation_id', (
      select e2.organisation_id
      from public.students s7
      join public.employers e2 on e2.id = s7.employer_id
      where s7.id = target_student_id
        and c.can_view
    ),
    'organisation_name', (
      select o.name
      from public.students s8
      join public.employers e3 on e3.id = s8.employer_id
      join public.organisations o on o.id = e3.organisation_id
      where s8.id = target_student_id
        and c.can_view
    ),
    'primary_teacher', case when c.can_view then (
      select jsonb_build_object(
        'id', t3.id,
        'full_name', t3.full_name,
        'email', t3.email
      )
      from public.student_teacher_assignments sta2
      join public.teachers t3 on t3.id = sta2.teacher_id
      where sta2.student_id = target_student_id
        and sta2.assignment_role = 'primary'
        and sta2.ended_at is null
      limit 1
    ) else null end
  ))
  from ctx c
$$;