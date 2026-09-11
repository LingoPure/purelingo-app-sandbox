import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeWorkplaceArtifact,
  type WorkplaceArtifact,
} from "@/lib/bpo/edge";
import { CAPABILITY_TO_SKILL } from "@/lib/bpo/capability-to-skill";

const emailArtifact: WorkplaceArtifact = {
  artifact_id: "artifact-email-001",
  employer_id: "employer-acme",
  pseudonymous_id: "bpo-acme-001",
  source_type: "EMAIL",
  content:
    "Hi, I received my order today and it's completely wrong. I ordered the blue XL jacket and got a red medium. This is the second time this month.",
  metadata: { subject: "Customer complaint", role: "bpo_operator", team: "alpha" },
  created_at: "2026-09-01T09:00:00.000Z",
};

const callArtifact: WorkplaceArtifact = {
  artifact_id: "artifact-call-001",
  employer_id: "employer-acme",
  pseudonymous_id: "bpo-acme-002",
  source_type: "CALL_TRANSCRIPT",
  content:
    "Agent: Thank you for calling Acme Pacific support, how can I help?\nCustomer: Yeah hi, I've been charged twice.\nAgent: Of course, let me pull that up.",
  metadata: { summary: "Billing dispute", role: "bpo_operator", team: "alpha" },
  created_at: "2026-09-02T09:00:00.000Z",
};

test("email artifact produces an export-safe packet", async () => {
  const packet = await analyzeWorkplaceArtifact(emailArtifact);

  assert.equal(packet.packet_id.includes("-"), true);
  assert.equal(packet.employer_id, "employer-acme");
  assert.equal(packet.pseudonymous_id, "bpo-acme-001");

  // Export firewall: never raw content in the packet surface
  assert.equal(packet.evidence.every((e) => !e.observation.includes(emailArtifact.content)), true);
  assert.equal(packet.evidence.length > 0, true);

  // Capability scores cover all six capabilities, mapped to skills
  assert.equal(packet.capability_scores.length, 6);
  for (const c of packet.capability_scores) {
    assert.equal(typeof c.score, "number");
    assert.ok(c.score >= 0 && c.score <= 1000);
    assert.equal(c.skill, CAPABILITY_TO_SKILL[c.capability as keyof typeof CAPABILITY_TO_SKILL]);
  }
});

test("call artifact produces a transcript-aware packet", async () => {
  const packet = await analyzeWorkplaceArtifact(callArtifact);

  assert.equal(packet.pseudonymous_id, "bpo-acme-002");
  assert.equal(packet.evidence.length > 0, true);
  assert.equal(packet.capability_scores.length, 6);
});

test("export firewall: email raw content never leaks forward", async () => {
  const packet = await analyzeWorkplaceArtifact(emailArtifact);
  const rawContentInFull = JSON.stringify(packet);

  assert.equal(
    rawContentInFull.includes(emailArtifact.content),
    false,
    "raw email body must not appear in the structured packet"
  );
});

test("deterministic: same artifact yields same capability scores", async () => {
  const a = await analyzeWorkplaceArtifact(emailArtifact);
  const b = await analyzeWorkplaceArtifact(emailArtifact);

  const scoreOrder = (scores: typeof a.capability_scores) => scores.map((s) => s.score).join(",");
  assert.equal(scoreOrder(a.capability_scores), scoreOrder(b.capability_scores));
});