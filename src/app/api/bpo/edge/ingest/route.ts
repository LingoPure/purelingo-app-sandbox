/**
 * POST /api/bpo/edge/ingest — structured packet ingestion (BH-003).
 *
 * The receiving end of the Edge → Cloud exchange (Phase 6 / doc §15, the
 * conceptual `POST /workplace/competency-observations`). Accepts export-safe
 * structured packets only.
 *
 * EXPORT FIREWALL: the payload schema is strict top-to-bottom. Any packet
 * carrying raw content (or any unknown key) is rejected with 400 before a
 * single row is written — a `content` key is not part of the packet contract.
 * Raw workplace text never crosses this boundary (§18).
 *
 * AUTH: requires the shared edge secret (`x-bpo-edge-secret` ===
 * `LP_BPO_EDGE_SECRET`) when that env is configured; otherwise falls back to
 * an authenticated session. The write path is service-role (backend exchange).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestStructuredPackets } from "@/lib/bpo/ingest";
import type { EdgeIntelligencePacket } from "@/lib/bpo/edge";

const CAPABILITY_CODES = ["LIS", "VOC", "GRM", "SPK", "RDG", "INT"] as const;
const SKILL_KEYS = [
  "speaking_fluency",
  "listening_comprehension",
  "writing_formal",
  "reading_intent",
  "business_vocabulary",
  "presentation_delivery",
] as const;
const EVIDENCE_STATUSES = [
  "OBSERVED",
  "NOT_OBSERVED",
  "NOT_APPLICABLE",
  "INSUFFICIENT",
  "CONFLICTED",
  "ZERO",
] as const;
const EVIDENCE_AUTHORITIES = [
  "DIRECT",
  "PARTIAL",
  "DERIVED",
  "INFERRED",
  "TRIANGULATED",
  "UNOBSERVED",
] as const;

const capabilityScoreSchema = z
  .object({
    capability: z.enum(CAPABILITY_CODES),
    skill: z.enum(SKILL_KEYS),
    score: z.number().min(0).max(1000),
    confidence: z.number().min(0).max(1),
    evidence_ids: z.array(z.string()),
  })
  .strict();

const evidenceRecordSchema = z
  .object({
    evidence_id: z.string(),
    construct: z.string(),
    observation: z.string(),
    status: z.enum(EVIDENCE_STATUSES),
    authority: z.enum(EVIDENCE_AUTHORITIES),
    confidence: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    task_relevance: z.number().min(0).max(1),
    independence: z.enum(["independent", "correlated", "dependent"]),
    source: z
      .object({
        modality: z.string(),
        response_id: z.string(),
        analysis_id: z.string(),
        signal_ids: z.array(z.string()),
      })
      .strict(),
    provenance: z
      .object({
        engine_version: z.string(),
        rule_version: z.string().optional(),
        created_at: z.string(),
      })
      .strict(),
    context_receiver: z
      .object({
        receiver: z.string().optional(),
        context: z.string().optional(),
      })
      .strict(),
    confounds: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    confound_notes: z.array(z.string()).optional(),
    counter_evidence: z.array(z.string()),
    created_at: z.string(),
  })
  .strict();

const packetSchema = z
  .object({
    packet_id: z.string(),
    employer_id: z.string(),
    pseudonymous_id: z.string(),
    evidence: z.array(evidenceRecordSchema),
    capability_scores: z.array(capabilityScoreSchema),
    telemetry: z
      .object({
        dimensions: z.record(z.string(), z.number()),
        confidence: z.number().min(0).max(1),
      })
      .strict(),
    provenance: z
      .object({
        engine_version: z.string(),
        artifact_id: z.string(),
        created_at: z.string(),
      })
      .strict(),
  })
  .strict();

const ingestRequestSchema = z
  .object({
    packets: z.array(packetSchema).min(1),
  })
  .strict();

export { ingestRequestSchema };

export async function POST(req: NextRequest) {
  // Auth: shared edge secret when configured, else authenticated session.
  const edgeSecret = process.env.LP_BPO_EDGE_SECRET;
  if (edgeSecret) {
    const provided = req.headers.get("x-bpo-edge-secret");
    if (provided !== edgeSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Firewall: shape violations (including any raw-content key) never reach the DB.
    return NextResponse.json(
      { error: "Invalid packet payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await ingestStructuredPackets(
      createAdminClient(),
      parsed.data.packets as unknown as EdgeIntelligencePacket[]
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}