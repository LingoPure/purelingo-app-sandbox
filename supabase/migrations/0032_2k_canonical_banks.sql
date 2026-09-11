-- 0032: LingoPure 2K — versioned canonical data banks (ISS-019).
-- Parses diagnostic seeds (1,080 rows), realized interventions (432 rows),
-- and control/governance configurations from Dan's Master Recommendation banks.
-- All tables are read-only to all roles (no updates/deletes permitted).

-- ─── 1. LP-18 DIAGNOSTIC SEEDS (LP_REC_DB) ──────────────────────────────────
create table if not exists public.kb_diagnostic_seeds (
  seed_id text primary key,                       -- REC-{NNNN}-{LEVEL}-{CAP}-{ARCH}
  level text not null,                            -- A1.1 to C2.3
  capability text not null,                       -- LIS, VOC, GRM, SPK, RDG, INT
  capability_name text not null,                  -- e.g. "Listening", "Spoken Production"
  archetype text not null,                        -- CAPABILITY, AUTOMATICITY, etc.
  problem text not null,
  expected text not null,
  boundary text not null,
  telemetry_primary text not null,                -- t1
  telemetry_weight_primary numeric not null,      -- w1 (0-1 float)
  telemetry_secondary text,                       -- t2
  telemetry_weight_secondary numeric,             -- w2
  telemetry_tertiary text,                        -- t3
  telemetry_weight_tertiary numeric,              -- w3
  evidence_requirement text not null,             -- evidence
  counter_evidence text not null,                 -- counter
  do_not_infer text not null,                     -- dont
  reassessment_probe text not null,               -- probe
  solution text not null,
  origin text not null,                           -- CAPABILITY, etc.
  action_class text not null,                     -- CAPABILITY_BUILD, etc.
  created_at timestamptz not null default now()
);

-- ─── 2. CANONICAL INTERVENTIONS (CONTROL.canonical) ───────────────────────
create table if not exists public.kb_interventions (
  intervention_id text primary key,               -- LPIR-{LEVEL}-{CAP}-{FAMILY}-{NNNN}
  version text not null default 'v1.0',
  validation_status text not null,                -- e.g. "ENGINEERING_SEED"
  level_min text not null,                        -- LP18_MIN (A1.1 to C2.3)
  level_target text not null,                     -- LP18_TARGET
  capability_primary text not null,               -- CAPABILITY_PRIMARY (LIS, VOC, GRM, SPK, RDG, INT)
  capability_name text not null,                  -- CAPABILITY_NAME
  issue_family text not null,                     -- A through J
  issue_family_name text not null,                -- ISSUE_FAMILY_NAME (e.g. "Cognitive Load Gap")
  issue_definition text not null,                 -- ISSUE_DEFINITION
  severity_min text not null default 'S1',        -- SEVERITY_MIN
  severity_max text not null default 'S4',        -- SEVERITY_MAX
  context_types text not null,                    -- CONTEXT_TYPES
  modalities text not null,                       -- MODALITIES
  evidence_requirement text not null,             -- EVIDENCE_REQUIREMENT
  counter_evidence text not null,                 -- COUNTER_EVIDENCE
  do_not_infer_from text not null,                -- DO_NOT_INFER_FROM
  intervention_type text not null,                -- INTERVENTION_TYPE
  intervention text not null,                     -- INTERVENTION
  exercise text not null,                         -- EXERCISE
  exposure_frequency text not null,               -- EXPOSURE_FREQUENCY
  session_duration text not null,                 -- SESSION_DURATION
  expected_response text not null,                -- EXPECTED_RESPONSE
  expected_time_to_signal text not null,          -- EXPECTED_TIME_TO_SIGNAL
  success_threshold numeric not null,             -- SUCCESS_THRESHOLD
  failure_threshold numeric not null,             -- FAILURE_THRESHOLD
  reassessment_probe text not null,               -- REASSESSMENT_PROBE
  fast_response_branch text not null,             -- FAST_RESPONSE_BRANCH
  normal_response_branch text not null,           -- NORMAL_RESPONSE_BRANCH
  slow_response_branch text not null,             -- SLOW_RESPONSE_BRANCH
  regression_branch text not null,                -- REGRESSION_BRANCH
  upshift_rule text not null,                     -- UPSHIFT_RULE
  maintain_rule text not null,                    -- MAINTAIN_RULE
  downshift_rule text not null,                   -- DOWNSHIFT_RULE
  escalation_rule text not null,                  -- ESCALATION_RULE
  contraindications text not null,                -- CONTRAINDICATIONS
  rationale text not null,                        -- RATIONALE
  expected_state_transition text not null,        -- EXPECTED_STATE_TRANSITION
  priority_base_weight numeric not null,          -- PRIORITY_BASE_WEIGHT
  record_confidence numeric not null,             -- RECORD_CONFIDENCE
  metadata jsonb not null default '{}',           -- catch-all for remaining telemetry primary 1-3 etc.
  created_at timestamptz not null default now()
);

