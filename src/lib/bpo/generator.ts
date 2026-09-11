/**
 * Synthetic artifact generator (BH-001 / Phase 1 — BPO Harness).
 *
 * Produces deterministic, idempotent workplace communication samples
 * (emails + contact-centre call transcripts) for a 12-agent BPO cohort
 * across 3 roles × 2 teams. Content is seeded and role-contextualised
 * so the Edge engine's output is reproducible and the §12 rollup has
 * meaningful role/team/team-shift structure.
 *
 * Rules:
 *   - Agent pseudonymous IDs are deterministic: `bpo-{employer}-{idx}`.
 *   - Employer is "Acme Pacific BPO (demo)" (same demo as seed-demo.ts).
 *   - Employer is upserted; agents are upserted; artifacts are upserted
 *     on (employer_id, pseudonymous_id, source_type, subject_hash).
 *   - Status is PENDING; the Edge engine (BH-002) sets ANALYSED.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceKind = "EMAIL" | "CALL_TRANSCRIPT";

export type ArtifactRecord = {
  artifact_id: string;
  employer_id: string;
  pseudonymous_id: string;
  source_type: SourceKind;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentSeed = {
  name: string;
  roleKey: string;
  team: "alpha" | "bravo";
};

export type HarnessSeedResult = {
  employerId: string;
  agentCount: number;
  artifactCount: number;
  agents: string[];
};

// ─── Deterministic employers + agents ─────────────────────────────────────────

const EMPLOYER = {
  name: "Acme Pacific BPO (demo)",
  defaultTargetLevel: "B2" as const,
  contactEmail: "ops@acme-pacific.demo",
};

const AGENTS: AgentSeed[] = [
  // Team Alpha (6 agents)
  { name: "Bui Thi Lan",      roleKey: "bpo_operator",    team: "alpha" },
  { name: "Nguyen Van Manh",  roleKey: "bpo_operator",    team: "alpha" },
  { name: "Pham Thanh Tam",   roleKey: "sales_rep",       team: "alpha" },
  { name: "Le Hoang Son",     roleKey: "sales_rep",       team: "alpha" },
  { name: "Tran Minh Duc",    roleKey: "tech_specialist",  team: "alpha" },
  { name: "Hoang Thi Mai",    roleKey: "tech_specialist",  team: "alpha" },
  // Team Bravo (6 agents)
  { name: "Vo Ngoc Anh",      roleKey: "bpo_operator",    team: "bravo" },
  { name: "Do Quoc Bao",      roleKey: "bpo_operator",    team: "bravo" },
  { name: "Ngo Thi Kim",      roleKey: "sales_rep",       team: "bravo" },
  { name: "Dang Van Hung",    roleKey: "sales_rep",       team: "bravo" },
  { name: "Phan Thanh Hai",   roleKey: "tech_specialist",  team: "bravo" },
  { name: "Bach Thi Linh",    roleKey: "tech_specialist",  team: "bravo" },
];

// ─── Deterministic content bank ───────────────────────────────────────────────
// Each role gets 2 emails + 2 call transcripts; the agent index modulo-4
// selects which variant the agent receives, making the data reproducible
// without needing a PRNG.

const EMAIL_VARIANTS: Record<string, { subject: string; body: string }[]> = {
  bpo_operator: [
    {
      subject: "Customer complaint — incorrect order delivered",
      body: `Hi, I received my order today and it's completely wrong. I ordered the blue XL jacket and got a red medium. This is the second time this month. I need this resolved today or I'm cancelling my account. — Sarah, Customer #4421`,
    },
    {
      subject: "Escalation: payment not processed",
      body: `Hello, I tried to pay my invoice 3 times and it keeps failing. My card works fine on other sites. I'm a business customer and this is affecting my team. Please escalate immediately. — James, Account #9912`,
    },
  ],
  sales_rep: [
    {
      subject: "Re: Q3 pricing discussion",
      body: `Thanks for the proposal. We've reviewed the numbers and the 12-month commitment price works for our Sydney office, but we'd need the per-seat rate to come down 8% to match budget. Can you confirm if that's possible before our call Thursday? — Mark, AusTrade Corp`,
    },
    {
      subject: "Partnership enquiry — Southeast Asia expansion",
      body: `Hi, we're expanding into Vietnam and Thailand and are looking for a manufacturing partner with English-capable sales teams. Could you share your export capability case studies and pricing? — Wei, AsiaBridge Ltd`,
    },
  ],
  tech_specialist: [
    {
      subject: "API integration issue — webhook failing",
      body: `Hi team, our webhook integration stopped receiving events at 09:42 UTC today. The endpoint returns 200 but the payload is empty. Logs show the event was emitted. Could you check the delivery pipeline? — DevOps, Ticket #ENG-2291`,
    },
    {
      subject: "Security audit — credential rotation reminder",
      body: `Per our quarterly security policy, all API keys must be rotated before end of month. Please confirm your team's keys have been updated. Current rotation status: 4/6 rotated. — InfoSec Team`,
    },
  ],
};

const CALL_VARIANTS: Record<string, { summary: string; transcript: string }[]> = {
  bpo_operator: [
    {
      summary: "Customer billing dispute — 15 min call",
      transcript: `Agent: Thank you for calling Acme Pacific support, this is [Agent]. How can I help?\nCustomer: Yeah hi, I've been charged twice for my last order. Can you check?\nAgent: Of course. Can I get your account number please?\nCustomer: It's 4421... actually no wait, it's — hold on — 4421. Yeah, 4421.\nAgent: Got it. Let me pull that up... I can see the two charges here. The second one was a system error. I'll process a refund right now. It'll hit your account in 2-3 business days.\nCustomer: Okay, thank you. That's the second billing error this quarter.\nAgent: I understand, and I'm sorry for the inconvenience. I'm flagging your account for a manual review so it doesn't happen again.\nCustomer: Alright, I appreciate that.`,
    },
    {
      summary: "Delivery status query — 10 min call",
      transcript: `Agent: Acme Pacific support, how can I help?\nCustomer: Hi, I'm calling about my delivery. The tracking says delivered but I didn't get anything.\nAgent: Sorry about that. Can I get your order number?\nCustomer: It's ORD-78432.\nAgent: One moment... I can see it was marked delivered at 2:14pm. I'll raise a trace with our logistics partner and get back to you within 24 hours. We'll also send a replacement if it doesn't turn up.\nCustomer: Okay, I need this for a client meeting tomorrow though.\nAgent: Understood. I'll escalate this as urgent.`,
    },
  ],
  sales_rep: [
    {
      summary: "Follow-up call — contract renewal discussion",
      transcript: `Rep: Hi Mark, thanks for taking the call. I wanted to follow up on the Q3 pricing email.\nCustomer: Sure. Look, the numbers are in the right ballpark but 8% would really help us get sign-off from our CFO.\nRep: I hear you. What if we look at a 18-month term instead of 12? I can get closer to your number on a longer commitment.\nCustomer: That's interesting. Can you send through revised terms by Wednesday?\nRep: Absolutely. I'll have the new proposal on your desk by 3pm tomorrow.\nCustomer: Perfect. Also, any chance we can add the training module for our new hires? That was missing from the original quote.\nRep: Let me check — I believe that's included at the 18-month tier. I'll confirm in the proposal.`,
    },
    {
      summary: "New partnership enquiry — discovery call",
      transcript: `Rep: Wei, thanks for reaching out. Tell me a bit about what you're looking for in Vietnam.\nCustomer: We need a sales team that can handle English-language clients. Most of our current team is strong technically but the communication side is inconsistent.\nRep: That's a common challenge. What kinds of interactions are we talking about — emails, calls, video meetings?\nCustomer: Mostly email and Teams calls with Australian and UK clients.\nRep: Got it. We've actually built a communication training programme specifically for that scenario — B2B English with a focus on written and spoken business communication. I'd love to share a case study.\nCustomer: That would be great. Can we set up a demo next week?\nRep: Absolutely. I'll send some time options.`,
    },
  ],
  tech_specialist: [
    {
      summary: "Incident response — webhook failure debug",
      transcript: `Engineer: Hi, I'm looking at your webhook ticket. Can you tell me which SDK version you're on?\nCustomer: We're on 2.4.1.\nEngineer: There's a known issue in 2.4.1 where empty payloads are sent when the retry header is malformed. The fix is in 2.4.3 — released yesterday.\nCustomer: Oh, we haven't updated. Is it a straightforward upgrade?\nEngineer: Yes, just bump the version and re-deploy. The API is backward-compatible.\nCustomer: Great, we'll do that today. Is there anything else we should watch for?\nEngineer: Just check your webhook secret — it should auto-rotate, but confirm after the upgrade.`,
    },
    {
      summary: "Security audit coordination",
      transcript: `Engineer: Hi, I'm calling about the credential rotation reminder. How's your team tracking?\nCustomer: We've rotated 4 of 6 keys. The remaining two are for the staging environment — we need to coordinate downtime.\nEngineer: Understood. What's your window this week?\nCustomer: Thursday night, 10pm to midnight SGT.\nEngineer: Perfect. I'll send you a pre-rotation checklist so nothing breaks. And if you hit any issues, our on-call is available after hours.\nCustomer: Appreciate it. We'll aim for Thursday then.`,
    },
  ],
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function sha256HexSync(text: string): string {
  // Use crypto.subtle for the content dedup hash — same as 2K audio checksum.
  // For the synchronous harness path we use a fast string hash (not
  // collision-resistant; just for idempotent upserts on demo data).
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

function pseudonymousId(idx: number): string {
  return `bpo-acme-${String(idx + 1).padStart(3, "0")}`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Seed the synthetic employer, upsert 12 agents into `students`, and insert
 * deterministic workplace artifacts into `workplace_artifacts` (upsert-safe).
 *
 * Existing rows for the same employer/agent/source/subject are not duplicated.
 */
