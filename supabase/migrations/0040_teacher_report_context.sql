-- 0040: LingoPure — Teacher report context + 2K org-authorized reads.
--
-- Completes the §7 org wiring for the teacher intelligence report (A3):
--
--   1. `teacher_report_context(student_id)` — a SECURITY DEFINER resolver that
--      returns the full per-student context a report page needs: whether the
--      caller can view the student, the caller's org role, the caller's
--      teacher→student assignment link (if they are the assigned coach), the
--      student's current primary teacher, and the owning org identity.
--      This is the "teacher→student assignment link, not just the boolean
--      gate" layer from the C2 todo.
--
--   2. RLS SELECT policies on assessment_sessions / assessment_responses /
--      assessment_processing_events that let an org-authorized viewer
--      (owner/hr self / assigned teacher via `org_can_view_student`) read a
--      learner's 2K data through the USER-scoped client. Mirrors the HR
--      pattern exactly: the permission model lives in the database and
--      reading through the user client is what makes it true rather than
--      aspirational (src/lib/hr/deps.ts). Writes stay service-role only.
--
-- Idempotent: safe to re-run. SECURITY DEFINER pattern mirrors 0038 (pinned
-- search_path, stable, owner bypasses RLS — no per-table policy here calls
-- back into teacher_report_context, so no recursion).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. TEACHER REPORT CONTEXT ────────────────────────────────────────────────

create or replace function public.teacher_report_context(target_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'can_view', public.org_can_view_student(target_student_id),
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
    'student_name', (select s3.name from public.students s3 where s3.id = target_student_id),
    'target_level', (select s4.target_level from public.students s4 where s4.id = target_student_id),
    'native_language', (select s5.native_language from public.students s5 where s5.id = target_student_id),
    'employer_id', (select s6.employer_id from public.students s6 where s6.id = target_student_id),
    'organisation_id', (
      select e2.organisation_id
      from public.students s7
      join public.employers e2 on e2.id = s7.employer_id
      where s7.id = target_student_id
    ),
    'organisation_name', (
      select o.name
      from public.students s8
      join public.employers e3 on e3.id = s8.employer_id
      join public.organisations o on o.id = e3.organisation_id
      where s8.id = target_student_id
    ),
    'primary_teacher', (
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
    )
  )
$$;

-- ─── 2. 2K ORG-AUTHORIZED READS ───────────────────────────────────────────────
-- RLS policies are OR'd with the existing self-select policies; org-authorized
-- viewers (owner/hr, assigned teacher — decided by org_can_view_student) can
-- read a learner's sessions/responses/events through the USER client.

drop policy if exists "assessment_sessions_org_view" on public.assessment_sessions;
create policy "assessment_sessions_org_view"
  on public.assessment_sessions for select to authenticated
  using (public.org_can_view_student(learner_id));

drop policy if exists "assessment_responses_org_view" on public.assessment_responses;
create policy "assessment_responses_org_view"
  on public.assessment_responses for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_responses.assessment_id
       and public.org_can_view_student(s.learner_id)
  ));

drop policy if exists "assessment_processing_events_org_view" on public.assessment_processing_events;
create policy "assessment_processing_events_org_view"
  on public.assessment_processing_events for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions s
     where s.assessment_id = assessment_processing_events.assessment_id
       and public.org_can_view_student(s.learner_id)
  ));