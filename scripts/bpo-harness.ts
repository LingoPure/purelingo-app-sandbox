/**
 * BPO Harness Orchestrator — end-to-end workflow (BH-007).
 *
 * `npm run bpo:harness` runs the complete Phase 1→6 pipeline:
 *   1. Baseline generate (batch='baseline')
 *   2. Edge analyze + ingest (source='workplace')
 *   3. Trained generate (batch='trained')
 *   4. Edge analyze + ingest (source='workplace_trained')
 *   5. Intelligence rollup + delta printed to console
 *
 * `npm run bpo:harness:purge` removes the demo employer + all artifacts
 * for idempotent re-runs.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { generateSyntheticArtifacts } from "@/lib/bpo/generator";
import { analyzeWorkplaceArtifact } from "@/lib/bpo/edge";
import { ingestStructuredPackets } from "@/lib/bpo/ingest";
import { loadOrgIntelligence } from "@/lib/bpo/intelligence";

async function runHarness() {
  const supabase = createAdminClient();
  console.log("🚀 Starting BPO Harness orchestration...");

  // 1. Baseline generate
  console.log("📦 Generating baseline artifacts...");
  const baselineSeed = await generateSyntheticArtifacts(supabase, { batch: "baseline" });
  console.log(`   Employer: ${baselineSeed.employerId}, Agents: ${baselineSeed.agentCount}, Artifacts: ${baselineSeed.artifactCount}`);

  const { data: baselineArtifacts } = await supabase
    .from("workplace_artifacts")
    .select("*")
    .eq("employer_id", baselineSeed.employerId)
    .eq("batch", "baseline")
    .eq("analysis_status", "PENDING");

  if (baselineArtifacts && baselineArtifacts.length > 0) {
    console.log(`🔍 Analyzing ${baselineArtifacts.length} baseline artifacts...`);
    const packets = await Promise.all(baselineArtifacts.map(analyzeWorkplaceArtifact));
    const result = await ingestStructuredPackets(supabase, packets, "workplace");
    console.log(`   Observations: ${result.observation_count}, Scores: ${result.score_writes}, History: ${result.history_writes}`);
    if (result.failures.length > 0) console.log("   Failures:", result.failures);
  }

  // 2. Trained generate
  console.log("📦 Generating trained artifacts (batch 2)...");
  const trainedSeed = await generateSyntheticArtifacts(supabase, { batch: "trained" });
  console.log(`   Employer: ${trainedSeed.employerId}, Agents: ${trainedSeed.agentCount}, Artifacts: ${trainedSeed.artifactCount}`);

  const { data: trainedArtifacts } = await supabase
    .from("workplace_artifacts")
    .select("*")
    .eq("employer_id", trainedSeed.employerId)
    .eq("batch", "trained")
    .eq("analysis_status", "PENDING");

  if (trainedArtifacts && trainedArtifacts.length > 0) {
    console.log(`🔍 Analyzing ${trainedArtifacts.length} trained artifacts...`);
    const packets = await Promise.all(trainedArtifacts.map(analyzeWorkplaceArtifact));
    const result = await ingestStructuredPackets(supabase, packets, "workplace_trained");
    console.log(`   Observations: ${result.observation_count}, Scores: ${result.score_writes}, History: ${result.history_writes}`);
    if (result.failures.length > 0) console.log("   Failures:", result.failures);
  }

  // 3. Intelligence rollup + delta
  console.log("📊 Fetching intelligence rollup...");
  const report = await loadOrgIntelligence(supabase, baselineSeed.employerId);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("        §12 MANAGEMENT INTELLIGENCE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Employer: ${report.employer_id}`);
  console.log(`Overall Capability: ${report.overall_capability ?? "N/A"}`);
  console.log("\nBy Role:");
  for (const g of report.by_role) {
    console.log(`  ${g.metric}: ${g.overall ?? "N/A"}`);
  }
  console.log("\nBy Team:");
  for (const g of report.by_team) {
    console.log(`  ${g.metric}: ${g.overall ?? "N/A"}`);
  }
  console.log("\nCommon Gaps (worst-first):");
  for (const g of report.common_gaps.filter((x) => x.is_common_gap)) {
    console.log(`  ${g.skill}: mean=${g.mean}, gap=${g.gap} (target=${g.target})`);
  }
  console.log("\nTraining Demand (lowest-first):");
  for (const a of report.training_demand.slice(0, 3)) {
    console.log(`  ${a.name} (${a.role}/${a.team}): overall=${a.overall}`);
  }
  console.log("\nImprovement Trend:");
  console.log(`  Employer: ${report.improvement.employer ?? "N/A"}`);
  for (const [role, imp] of Object.entries(report.improvement.by_role)) {
    console.log(`  ${role}: ${imp}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n✨ Harness run complete.");
}

async function purgeHarness() {
  const supabase = createAdminClient();
  console.log("🧨 Purging BPO Harness data...");

  const { data: employer } = await supabase
    .from("employers")
    .select("id")
    .eq("name", "Acme Pacific BPO")
    .maybeSingle();

  if (!employer) {
    console.log("No demo employer found — nothing to purge.");
    return;
  }

  // Delete cascade: students → workplace_artifacts → gap_scores/history/observations
  await supabase.from("students").delete().eq("employer_id", employer.id);
  await supabase.from("workplace_artifacts").delete().eq("employer_id", employer.id);
  await supabase.from("gap_scores").delete().eq("source", "workplace");
  await supabase.from("gap_scores").delete().eq("source", "workplace_trained");
  await supabase.from("gap_score_history").delete().in("source", ["workplace", "workplace_trained"]);
  await supabase.from("workplace_observations").delete().eq("employer_id", employer.id);
  await supabase.from("employers").delete().eq("id", employer.id);

  console.log("✅ Purge complete.");
}

const cmd = process.argv[2];
if (cmd === "purge") {
  purgeHarness().catch(console.error);
} else {
  runHarness().catch(console.error);
}