export async function generateSyntheticArtifacts(
  supabase: SupabaseClient
): Promise<HarnessSeedResult> {
  // 1. Upsert employer
  const { data: existingEmp, error: empErr } = await supabase
    .from("employers")
    .select("id")
    .eq("name", EMPLOYER.name)
    .maybeSingle();
  if (empErr) throw new Error(`employer select failed: ${empErr.message}`);

  let employerId: string;
  if (existingEmp?.id) {
    employerId = String(existingEmp.id);
    await supabase
      .from("employers")
      .update({ contact_email: EMPLOYER.contactEmail })
      .eq("id", employerId);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("employers")
      .insert({
        name: EMPLOYER.name,
        contact_email: EMPLOYER.contactEmail,
        default_target_level: EMPLOYER.defaultTargetLevel,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      throw new Error(`employer insert failed: ${createErr?.message ?? "unknown"}`);
    }
    employerId = String(created.id);
  }

  // 2. Resolve role IDs (must already exist from seed-demo.ts)
  const { data: roles, error: rolesErr } = await supabase
    .from("roles")
    .select("id, name")
    .eq("employer_id", employerId);
  if (rolesErr || !roles?.length) {
    throw new Error(
      `roles missing for employer ${employerId} — run seedDemoCohort first`
    );
  }
  const roleNameToId = new Map<string, string>();
  for (const r of roles) roleNameToId.set(String(r.name), String(r.id));

  const agentIds: string[] = [];

  for (let idx = 0; idx < AGENTS.length; idx++) {
    const agent = AGENTS[idx];
    const pid = pseudonymousId(idx);
    const roleId = roleNameToId.get(roleName(agent.roleKey));

    if (!roleId) {
      throw new Error(`role "${agent.roleKey}" not found for agent ${agent.name}`);
    }

    // 2a. Upsert into students (auth + students table)
    const email = `bpo-${pid}@acme-pacific.demo`;
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      perPage: 200,
    });
    let userId = existingUser.users.find((u) => u.email === email)?.id;

    if (!userId) {
      const { data: createdUser, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          password: "bpo-harness-demo-2026!",
          email_confirm: true,
          user_metadata: { full_name: agent.name },
        });
      if (createErr || !createdUser.user) {
        throw new Error(
          `auth create failed for ${email}: ${createErr?.message ?? "unknown"}`
        );
      }
      userId = createdUser.user.id;
    }

    await supabase
      .from("students")
      .update({
        name: agent.name,
        email,
        employer_id: employerId,
        role_id: roleId,
        target_level: EMPLOYER.defaultTargetLevel,
        discovery_status: "complete",
      })
      .eq("id", userId!);

    agentIds.push(userId!);

    // 2b. Insert synthetic artifacts (idempotent on content hash)
    const emailVariant = EMAIL_VARIANTS[agent.roleKey][idx % 2];
    const callVariant = CALL_VARIANTS[agent.roleKey][idx % 2];

    const insertArtifact = async (
      sourceType: SourceKind,
      content: string,
      metadata: Record<string, unknown>,
      daysOffset: number
    ) => {
      const subjectHash = sha256HexSync(`${pid}:${sourceType}:${content.slice(0, 64)}`);
      const { error } = await supabase.from("workplace_artifacts").upsert(
        {
          employer_id: employerId,
          pseudonymous_id: pid,
          source_type: sourceType,
          content,
          metadata: {
            ...metadata,
            agent_name: agent.name,
            role: agent.roleKey,
            team: agent.team,
            subject_hash: subjectHash,
          },
          analysis_status: "PENDING",
          created_at: daysAgo(daysOffset),
        },
        { onConflict: "employer_id,pseudonymous_id,source_type,content" }
      );
      if (error && !error.message.includes("unique")) {
        throw new Error(`artifact insert failed: ${error.message}`);
      }
    };

    // Day offsets: emails 7 days ago, calls 5 days ago — leaves a trail for trend
    await insertArtifact("EMAIL", emailVariant.body, { subject: emailVariant.subject }, 7);
    await insertArtifact("CALL_TRANSCRIPT", callVariant.transcript, { summary: callVariant.summary }, 5);
  }

  return {
    employerId,
    agentCount: AGENTS.length,
    artifactCount: AGENTS.length * 2,
    agents: agentIds,
  };
}

function roleName(roleKey: string): string {
  const map: Record<string, string> = {
    bpo_operator: "BPO Operator",
    sales_rep: "Manufacturing Sales Rep",
    tech_specialist: "Technical Specialist",
  };
  return map[roleKey] ?? roleKey;
}