-- ─── 3. SYSTEM LAWS (SYSTEM_LAWS) ───────────────────────────────────────────
create table if not exists public.kb_system_laws (
  law_id integer primary key,                     -- sequence 1-18
  law_text text not null,
  created_at timestamptz not null default now()
);

-- ─── 4. CONTROL SYSTEM CONFIGURATIONS ───────────────────────────────────────
create table if not exists public.kb_score_bands (
  band_id text primary key,                       -- SB1 to SB6
  lp1000_band text not null,                      -- e.g. "Strategic Mastery"
  score_min integer not null,
  score_max integer not null,
  severity_multiplier numeric not null,
  recommendation_mode text not null,
  state_focus text not null,
  target_telemetry_delta numeric not null,
  exposure_multiplier numeric not null,
  reassess_observations integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_trajectory_moments (
  moment_id text primary key,                     -- M1 to M6
  trajectory_state text not null,                 -- e.g. "REGRESSION"
  urgency_multiplier numeric not null,
  action_mode text not null,
  action_rule text not null,
  guardrail text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_confidence_tiers (
  conf_id text primary key,                       -- C1 to C4
  confidence_tier text not null,                  -- e.g. "VERIFIED"
  score_min numeric not null,                     -- MIN (0-1 float)
  score_max numeric not null,                     -- MAX
  prescription_multiplier numeric not null,
  action_mode text not null,
  rule text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_prior_responses (
  response_id text primary key,                   -- R1 to R5
  prior_response text not null,                   -- e.g. "REGRESSING"
  dose_multiplier numeric not null,
  action_mode text not null,
  rule text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_j_subtypes (
  j_subtype_id text primary key,                  -- e.g. "TEMPORARY_DRIFT"
  j_subtype_code text not null,                   -- e.g. "TEMPORARY_DRIFT", "CONFOUND_PRESENT"
  created_at timestamptz not null default now()
);

-- ─── 5. ROW LEVEL SECURITY (READ-ONLY) ───────────────────────────────────────
alter table public.kb_diagnostic_seeds enable row level security;
alter table public.kb_interventions enable row level security;
alter table public.kb_system_laws enable row level security;
alter table public.kb_score_bands enable row level security;
alter table public.kb_trajectory_moments enable row level security;
alter table public.kb_confidence_tiers enable row level security;
alter table public.kb_prior_responses enable row level security;
alter table public.kb_j_subtypes enable row level security;

-- All authenticated and anonymous users can select/read (read-only reference).
-- No insert/update/delete policies are created — writes come solely from the
-- service role (seed loader) which bypasses RLS.
drop policy if exists "kb_diagnostic_seeds_read" on public.kb_diagnostic_seeds;
create policy "kb_diagnostic_seeds_read" on public.kb_diagnostic_seeds for select using (true);

drop policy if exists "kb_interventions_read" on public.kb_interventions;
create policy "kb_interventions_read" on public.kb_interventions for select using (true);

drop policy if exists "kb_system_laws_read" on public.kb_system_laws;
create policy "kb_system_laws_read" on public.kb_system_laws for select using (true);

drop policy if exists "kb_score_bands_read" on public.kb_score_bands;
create policy "kb_score_bands_read" on public.kb_score_bands for select using (true);

drop policy if exists "kb_trajectory_moments_read" on public.kb_trajectory_moments;
create policy "kb_trajectory_moments_read" on public.kb_trajectory_moments for select using (true);

drop policy if exists "kb_confidence_tiers_read" on public.kb_confidence_tiers;
create policy "kb_confidence_tiers_read" on public.kb_confidence_tiers for select using (true);

drop policy if exists "kb_prior_responses_read" on public.kb_prior_responses;
create policy "kb_prior_responses_read" on public.kb_prior_responses for select using (true);

drop policy if exists "kb_j_subtypes_read" on public.kb_j_subtypes;
create policy "kb_j_subtypes_read" on public.kb_j_subtypes for select using (true);

-- ─── 6. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists kb_diagnostic_seeds_level_cap_idx on public.kb_diagnostic_seeds(level, capability);
create index if not exists kb_interventions_level_min_cap_idx on public.kb_interventions(level_min, capability_primary);
create index if not exists kb_interventions_family_idx on public.kb_interventions(issue_family);
