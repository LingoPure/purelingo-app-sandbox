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
  batch: ArtifactBatch;
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
// Each role gets 2 emails + 2 call transcripts; the agent index modulo-2
// selects which variant the agent receives, making the data reproducible
// without needing a PRNG.
//
// Every artifact is the AGENT's own communication (their written reply, or
// their handling of a call) so C07 measures the agent — not the customer.
// The TRAINED_* banks hold the same scenarios executed post-training:
// structured, apologetic-where-owed, concrete timeline, no repair markers.

export type ArtifactBatch = "baseline" | "trained";

const BASELINE_EMAILS: Record<string, { subject: string; body: string }[]> = {
  bpo_operator: [
    {
      subject: "Re: Customer complaint — incorrect order delivered (#4421)",
      body: `hi sarah sorry about that. i check on the order and we can fix it. call you back maybe today. thanks for telling us`,
    },
    {
      subject: "Re: Escalation: payment not processed (#9912)",
      body: `hello james we see the payment thing. our system have issue sometimes sorry. try again later maybe. let us know if not ok`,
    },
  ],
  sales_rep: [
    {
      subject: "Re: Q3 pricing discussion",
      body: `hi mark 8% is alot but maybe we can work something. i check with my manager and let you know before thursday i think. thanks`,
    },
    {
      subject: "Re: Partnership enquiry — Southeast Asia expansion",
      body: `hi wei we have case studies yes. i can share the files. pricing maybe we discuss on call. when you free?`,
    },
  ],
  tech_specialist: [
    {
      subject: "Re: API integration issue — webhook failing (#ENG-2291)",
      body: `hi there is new version 2.4.3 that fix this. just update and should work. let me know if not ok thanks`,
    },
    {
      subject: "Re: Security audit — credential rotation reminder",
      body: `hi we rotate 4 of 6. the other 2 we do later this week if possible. will confirm`,
    },
  ],
};

const TRAINED_EMAILS: Record<string, { subject: string; body: string }[]> = {
  bpo_operator: [
    {
      subject: "Re: Customer complaint — incorrect order delivered (#4421)",
      body: `Hello Sarah, thank you for reporting this — I'm sorry your order arrived incorrectly, that's not the standard we aim for. I've flagged order 4421 for a priority audit and will confirm the correct replacement despatch within 24 hours. I'll email you the moment tracking is live.`,
    },
    {
      subject: "Re: Escalation: payment not processed (#9912)",
      body: `Hello James, thank you for the details — I've reviewed your invoice and confirmed our payment gateway had an intermittent failure, not an issue on your side. I've reset the payment link and will monitor it until your invoice is settled this week. If it fails again, it's now on me to escalate directly.`,
    },
  ],
  sales_rep: [
    {
      subject: "Re: Q3 pricing discussion",
      body: `Hi Mark, thank you for confirming the volumes. On the 8% ask — that's more than I can approve directly, but a longer commitment term could bring the rate close to your target. I'll send revised terms tomorrow afternoon for your review ahead of our Thursday call.`,
    },
    {
      subject: "Re: Partnership enquiry — Southeast Asia expansion",
      body: `Hi Wei, excellent timing — we have two export-case studies that fit exactly that scenario. I'll share them this afternoon, and I'd suggest a 30-minute discovery call to talk through pricing and fit. I've copied some time options below.`,
    },
  ],
  tech_specialist: [
    {
      subject: "Re: API integration issue — webhook failing (#ENG-2291)",
      body: `Hi team, thanks for the repro details — this is a known defect in SDK 2.4.1, fixed in 2.4.3 which is fully backward-compatible. Please bump the version and redeploy; if the empty payload persists, escalate the ticket to me and I'll route it to the delivery team.`,
    },
    {
      subject: "Re: Security audit — credential rotation reminder",
      body: `Hi InfoSec, we've rotated 4 of 6 keys. The remaining two belong to staging and require a coordinated downtime window. We can complete them Thursday 10pm–midnight SGT — I'll confirm the checklist runs first so nothing breaks.`,
    },
  ],
};

