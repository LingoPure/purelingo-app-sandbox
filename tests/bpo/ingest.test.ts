import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestRequestSchema } from "@/app/api/bpo/edge/ingest/route";
import type { EdgeIntelligencePacket } from "@/lib/bpo/edge";

function validPacket(): EdgeIntelligencePacket {
  return {
    packet_id: "pkt-001",
    employer_id: "employer-acme",
    pseudonymous_id: "bpo-acme-001",
    evidence: [
      {
        evidence_id: "ev-001",
        construct: "SPK-A1.1",
        observation: "Speech shows limited fluency",
        status: "OBSERVED",
        authority: "DIRECT",
        confidence: 0.8,
        quality: 0.7,
        task_relevance: 0.9,
        independence: "independent",
        source: { modality: "speaking", response_id: "artifact-001", analysis_id: "a-1", signal_ids: [] },
        provenance: { engine_version: "bpo-harness-edge-v1", created_at: "2026-09-01" },
        context_receiver: { receiver: "customer", context: "bpo call" },
        confounds: "NONE",
        counter_evidence: [],
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
    capability_scores: [
      { capability: "SPK", skill: "speaking", score: 620, confidence: 0.8, evidence_ids: ["ev-001"] },
    ],
    telemetry: { dimensions: { semantics: 1 }, confidence: 0.9 },
    provenance: { engine_version: "bpo-harness-edge-v1", artifact_id: "artifact-001", created_at: "2026-09-01T00:00:00Z" },
  };
}

test("valid export-safe packet passes the strict schema", () => {
  const result = ingestRequestSchema.safeParse({ packets: [validPacket()] });
  assert.equal(result.success, true);
});

test("firewall: packet with a top-level content key is rejected", () => {
  const packet = validPacket() as EdgeIntelligencePacket & { content: string };
  packet.content = "raw email body that must never cross";
  const result = ingestRequestSchema.safeParse({ packets: [packet] });
  assert.equal(result.success, false);
});

test("firewall: evidence row with raw transcript is rejected", () => {
  const packetJson = JSON.parse(JSON.stringify(validPacket())) as Record<string, unknown>;
  (packetJson.evidence as Array<Record<string, unknown>>)[0].raw_transcript =
    "Agent: thank you for calling";
  const result = ingestRequestSchema.safeParse({ packets: [packetJson] });
  assert.equal(result.success, false);
});

test("firewall: empty packets array rejected", () => {
  const result = ingestRequestSchema.safeParse({ packets: [] });
  assert.equal(result.success, false);
});

test("firewall: malformed capability score (out of range) rejected", () => {
  const packet = validPacket();
  packet.capability_scores = [{ ...packet.capability_scores[0], score: 1500 }];
  const result = ingestRequestSchema.safeParse({ packets: [packet] });
  assert.equal(result.success, false);
});