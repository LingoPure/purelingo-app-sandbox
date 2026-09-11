-- 0036: BPO Harness — artifact batch column (BH-005 re-measurement).
--
-- The Edge distinguishes baseline vs post-training artifact batches so the
-- §12 rollup and delta report can attribute improvement to training
-- (gap_scores.source='workplace_trained').

alter table public.workplace_artifacts
  add column if not exists batch text not null default 'baseline'
  check (batch in ('baseline', 'trained'));

-- Re-measurement query pattern: all artifacts for a batch, per employer.
create index if not exists workplace_artifacts_batch_idx
  on public.workplace_artifacts (employer_id, batch, created_at);