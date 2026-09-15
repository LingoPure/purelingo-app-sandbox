-- 0049: classin_sessions — org/teacher read (C6 classes surface).
--
-- The base table (0001) + schedule fields (0004) only carry a student
-- self-SELECT policy, so a teacher could see their students but never their
-- classes. This completes the classin_sessions read story: an org-authorized
-- viewer (assigned teacher / owner / hr via org_can_view_student) can read a
-- learner's sessions through the USER-scoped client — exactly the 0045
-- teacher_notes pattern.
--
-- idempotent: safe to re-run. org_can_view_student is SECURITY DEFINER with a
-- pinned search_path (0038) and this policy does not call back into itself, so
-- there is no recursion.

drop policy if exists "classin_sessions_org_view" on public.classin_sessions;
create policy "classin_sessions_org_view"
  on public.classin_sessions for select to authenticated
  using (public.org_can_view_student(student_id));