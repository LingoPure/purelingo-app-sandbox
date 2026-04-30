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

type DemoStudent = {
  email: string;
  name: string;
  targetLevel: "A2" | "B1" | "B2" | "C1" | "C2";
  scores: Record<SkillKey, number>;
  overallCefr: "A2" | "B1" | "B2" | "C1" | "C2";
  summary: string;
  targetWhy: string;
  learningStyle: string;
  evidence: Record<SkillKey, string>;
  daysSinceDiscovery: number;
  lessons: DemoLesson[];
  classes: DemoClass[];
};

const DEMO_COHORT: DemoStudent[] = [
  {
    email: "ha.nguyen@vinhhoan-export.demo",
    name: "Nguyễn Thị Hà",
    targetLevel: "B2",
    overallCefr: "B1",
    scores: {
      speaking_fluency: 58,
      listening_comprehension: 55,
      writing_formal: 48,
      reading_intent: 62,
      business_vocabulary: 52,
      presentation_delivery: 45,
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
      { type: "email_sprint", daysAgo: 9, xpAwarded: 64, scoreAfter: 56 },
      { type: "speak_score", daysAgo: 6, xpAwarded: 71, scoreAfter: 60 },
      { type: "email_sprint", daysAgo: 2, xpAwarded: 78, scoreAfter: 64 },
    ],
    classes: [
      { daysAgo: 8, teacherName: "Coach Linh", attended: true, durationMins: 45, scored: true },
      { daysAgo: 1, teacherName: "Coach Linh", attended: true, durationMins: 50, scored: false },
    ],
  },
  {
    email: "minh.tran@hanoi-manuf.demo",
    name: "Trần Văn Minh",
    targetLevel: "B2",
    overallCefr: "B2",
    scores: {
      speaking_fluency: 70,
      listening_comprehension: 68,
      writing_formal: 62,
      reading_intent: 72,
      business_vocabulary: 65,
      presentation_delivery: 60,
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
      { type: "email_sprint", daysAgo: 14, xpAwarded: 81, scoreAfter: 67 },
      { type: "speak_score", daysAgo: 4, xpAwarded: 85, scoreAfter: 70 },
    ],
    classes: [
      { daysAgo: 12, teacherName: "Coach Anh", attended: true, durationMins: 50, scored: true },
    ],
  },
  {
    email: "anh.le@bizdev-sg.demo",
    name: "Lê Hoàng Anh",
    targetLevel: "C1",
    overallCefr: "B1",
    scores: {
      speaking_fluency: 50,
      listening_comprehension: 48,
      writing_formal: 42,
      reading_intent: 55,
      business_vocabulary: 45,
      presentation_delivery: 40,
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
      { type: "email_sprint", daysAgo: 6, xpAwarded: 51, scoreAfter: 44 },
      { type: "speak_score", daysAgo: 5, xpAwarded: 48, scoreAfter: 42 },
      { type: "email_sprint", daysAgo: 4, xpAwarded: 56, scoreAfter: 48 },
      { type: "speak_score", daysAgo: 2, xpAwarded: 62, scoreAfter: 51 },
      { type: "email_sprint", daysAgo: 1, xpAwarded: 65, scoreAfter: 53 },
    ],
    classes: [],
  },
  {
    email: "huong.pham@vingroup-hr.demo",
    name: "Phạm Thu Hương",
    targetLevel: "B2",
    overallCefr: "C1",
    scores: {
      speaking_fluency: 86,
      listening_comprehension: 84,
      writing_formal: 82,
      reading_intent: 88,
      business_vocabulary: 80,
      presentation_delivery: 84,
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
      { type: "speak_score", daysAgo: 13, xpAwarded: 102, scoreAfter: 85 },
    ],
    classes: [
      { daysAgo: 19, teacherName: "Coach Anh", attended: true, durationMins: 50, scored: true },
    ],
  },
  {
    email: "viet.doan@industrial-eq.demo",
    name: "Đoàn Quốc Việt",
    targetLevel: "B2",
    overallCefr: "A2",
    scores: {
      speaking_fluency: 38,
      listening_comprehension: 32,
      writing_formal: 28,
      reading_intent: 35,
      business_vocabulary: 30,
      presentation_delivery: 25,
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
  },
];

type SeedResult = {
  studentsCreated: number;
  studentsUpdated: number;
  scoresWritten: number;
  lessonsWritten: number;
  classesWritten: number;
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
  };

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
    const { error: studentErr } = await supabase
      .from("students")
      .update({
        name: demo.name,
        email: demo.email,
        target_level: demo.targetLevel,
        discovery_status: "complete",
      })
      .eq("id", userId);
    if (studentErr) {
      throw new Error(`students update failed for ${demo.email}: ${studentErr.message}`);
    }

    // 3. Upsert gap_scores (unique student_id+skill).
    const scoreRows = (Object.keys(demo.scores) as SkillKey[]).map((skill) => ({
      student_id: userId,
      skill,
      score: demo.scores[skill],
      target: 80,
      source: "discovery" as const,
    }));
    const { error: scoresErr } = await supabase
      .from("gap_scores")
      .upsert(scoreRows, { onConflict: "student_id,skill" });
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
  }

  return result;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function cefrFromScore(score: number): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" {
  if (score < 20) return "A1";
  if (score < 40) return "A2";
  if (score < 60) return "B1";
  if (score < 80) return "B2";
  if (score < 90) return "C1";
  return "C2";
}

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}
