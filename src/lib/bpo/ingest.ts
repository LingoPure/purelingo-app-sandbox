/**
 * BPO Harness — structured packet ingestion (BH-003).
 *
 * Writes export-safe Edge packets into LingoPure Cloud:
 *   1. workplace_observations (append-only, artifact-scoped evidence sink)
 *   2. gap_scores upsert  (source = 'workplace', one row per student+skill+source)
 *   3. gap_score_history   (append-only trend trail, 0019)
 *
 * Runs through the service-role client: this is the backend-to-backend
 * Edge → Cloud exchange (Phase 6), not a learner session.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EdgeIntelligencePacket, CapabilityScore } from "@/lib/bpo/edge";
import { pseudonymousEmail } from "@/lib/bpo/generator";

export type AdminClient = SupabaseClient;

export interface IngestResult {
  observation_count: number;
  score_writes: number;
  history_writes: number;
  failures: string[];
}

/** Resolve the students.id for a pseudonymous agent (harness email mapping). */
async function resolveStudentId(
  admin: AdminClient,
  employerId: string,
  pseudonymousId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("students")
    .select("id")
    .eq("employer_id", employerId)
    .eq("email", pseudonymousEmail(pseudonymousId))
    .maybeSingle();
  if (error) return null;
  return data?.id ? String(data.id) : null;
}

/** Map a CapabilityScore list into per-skill scores for gap_scores writes. */
function skillScores(capabilityScores: CapabilityScore[]): Map<
  string,
  { score: number; confidence: number; capability: string }
> {
  const map = new Map<string, { score: number; confidence: number; capability: string }>();
  for (const c of capabilityScores) {
    if (c.confidence >= 0.5 && c.score > 0) {
      map.set(c.skill, { score: c.score, confidence: c.confidence, capability: c.capability });
    }
  }
  return map;
}

/**
 * Ingests one or more structured packets. Each packet becomes workplace_observation
 * rows plus a gap_scores upsert (source='workplace') and gap_score_history append.
 *
 * Idempotent by construction: observation rows key on observation_id (client UUID),
 * and the (student, skill, source) unique key makes the gap_scores upsert a no-op
 * when a row already exists.
 */
export async function ingestStructuredPackets(
  admin: AdminClient,
  packets: EdgeIntelligencePacket[],
  source: "workplace" | "workplace_trained" = "workplace"
): Promise<IngestResult> {
  const result: IngestResult = { observation_count: 0, score_writes: 0, history_writes: 0, failures: [] };

  for (const packet of packets) {
    const studentId = await resolveStudentId(admin, packet.employer_id, packet.pseudonymous_id);
    if (!studentId) {
      result.failures.push(
        `no student for employer=${packet.employer_id} pseudo=${packet.pseudonymous_id}`
      );
      continue;
    }

    // 1. workplace_observations (append-only)
    const rows = packet.evidence.map((e) => {
      const capPrefix = e.construct.split("-")[0].toUpperCase();
      const capScore = packet.capability_scores.find((c) => c.capability === capPrefix);
      return {
        observation_id: e.evidence_id,
        artifact_id: packet.provenance.artifact_id,
        employer_id: packet.employer_id,
        pseudonymous_id: packet.pseudonymous_id,
        construct: e.construct,
        observation: e.observation,
        status: e.status,
        authority: e.authority,
        confidence: e.confidence,
        capability: capPrefix,
        skill: capScore?.skill ?? null,
        source: { engine_version: packet.provenance.engine_version, packet_id: packet.packet_id },
      };
    });

    if (rows.length > 0) {
      const { error: obsErr } = await admin.from("workplace_observations").upsert(rows, {
        onConflict: "observation_id",
      });
      if (obsErr) {
        result.failures.push(`workplace_observations write failed: ${obsErr.message}`);
      } else {
        result.observation_count += rows.length;
      }
    }

    // 2+3. gap_scores + gap_score_history (per mapped skill)
    for (const [skill, s] of skillScores(packet.capability_scores)) {
      // A trained row is the latest measurement and demotes the pre-existing
      // workplace baseline row for the same (student, skill). A baseline row
      // upserts canonical until a trained row supersedes it.
      const { error: scoreErr } = await admin.from("gap_scores").upsert(
        {
          student_id: studentId,
          skill,
          score: s.score,
          target: s.score + 100,
          source,
          is_canonical: true,
        },
        { onConflict: "student_id,skill,source" }
      );
      if (scoreErr) {
        result.failures.push(`gap_scores write failed for ${skill}: ${scoreErr.message}`);
        continue;
      }
      result.score_writes += 1;

      if (source === "workplace_trained") {
        await admin
          .from("gap_scores")
          .update({ is_canonical: false })
          .eq("student_id", studentId)
          .eq("skill", skill)
          .eq("source", "workplace");
      }

      const { error: histErr } = await admin.from("gap_score_history").insert({
        student_id: studentId,
        skill,
        score: s.score,
        target: s.score + 100,
        source,
      });
      if (histErr) {
        result.failures.push(`gap_score_history write failed for ${skill}: ${histErr.message}`);
      } else {
        result.history_writes += 1;
      }
    }
  }

  return result;
}