const BASELINE_CALLS: Record<string, { summary: string; transcript: string }[]> = {
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

const TRAINED_CALLS: Record<string, { summary: string; transcript: string }[]> = {
  bpo_operator: [
    {
      summary: "Customer billing dispute — 15 min call (trained)",
      transcript: `Agent: Thank you for calling Acme Pacific support, my name is [Agent]. How can I help you today?\nCustomer: Hi, I've been charged twice for my last order.\nAgent: I'm sorry you're experiencing that — let me look into it right away. Can I have your account number, please?\nCustomer: It's 4421... actually yes, 4421.\nAgent: Thank you. I can see two identical charges; the second was a system error. I'm processing a full refund now — it'll appear in your account within 2–3 business days. I've also added a note to your account so our finance team monitors it going forward.\nCustomer: That's good. It's the second error this quarter.\nAgent: I understand, and I'm sorry for the repeated disruption. I'm flagging this for a manual audit this week so we can prevent recurrence. You'll receive an email confirmation once it's complete.`,
    },
    {
      summary: "Delivery status query — 10 min call (trained)",
      transcript: `Agent: Acme Pacific support, my name is [Agent]. How may I help?\nCustomer: Hi, my order shows delivered but I never received it.\nAgent: I'm sorry about that — let me trace it. May I have your order number?\nCustomer: It's ORD-78432.\nAgent: Thank you. I can confirm it was marked delivered at 2:14pm. I'm raising an urgent trace with our logistics partner right now, and I'll update you within 24 hours. If the parcel doesn't surface, we'll dispatch a replacement immediately.\nCustomer: I need it for a client meeting tomorrow.\nAgent: Understood — I've escalated this as urgent and will prioritise your update.`,
    },
  ],
  sales_rep: [
    {
      summary: "Follow-up call — contract renewal (trained)",
      transcript: `Rep: Hi Mark, thanks for the time. Following up on the Q3 pricing email.\nCustomer: Sure. The numbers are close, but 8% would help us get CFO sign-off.\nCustomer: I hear that. On a longer term — 18 months — I can move the per-seat rate much closer to your target. Would that structure work for your budget cycle?\nCustomer: That's interesting. Can you send revised terms before Wednesday?\nRep: Absolutely — I'll have the proposal on your desk by 3pm tomorrow. I'll also include the training module, which is included at the 18-month tier.\nCustomer: That's exactly what we need.`,
    },
    {
      summary: "Partnership enquiry — discovery call (trained)",
      transcript: `Rep: Wei, thanks for reaching out. Tell me about your requirements in Vietnam.\nCustomer: We need a sales team that can handle English-language clients. Communication quality is our main concern.\nRep: That's a very common challenge for teams expanding regionally. Could you share which interactions you're focused on — emails, calls, or video?\nCustomer: Mostly email and Teams calls with Australian and UK clients.\nRep: We have a communication training programme built exactly for that — B2B English with written and spoken business communication modules. I'd love to walk you through a case study. Are you free this week?\nCustomer: Let's do next Tuesday.\nRep: Perfect — I'll send a calendar link now.`,
    },
  ],
  tech_specialist: [
    {
      summary: "Incident response — webhook failure (trained)",
      transcript: `Engineer: Hi, thanks for the ticket. I've reviewed the logs — can you confirm which SDK version you're on?\nCustomer: We're on 2.4.1.\nEngineer: Thanks — this is a known issue in 2.4.1 where malformed retry headers cause empty payloads. It's resolved in 2.4.3, which is backward-compatible with your current setup. Please bump the version and redeploy. After that, if the issue persists, escalate directly to me and I'll route it to our delivery engineering team.\nCustomer: That's clear — we'll do it today.\nEngineer: I'll monitor your webhook endpoint after the deploy to confirm payloads are flowing. You'll have a confirmation from me within an hour.`,
    },
    {
      summary: "Security audit coordination (trained)",
      transcript: `Engineer: Hi, I'm following up on the credential rotation reminder. How is your team tracking?\nCustomer: We've completed 4 of 6 keys. The remaining two are staging keys — we need a coordinated downtime window.\nEngineer: Understood. What's available this week?\nCustomer: Thursday night, 10pm to midnight SGT.\nEngineer: That works well. I'll send a pre-rotation checklist beforehand so there are no surprises. During the window, I'll be available on call. If anything unexpected happens, I'll escalate immediately. After rotation, I'll confirm all endpoints are healthy before signing off.\nCustomer: Appreciated — Thursday night it is.`,
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

/** The demo email a pseudonymous agent maps to in the students table. */
export function pseudonymousEmail(pseudonymous_id: string): string {
  return `bpo-${pseudonymous_id}@acme-pacific.demo`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Seed the synthetic employer, upsert 12 agents into `students`, and insert
 * deterministic workplace artifacts into `workplace_artifacts` (upsert-safe).
 *
 * Existing rows for the same employer/agent/source/subject are not duplicated.
 */
export async function generateSyntheticArtifacts(
  supabase: SupabaseClient,
  options?: { batch?: ArtifactBatch }
): Promise<HarnessSeedResult> {
  const batch: ArtifactBatch = options?.batch ?? "baseline";
  const emails = batch === "trained" ? TRAINED_EMAILS : BASELINE_EMAILS;
  const calls = batch === "trained" ? TRAINED_CALLS : BASELINE_CALLS;
  // Baseline: 7/5 days ago (gives a time trail). Trained: 1 day ago.
  const [emailDays, callDays] = batch === "trained" ? [1, 1] : [7, 5];
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
    const email = pseudonymousEmail(pid);
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
    const emailVariant = emails[agent.roleKey][idx % 2];
    const callVariant = calls[agent.roleKey][idx % 2];

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
          batch,
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

    await insertArtifact("EMAIL", emailVariant.body, { subject: emailVariant.subject }, emailDays);
    await insertArtifact("CALL_TRANSCRIPT", callVariant.transcript, { summary: callVariant.summary }, callDays);
  }

  return {
    employerId,
    agentCount: AGENTS.length,
    artifactCount: AGENTS.length * 2,
    agents: agentIds,
    batch,
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
