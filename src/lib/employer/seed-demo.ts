/**
 * Demo cohort seeder — populates the employer dashboard with realistic
 * fictional students so the radar / roster / activity feed don't look
 * empty in the pitch.
 *
 * 5 students spanning the full ability range (struggling A2/B1 through
 * star C1) with varied roles, target levels, profile narratives, and
 * activity histories.
 *
 * Idempotent: safe to re-run. Auth users are reused if their email
 * already exists; gap_scores upsert; discovery_sessions are unique on
 * convai_conversation_id (we use a deterministic synthetic value); we
 * delete-and-re-insert micro_lessons + classin_sessions per seed pass
 * so the demo data always reflects whatever's in this file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillKey } from "@/lib/scoring/rubric";
import { randomBytes } from "node:crypto";

type DemoLesson = {
  type: "email_sprint" | "speak_score";
  daysAgo: number;
  xpAwarded: number;
  scoreAfter: number;
};

type DemoClass = {
  daysAgo: number;
  teacherName: string;
  attended: boolean;
  durationMins: number;
  scored: boolean;
};

type DemoCert = {
  level: "A2" | "B1" | "B2" | "C1";
  status: "passed" | "scheduled" | "failed";
  daysAgo: number;
  overallScore?: number;
};

type DemoNudge = {
  rule:
    | "streak_at_risk"
    | "streak_broken"
    | "inactivity_5d"
    | "cert_pushable"
    | "class_tomorrow";
  subject: string;
  body: string;
  daysAgo: number;
};

type RoleKey = "bpo_operator" | "sales_rep" | "tech_specialist";

type DemoStudent = {
  email: string;
  name: string;
  targetLevel: "A2" | "B1" | "B2" | "C1" | "C2";
  // Role assignment within the demo employer. The role's baselines
  // become the per-skill targets on this student's gap_scores rows.
  roleKey: RoleKey;
  scores: Record<SkillKey, number>;
  overallCefr: "A2" | "B1" | "B2" | "C1" | "C2";
  summary: string;
  targetWhy: string;
  learningStyle: string;
  evidence: Record<SkillKey, string>;
  daysSinceDiscovery: number;
  lessons: DemoLesson[];
  classes: DemoClass[];
  certs?: DemoCert[];
  // Gamification: deliberate "story" numbers so the cohort dashboard
  // shows visible variety (high streak, broken streak, top XP, etc.).
  xp: number;
  streakDays: number;
  lastActiveDaysAgo: number;
  nudges?: DemoNudge[];
};

// ─────────────────────────────────────────────────────────────────────
// Demo employer + roles. All five demo students belong to this employer
// so the per-role coverage rollup has something coherent to render.
// ─────────────────────────────────────────────────────────────────────
const DEMO_EMPLOYER = {
  name: "Acme Pacific BPO (demo)",
  contactEmail: "lnd@acme-pacific.demo",
  defaultTargetLevel: "B2" as const,
};

type DemoRole = {
  key: RoleKey;
  name: string;
  description: string;
  baselines: Record<SkillKey, number>;
};

// Three role archetypes spanning the buyer story. Baselines were chosen
// so the cohort produces a credible "starting state" for the rollup —
// some roles 0% covered, one role partially covered.
const DEMO_ROLES: DemoRole[] = [
  {
    key: "bpo_operator",
    name: "BPO Operator",
    description:
      "Voice + chat support for English-speaking clients. Listening- and speaking-heavy; writing register is functional rather than formal.",
    baselines: {
      speaking_fluency: 650,
      listening_comprehension: 700,
      writing_formal: 550,
      reading_intent: 650,
      business_vocabulary: 600,
      presentation_delivery: 500,
    },
  },
  {
    key: "sales_rep",
    name: "Manufacturing Sales Rep",
    description:
      "B2B sales into export markets — negotiation, proposal writing, customer presentations. Even balance across skills, with emphasis on speaking and reading-intent.",
    baselines: {
      speaking_fluency: 750,
      listening_comprehension: 700,
      writing_formal: 700,
      reading_intent: 750,
      business_vocabulary: 750,
      presentation_delivery: 700,
    },
  },
  {
    key: "tech_specialist",
    name: "Technical Specialist",
    description:
      "Engineering, documentation, technical support. Writing-formal and reading-intent dominate; speaking is for internal calls more than client-facing presentations.",
    baselines: {
      speaking_fluency: 700,
      listening_comprehension: 700,
      writing_formal: 800,
      reading_intent: 800,
      business_vocabulary: 750,
      presentation_delivery: 650,
    },
  },
];

const DEMO_COHORT: DemoStudent[] = [
  {
    email: "ha.nguyen@vinhhoan-export.demo",
    name: "Nguyễn Thị Hà",
    targetLevel: "B2",
    roleKey: "sales_rep",
    overallCefr: "B1",
    scores: {
      speaking_fluency: 580,
      listening_comprehension: 550,
      writing_formal: 480,
      reading_intent: 620,
      business_vocabulary: 520,
      presentation_delivery: 450,
    },
    summary:
      "Solid conversational B1 with strong reading-intent — Hà gets the subtext in business email. Biggest gap is formal writing and presentation delivery; she dreads quarterly slots and falls back on simple vocabulary under pressure.",
    targetWhy:
      "Employer requirement — Vinh Hoan is opening an Australia desk in Q4 and Hà is a relocation candidate. Needs B2 inside 6 months.",
    learningStyle:
      "Prefers 15–25 min sessions late evening (kids asleep around 9pm). Competitive — wants leaderboards. Vietnamese literacy excellent; university educated.",
    evidence: {
      speaking_fluency:
        "Said \"I am working there since 4 years\" — fluent but with persistent for/since errors.",
      listening_comprehension:
        "Asked Aria to repeat the British-accented portion of the email twice; clear sign listening is below speaking.",
      writing_formal:
        "Described her own emails as \"I just say hi, ask the question, sign off\" — limited register variety.",
      reading_intent:
        "Identified Sarah was \"asking to renegotiate without saying it\" — strong B2-level signal.",
      business_vocabulary:
        "Repeatedly defaulted to \"good\" and \"interesting\" when describing client interactions.",
      presentation_delivery:
        "Self-described as \"dreading\" monthly presentation slots — confidence below ability.",
    },
    daysSinceDiscovery: 11,
    lessons: [
      { type: "email_sprint", daysAgo: 9, xpAwarded: 64, scoreAfter: 560 },
      { type: "speak_score", daysAgo: 6, xpAwarded: 71, scoreAfter: 600 },
      { type: "email_sprint", daysAgo: 2, xpAwarded: 78, scoreAfter: 640 },
    ],
    classes: [
      { daysAgo: 8, teacherName: "Coach Linh", attended: true, durationMins: 45, scored: true },
      { daysAgo: 1, teacherName: "Coach Linh", attended: true, durationMins: 50, scored: false },
    ],
    // Steady learner: discovery + 3 lessons + 2 classes = 200+213+200 = 613.
    xp: 613,
    streakDays: 4,
    lastActiveDaysAgo: 1,
    nudges: [
      {
        rule: "class_tomorrow",
        subject: "Your class is Wednesday, 7:30 PM",
        body: "Quick reminder: your live class with Coach Linh is coming up. Headphones, quiet spot, and you're set.",
        daysAgo: 7,
      },
      {
        rule: "streak_at_risk",
        subject: "Don't break your 3-day streak, Hà",
        body: "One five-minute lesson keeps the fire burning. Open LingoPure → Lessons.",
        daysAgo: 3,
      },
    ],
  },
  {
    email: "minh.tran@hanoi-manuf.demo",
    name: "Trần Văn Minh",
    targetLevel: "B2",
    roleKey: "tech_specialist",
    overallCefr: "B2",
    scores: {
      speaking_fluency: 700,
      listening_comprehension: 680,
      writing_formal: 620,
      reading_intent: 720,
      business_vocabulary: 650,
      presentation_delivery: 600,
    },
    summary:
      "Steady B2 across the board with no glaring weakness. Minh is one polish-pass away from leading regional ops calls in English without code-switching back to Vietnamese for the difficult moments.",
    targetWhy:
      "Career goal — internal promotion to regional operations head requires English-language reporting. No hard deadline but expected within 12 months.",
    learningStyle:
      "Methodical, prefers deep-dive 30-min sessions on weekend mornings. Direct feedback over coaching tone. Strong native literacy.",
    evidence: {
      speaking_fluency:
        "Held an unbroken 90-second answer about supply chain disruptions; pace natural.",
      listening_comprehension: "Got the first ask each time without clarification.",
      writing_formal:
        "Described his weekly report as \"three pages, mostly bullet points\" — register is functional but flat.",
      reading_intent: "Caught Sarah's renegotiation hint immediately.",
      business_vocabulary: "Used \"bottleneck\" and \"escalate\" naturally and correctly.",
      presentation_delivery: "Comfortable in monthly ops review, less so in cross-functional formats.",
    },
    daysSinceDiscovery: 17,
    lessons: [
      { type: "email_sprint", daysAgo: 14, xpAwarded: 81, scoreAfter: 670 },
      { type: "speak_score", daysAgo: 4, xpAwarded: 85, scoreAfter: 700 },
    ],
    classes: [
      { daysAgo: 12, teacherName: "Coach Anh", attended: true, durationMins: 50, scored: true },
    ],
    certs: [
      { level: "B2", status: "scheduled", daysAgo: 1 },
    ],
    // Methodical: 200 discovery + 166 lessons + 100 class = 466. Streak broke
    // after the weekend deep-dive; will rebuild this week.
    xp: 466,
    streakDays: 0,
    lastActiveDaysAgo: 4,
    nudges: [
      {
        rule: "streak_broken",
        subject: "Welcome back, Minh",
        body: "Two days off is fine — start a fresh streak today. The first lesson is the hardest.",
        daysAgo: 2,
      },
    ],
  },
  {
    email: "anh.le@bizdev-sg.demo",
    name: "Lê Hoàng Anh",
    targetLevel: "C1",
    roleKey: "bpo_operator",
    overallCefr: "B1",
    scores: {
      speaking_fluency: 500,
      listening_comprehension: 480,
      writing_formal: 420,
      reading_intent: 550,
      business_vocabulary: 450,
      presentation_delivery: 400,
    },
    summary:
      "Junior BD rep with high ambition and a steep gap. Anh is highly motivated — completed five lessons in the first week — but the C1 target before next year's regional summit is aggressive.",
    targetWhy:
      "Event-driven — pitching at Singapore FinTech Festival in 11 months. Personal career bet, not employer-mandated. Wants to lead the booth solo.",
    learningStyle:
      "High-frequency short bursts (10–15 min) on the morning commute. Fast-paced, low patience for theory — wants drills. Confident in written Vietnamese.",
    evidence: {
      speaking_fluency: "Frequent self-correction loops — restarts the same sentence two or three times.",
      listening_comprehension: "Confused \"price elasticity\" with \"price flexibility\" mid-question.",
      writing_formal: "Email register reads like a chat message — no opening, mid-sentence sign-off.",
      reading_intent: "Got the gist of Sarah's email but said \"she wants another meeting\" — missed the renegotiation hint.",
      business_vocabulary: "Reached for \"thing\" and \"stuff\" repeatedly when discussing fintech products.",
      presentation_delivery: "Avoided giving an extended answer when offered the chance.",
    },
    daysSinceDiscovery: 7,
    lessons: [
      { type: "email_sprint", daysAgo: 6, xpAwarded: 51, scoreAfter: 440 },
      { type: "speak_score", daysAgo: 5, xpAwarded: 48, scoreAfter: 420 },
      { type: "email_sprint", daysAgo: 4, xpAwarded: 56, scoreAfter: 480 },
      { type: "speak_score", daysAgo: 2, xpAwarded: 62, scoreAfter: 510 },
      { type: "email_sprint", daysAgo: 1, xpAwarded: 65, scoreAfter: 530 },
    ],
    classes: [],
    // The keen one: daily lessons → strong streak. 200 discovery + 282 lessons.
    xp: 482,
    streakDays: 6,
    lastActiveDaysAgo: 1,
    nudges: [
      {
        rule: "streak_at_risk",
        subject: "Don't break your 6-day streak, Anh",
        body: "One five-minute lesson keeps the fire burning. Open LingoPure → Lessons.",
        daysAgo: 1,
      },
    ],
  },
  {
    email: "huong.pham@vingroup-hr.demo",
    name: "Phạm Thu Hương",
    targetLevel: "B2",
    roleKey: "sales_rep",
    overallCefr: "C1",
    scores: {
      speaking_fluency: 860,
      listening_comprehension: 840,
      writing_formal: 820,
      reading_intent: 880,
      business_vocabulary: 800,
      presentation_delivery: 840,
    },
    summary:
      "Already comfortably above the B2 target. Hương's value from LingoPure is polish — idiom precision, executive-tone register — not gap-closing. Recommend graduating her to Phase 2 advanced track.",
    targetWhy:
      "Professional development — runs internal English-only HR briefings. Wants confidence speaking with the parent group's UK leadership without thinking twice.",
    learningStyle:
      "Coaching tone over direct feedback. Once or twice a week is enough — values quality over volume. Comfortable in either Vietnamese or English written form.",
    evidence: {
      speaking_fluency: "Spoke fluently for two minutes uninterrupted with no hesitation markers.",
      listening_comprehension: "Caught the British accent test immediately and correctly.",
      writing_formal: "Self-described emails were \"three-paragraph, register-shifted\" — sophisticated.",
      reading_intent: "Identified Sarah was \"hedging her ask\" — C1-level interpretation.",
      business_vocabulary: "Used \"in light of\" and \"net of\" naturally; HR-domain precision.",
      presentation_delivery: "Reported leading 30-min strategy briefings monthly — clearly comfortable.",
    },
    daysSinceDiscovery: 21,
    lessons: [
      { type: "speak_score", daysAgo: 13, xpAwarded: 102, scoreAfter: 850 },
    ],
    classes: [
      { daysAgo: 19, teacherName: "Coach Anh", attended: true, durationMins: 50, scored: true },
    ],
    certs: [
      { level: "B2", status: "passed", daysAgo: 9, overallScore: 840 },
    ],
    // The star: 200 discovery + 102 lesson + 100 class + 500 cert pass = 902.
    // Inactive recently — graduated to advanced track.
    xp: 902,
    streakDays: 0,
    lastActiveDaysAgo: 9,
    nudges: [
      {
        rule: "cert_pushable",
        subject: "Ready for C1?",
        body: "Your B2 came in at 840 — well above floor. Want to schedule the C1 exam? Reply if you'd like a custom plan.",
        daysAgo: 4,
      },
      {
        rule: "inactivity_5d",
        subject: "Aria misses you, Hương",
        body: "It's been five days. A short session today resets your gap profile and gets you back on track. Five minutes is enough.",
        daysAgo: 1,
      },
    ],
  },
  {
    email: "viet.doan@industrial-eq.demo",
    name: "Đoàn Quốc Việt",
    targetLevel: "B2",
    roleKey: "bpo_operator",
    overallCefr: "A2",
    scores: {
      speaking_fluency: 380,
      listening_comprehension: 320,
      writing_formal: 280,
      reading_intent: 350,
      business_vocabulary: 300,
      presentation_delivery: 250,
    },
    summary:
      "Newly onboarded; struggling at A2/low-B1. Việt's day-to-day is mostly Vietnamese with occasional English over WhatsApp to suppliers. Reaching B2 inside 6 months will require 4–5 lessons per week minimum plus weekly classes.",
    targetWhy:
      "Employer requirement — new role demands client demos in English. No fixed deadline but progress visibility is needed for HR.",
    learningStyle:
      "Patient pace, prefers visual examples over abstract rules. Better with audio than reading. Confident written Vietnamese.",
    evidence: {
      speaking_fluency: "Long pauses; reverted to Vietnamese for two phrases mid-conversation.",
      listening_comprehension: "Asked Aria to repeat three times during the reading-intent test.",
      writing_formal: "Self-reported he writes \"only WhatsApp messages, no real emails yet\".",
      reading_intent: "Said Sarah \"wants to confirm the meeting\" — read the email literally.",
      business_vocabulary: "Reached for \"good\" and \"yes\" frequently; limited domain range.",
      presentation_delivery: "Self-described as \"never presented in English, only Vietnamese\".",
    },
    daysSinceDiscovery: 3,
    lessons: [],
    classes: [],
    // Just discovered, no lessons yet. Pure baseline 200 XP, no streak built.
    xp: 200,
    streakDays: 1,
    lastActiveDaysAgo: 3,
  },
];

type SeedResult = {
  studentsCreated: number;
  studentsUpdated: number;
  scoresWritten: number;
  lessonsWritten: number;
  classesWritten: number;
  certsWritten: number;
  nudgesWritten: number;
  rolesUpserted: number;
  baselinesUpserted: number;
};

export async function seedDemoCohort(
  supabase: SupabaseClient
): Promise<SeedResult> {
  const result: SeedResult = {
    studentsCreated: 0,
    studentsUpdated: 0,
    scoresWritten: 0,
    lessonsWritten: 0,
    classesWritten: 0,
    certsWritten: 0,
    nudgesWritten: 0,
    rolesUpserted: 0,
    baselinesUpserted: 0,
  };

  // 0a. Upsert the demo employer (find by name, create if absent).
  const { data: existingEmp, error: empSelectErr } = await supabase
    .from("employers")
    .select("id")
    .eq("name", DEMO_EMPLOYER.name)
    .maybeSingle();
  if (empSelectErr) {
    throw new Error(`employers select failed: ${empSelectErr.message}`);
  }

  let employerId: string;
  if (existingEmp?.id) {
    employerId = (existingEmp as { id: string }).id;
  } else {
    const { data: created, error: empErr } = await supabase
      .from("employers")
      .insert({
        name: DEMO_EMPLOYER.name,
        contact_email: DEMO_EMPLOYER.contactEmail,
        default_target_level: DEMO_EMPLOYER.defaultTargetLevel,
      })
      .select("id")
      .single();
    if (empErr || !created) {
      throw new Error(`employer insert failed: ${empErr?.message ?? "unknown"}`);
    }
    employerId = (created as { id: string }).id;
  }

  // 0b. Upsert roles + baselines for the demo employer. Roles are
  //     identified by (employer_id, name) so re-seeding overwrites
  //     description + un-archives without creating duplicates.
  const roleKeyToId = new Map<RoleKey, string>();
  for (const role of DEMO_ROLES) {
    const { data: existingRole, error: roleSelectErr } = await supabase
      .from("roles")
      .select("id")
      .eq("employer_id", employerId)
      .eq("name", role.name)
      .maybeSingle();
    if (roleSelectErr) {
      throw new Error(`roles select failed: ${roleSelectErr.message}`);
    }

    let roleId: string;
    if (existingRole?.id) {
      roleId = (existingRole as { id: string }).id;
      const { error: roleUpdateErr } = await supabase
        .from("roles")
        .update({
          description: role.description,
          is_archived: false,
        })
        .eq("id", roleId);
      if (roleUpdateErr) {
        throw new Error(`roles update failed: ${roleUpdateErr.message}`);
      }
    } else {
      const { data: createdRole, error: roleInsertErr } = await supabase
        .from("roles")
        .insert({
          employer_id: employerId,
          name: role.name,
          description: role.description,
        })
        .select("id")
        .single();
      if (roleInsertErr || !createdRole) {
        throw new Error(
          `roles insert failed: ${roleInsertErr?.message ?? "unknown"}`
        );
      }
      roleId = (createdRole as { id: string }).id;
    }
    roleKeyToId.set(role.key, roleId);
    result.rolesUpserted += 1;

    // Six baselines per role — upsert keyed on (role_id, skill).
    const baselineRows = (Object.keys(role.baselines) as SkillKey[]).map(
      (skill) => ({
        role_id: roleId,
        skill,
        min_score: role.baselines[skill],
      })
    );
    const { error: baselineErr } = await supabase
      .from("role_baselines")
      .upsert(baselineRows, { onConflict: "role_id,skill" });
    if (baselineErr) {
      throw new Error(`role_baselines upsert failed: ${baselineErr.message}`);
    }
    result.baselinesUpserted += baselineRows.length;
  }

  // 1. Build email → existing-userId map (paginate, but cohort is small).
  const emailToId = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email) emailToId.set(u.email, u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  for (const demo of DEMO_COHORT) {
    let userId = emailToId.get(demo.email);

    if (!userId) {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: demo.email,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: { full_name: demo.name },
        });
      if (createErr || !created.user) {
        throw new Error(
          `auth.admin.createUser failed for ${demo.email}: ${createErr?.message ?? "unknown"}`
        );
      }
      userId = created.user.id;
      result.studentsCreated += 1;
    } else {
      result.studentsUpdated += 1;
    }

    // 2. Update students row (the row was auto-created by the
    //    handle_new_user trigger when auth user was created).
    const lastActiveDate = daysAgo(demo.lastActiveDaysAgo)
      .toISOString()
      .slice(0, 10);
    const roleId = roleKeyToId.get(demo.roleKey);
    if (!roleId) {
      throw new Error(`unknown roleKey "${demo.roleKey}" for ${demo.email}`);
    }
    const { error: studentErr } = await supabase
      .from("students")
      .update({
        name: demo.name,
        email: demo.email,
        target_level: demo.targetLevel,
        discovery_status: "complete",
        xp: demo.xp,
        streak_days: demo.streakDays,
        last_active_date: lastActiveDate,
        employer_id: employerId,
        role_id: roleId,
      })
      .eq("id", userId);
    if (studentErr) {
      throw new Error(`students update failed for ${demo.email}: ${studentErr.message}`);
    }

    // 3. Upsert gap_scores. Target per skill = role baseline so the
    //    dashboard radar + skill bars line up with the buyer's role
    //    definition rather than a flat 800. Source-scoped uniqueness
    //    since migration 0017: (student_id, skill, source).
    const role = DEMO_ROLES.find((r) => r.key === demo.roleKey);
    if (!role) {
      throw new Error(`unknown role for student ${demo.email}`);
    }
    const scoreRows = (Object.keys(demo.scores) as SkillKey[]).map((skill) => ({
      student_id: userId,
      skill,
      score: demo.scores[skill],
      target: role.baselines[skill],
      source: "discovery" as const,
      is_canonical: true,
    }));
    const { error: scoresErr } = await supabase
      .from("gap_scores")
      .upsert(scoreRows, { onConflict: "student_id,skill,source" });
    if (scoresErr) {
      throw new Error(`gap_scores upsert failed for ${demo.email}: ${scoresErr.message}`);
    }
    result.scoresWritten += scoreRows.length;

    // 4. Upsert discovery_sessions (unique on convai_conversation_id —
    //    we use a deterministic synthetic value so re-seeding overwrites).
    const completedAt = daysAgo(demo.daysSinceDiscovery);
    const profileJson = {
      summary: demo.summary,
      target_level: demo.targetLevel,
      target_why: demo.targetWhy,
      learning_style_notes: demo.learningStyle,
      overall_cefr: demo.overallCefr,
      ...Object.fromEntries(
        (Object.keys(demo.scores) as SkillKey[]).map((skill) => [
          skill,
          {
            score: demo.scores[skill],
            cefr_band: cefrFromScore(demo.scores[skill]),
            evidence: demo.evidence[skill],
          },
        ])
      ),
    };
    const { error: discErr } = await supabase
      .from("discovery_sessions")
      .upsert(
        {
          student_id: userId,
          convai_conversation_id: `demo-seed-${userId}`,
          transcript_json: [],
          profile_json: profileJson,
          status: "complete",
          completed_at: completedAt.toISOString(),
        },
        { onConflict: "convai_conversation_id" }
      );
    if (discErr) {
      throw new Error(`discovery_sessions upsert failed for ${demo.email}: ${discErr.message}`);
    }

    // 5. Lessons — wipe and re-insert this student's seed lessons.
    await supabase.from("micro_lessons").delete().eq("student_id", userId);
    if (demo.lessons.length > 0) {
      const lessonRows = demo.lessons.map((l) => ({
        student_id: userId,
        type: l.type,
        skill_focus: l.type === "email_sprint" ? "writing_formal" : "speaking_fluency",
        content_json: { demo_seed: true, prompt: { scenario: "(seeded)" } },
        score_before: Math.max(0, l.scoreAfter - 8),
        score_after: l.scoreAfter,
        xp_awarded: l.xpAwarded,
        status: "completed",
        completed_at: daysAgo(l.daysAgo).toISOString(),
      }));
      const { error: lessonsErr } = await supabase
        .from("micro_lessons")
        .insert(lessonRows);
      if (lessonsErr) {
        throw new Error(`micro_lessons insert failed for ${demo.email}: ${lessonsErr.message}`);
      }
      result.lessonsWritten += lessonRows.length;
    }

    // 6. Classes — wipe and re-insert demo classes.
    await supabase.from("classin_sessions").delete().eq("student_id", userId);
    if (demo.classes.length > 0) {
      const classRows = demo.classes.map((c) => ({
        student_id: userId,
        classin_class_id: `demo-class-${userId}-${c.daysAgo}`,
        scheduled_at: daysAgo(c.daysAgo).toISOString(),
        teacher_name: c.teacherName,
        status: "completed",
        attended: c.attended,
        duration_mins: c.durationMins,
        transcribed_at: c.scored ? daysAgo(c.daysAgo - 0.1).toISOString() : null,
      }));
      const { error: classesErr } = await supabase
        .from("classin_sessions")
        .insert(classRows);
      if (classesErr) {
        throw new Error(`classin_sessions insert failed for ${demo.email}: ${classesErr.message}`);
      }
      result.classesWritten += classRows.length;
    }

    // 7a. Nudges — wipe + re-insert seeded nudges. The dedup index is on
    //     (student_id, rule, created_on::date) so each rule can land at
    //     most once per UTC day; we vary daysAgo across the seed to avoid
    //     constraint violations.
    await supabase.from("nudges").delete().eq("student_id", userId);
    if (demo.nudges && demo.nudges.length > 0) {
      const nudgeRows = demo.nudges.map((n) => {
        const sentAt = daysAgo(n.daysAgo);
        return {
          student_id: userId,
          rule: n.rule,
          channel: "email",
          type:
            n.rule === "class_tomorrow"
              ? "class_reminder"
              : n.rule === "cert_pushable"
              ? "milestone"
              : "engagement",
          subject: n.subject,
          body: n.body,
          delivery_status: "sent",
          sent_at: sentAt.toISOString(),
          created_at: sentAt.toISOString(),
        };
      });
      const { error: nudgesErr } = await supabase
        .from("nudges")
        .insert(nudgeRows);
      if (nudgesErr) {
        throw new Error(
          `nudges insert failed for ${demo.email}: ${nudgesErr.message}`
        );
      }
      result.nudgesWritten += nudgeRows.length;
    }

    // 7. Certifications — wipe and re-insert demo certs.
    await supabase.from("certifications").delete().eq("student_id", userId);
    if (demo.certs && demo.certs.length > 0) {
      const certRows = demo.certs.map((c) => {
        const issuedAt = c.status === "passed" ? daysAgo(c.daysAgo) : null;
        return {
          student_id: userId,
          level: c.level,
          status: c.status,
          tracktest_exam_id:
            c.status === "passed" ? `sim-seed-${userId}-${c.level}` : null,
          result_json:
            c.status === "passed"
              ? {
                  overall_score: c.overallScore ?? 800,
                  floor:
                    c.level === "C1"
                      ? 800
                      : c.level === "B2"
                      ? 600
                      : c.level === "B1"
                      ? 400
                      : 200,
                  passed: true,
                  note: `Passed ${c.level}.`,
                  simulated: true,
                }
              : null,
          issued_at: issuedAt?.toISOString() ?? null,
        };
      });
      const { error: certsErr } = await supabase
        .from("certifications")
        .insert(certRows);
      if (certsErr) {
        throw new Error(
          `certifications insert failed for ${demo.email}: ${certsErr.message}`
        );
      }
      result.certsWritten += certRows.length;
    }
  }

  return result;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function cefrFromScore(score: number): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" {
  if (score < 200) return "A1";
  if (score < 400) return "A2";
  if (score < 600) return "B1";
  if (score < 800) return "B2";
  if (score < 900) return "C1";
  return "C2";
}

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}
