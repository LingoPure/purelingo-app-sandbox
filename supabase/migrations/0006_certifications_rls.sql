-- Step 10 — TrackTest CEFR exam integration.
-- The base certifications table (migration 0001) only has a self_select
-- policy. Students need to be able to schedule an exam (insert) and (in the
-- demo path) write the simulated result back to the same row (update).
-- Idempotent.

drop policy if exists "certifications_self_insert" on public.certifications;
create policy "certifications_self_insert"
  on public.certifications for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "certifications_self_update" on public.certifications;
create policy "certifications_self_update"
  on public.certifications for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create index if not exists certifications_status_idx
  on public.certifications (student_id, status);
