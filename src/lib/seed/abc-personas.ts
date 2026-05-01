/**
 * ABC Manufacturer (test org) — role + persona definitions.
 *
 * Drives scripts/seed-abc-manufacturer.ts. The personas here are SYNTHETIC
 * (no real people) but the seed pipeline runs them through the live Claude
 * scoring path — a transcript is generated in-character at each persona's
 * stated proficiency, then scored by the real /lib/scoring/score-discovery
 * code. So: simulated humans, real LLM assessment.
 */

import type { SkillKey } from "@/lib/scoring/rubric";

export const ABC_EMPLOYER = {
  name: "ABC Manufacturer",
  contactEmail: "hr@abc-manufacturer.demo",
  defaultTargetLevel: "B2" as const,
};

export const ABC_ADMIN = {
  email: "mcmdennis@gmail.com",
  password: "Logoinabc123",
  fullName: "Dennis McMahon (ABC admin)",
  targetLevel: "C1" as const,
};

export type AbcRoleKey =
  | "production_operator"
  | "qa_lead"
  | "manuf_sales_rep"
  | "procurement_officer"
  | "engineering_specialist"
  | "customer_service_lead";

export type AbcRole = {
  key: AbcRoleKey;
  name: string;
  description: string;
  /** 0–1000 scale per skill (post-rescale migration 0011). */
  baselines: Record<SkillKey, number>;
};

export const ABC_ROLES: AbcRole[] = [
  {
    key: "production_operator",
    name: "Production Operator",
    description:
      "Assembly-line operator on shifts at the Bình Dương plant. Reads English work instructions and safety bulletins from the German machinery vendor. Brief verbal exchanges with foreign supervisors during line audits. Almost no writing.",
    baselines: {
      speaking_fluency: 600,
      listening_comprehension: 700,
      writing_formal: 400,
      reading_intent: 500,
      business_vocabulary: 500,
      presentation_delivery: 300,
    },
  },
  {
    key: "qa_lead",
    name: "Quality Assurance Lead",
    description:
      "Coordinates between operators (Vietnamese-only) and the foreign engineering team. Reads spec sheets and ISO docs in English; writes incident reports and corrective-action notes; runs short stand-ups with the visiting QA delegation.",
    baselines: {
      speaking_fluency: 700,
      listening_comprehension: 750,
      writing_formal: 700,
      reading_intent: 750,
      business_vocabulary: 700,
      presentation_delivery: 600,
    },
  },
  {
    key: "manuf_sales_rep",
    name: "Manufacturing Sales Rep",
    description:
      "B2B sales rep handling export accounts in Australia, Singapore, and the UK. Negotiates prices, drafts proposals, and presents quarterly reviews to client procurement teams over Teams calls.",
    baselines: {
      speaking_fluency: 800,
      listening_comprehension: 750,
      writing_formal: 750,
      reading_intent: 800,
      business_vocabulary: 800,
      presentation_delivery: 750,
    },
  },
  {
    key: "procurement_officer",
    name: "Procurement Officer",
    description:
      "Sources raw materials from international suppliers. Reads contracts and incoterms documents; drafts purchase orders and clarification emails; runs supplier-call follow-ups in English.",
    baselines: {
      speaking_fluency: 700,
      listening_comprehension: 700,
      writing_formal: 800,
      reading_intent: 800,
      business_vocabulary: 750,
      presentation_delivery: 600,
    },
  },
  {
    key: "engineering_specialist",
    name: "Engineering Specialist",
    description:
      "Handles technical documentation, troubleshooting calls with foreign equipment vendors, and design-review meetings. Writes detailed RCA reports; reads dense technical PDFs; presents engineering changes to mixed local/foreign audiences.",
    baselines: {
      speaking_fluency: 700,
      listening_comprehension: 750,
      writing_formal: 850,
      reading_intent: 850,
      business_vocabulary: 800,
      presentation_delivery: 650,
    },
  },
  {
    key: "customer_service_lead",
    name: "Customer Service Lead",
    description:
      "Front-line on phone + chat with English-speaking distributors and end customers. Handles complaints, follow-ups, and warranty claims — speaking and listening under time pressure dominate the day.",
    baselines: {
      speaking_fluency: 800,
      listening_comprehension: 800,
      writing_formal: 700,
      reading_intent: 750,
      business_vocabulary: 750,
      presentation_delivery: 650,
    },
  },
];

export type AbcPersona = {
  /** Used as the email local-part: `${slug}@abc-manufacturer.demo`. */
  slug: string;
  fullName: string;
  roleKey: AbcRoleKey;
  /** Personal aspiration — usually one band above their current level. */
  targetLevel: "A2" | "B1" | "B2" | "C1" | "C2";
  /** Discovery WHY — drives target_why in profile_json. */
  targetWhy: string;
  /** Free text used by the transcript generator to "be" this persona. */
  personaNotes: string;
  /** Coarse self-assessment so the transcript generator stays calibrated. */
  proficiencyBand: "A2" | "B1" | "B2" | "C1";
  /** Years in role — flavour for the transcript. */
  yearsInRole: number;
};

export const ABC_PERSONAS: AbcPersona[] = [
  // ── Production Operators ──────────────────────────────────────────────────
  {
    slug: "le.thi.mai",
    fullName: "Lê Thị Mai",
    roleKey: "production_operator",
    targetLevel: "B1",
    targetWhy:
      "New German line foreman is rotating in next quarter — every operator needs to follow English safety briefings without a translator.",
    personaNotes:
      "Mid-30s, three years on the line. Studied English in school but rarely uses it. Hesitates often, mixes Vietnamese filler words ('thì', 'là'), simple vocabulary. Comfortable with numbers and machine names but not abstract talk. Eager to learn — sees it as job security.",
    proficiencyBand: "A2",
    yearsInRole: 3,
  },
  {
    slug: "phan.van.tung",
    fullName: "Phan Văn Tùng",
    roleKey: "production_operator",
    targetLevel: "B2",
    targetWhy:
      "Wants the shift-supervisor promotion that opens up next year. The supervisor running the morning briefings does it half in English.",
    personaNotes:
      "Late 20s, ambitious. Watches English YouTube on commute. Decent listening, weaker speaking — pauses to construct sentences. Knows shop-floor terminology well. Reads safety bulletins fine but writing is choppy.",
    proficiencyBand: "B1",
    yearsInRole: 4,
  },
  // ── QA Leads ──────────────────────────────────────────────────────────────
  {
    slug: "nguyen.hoang.long",
    fullName: "Nguyễn Hoàng Long",
    roleKey: "qa_lead",
    targetLevel: "B2",
    targetWhy:
      "Promoted six months ago and now sits in the weekly engineering call with the German parent. Misses about a third of the discussion.",
    personaNotes:
      "Engineering background. Vocabulary in his domain (tolerances, defects, calibration) is strong; everyday business English is weaker. Self-corrects mid-sentence. Strong reading, struggles with fast accented speech.",
    proficiencyBand: "B1",
    yearsInRole: 1,
  },
  {
    slug: "tran.thi.phuong",
    fullName: "Trần Thị Phượng",
    roleKey: "qa_lead",
    targetLevel: "C1",
    targetWhy:
      "Wants to lead the next ISO audit cycle — it'll be conducted entirely in English by an Australian audit firm.",
    personaNotes:
      "Solid B2. Confident in technical vocabulary. Some L1 interference on word order in longer sentences. Can hold a 5-minute call comfortably; longer presentations still tire her.",
    proficiencyBand: "B2",
    yearsInRole: 5,
  },
  // ── Sales Reps ────────────────────────────────────────────────────────────
  {
    slug: "do.minh.tuan",
    fullName: "Đỗ Minh Tuấn",
    roleKey: "manuf_sales_rep",
    targetLevel: "C1",
    targetWhy:
      "Just inherited the Australia portfolio after the previous rep left. Three accounts have already commented on his email tone being 'a bit blunt'.",
    personaNotes:
      "Charismatic in person, struggles in writing. Functional B1+ speaker — gets the sale done but with effort. Reaches for simple words ('good', 'fine'). Reads emails accurately enough but misses tonal nuance.",
    proficiencyBand: "B1",
    yearsInRole: 2,
  },
  {
    slug: "bui.thi.hang",
    fullName: "Bùi Thị Hằng",
    roleKey: "manuf_sales_rep",
    targetLevel: "C1",
    targetWhy:
      "Pitching the new product line to a Singapore distributor in two months — needs to handle Q&A confidently.",
    personaNotes:
      "Strong B2 across the board. Polished email register. Speaking is fluent but with some hesitation on abstract topics. Reads commercial nuance well.",
    proficiencyBand: "B2",
    yearsInRole: 6,
  },
  // ── Procurement ───────────────────────────────────────────────────────────
  {
    slug: "vu.duc.hai",
    fullName: "Vũ Đức Hải",
    roleKey: "procurement_officer",
    targetLevel: "C1",
    targetWhy:
      "Negotiating a new long-term steel contract with a Korean mill — the contract drafts are dense and the back-and-forth is fast over Teams.",
    personaNotes:
      "Reads contracts well, writes precise emails. Speaking is the gap — particularly on calls with native speakers who talk fast. Tends to over-formalise spoken English.",
    proficiencyBand: "B2",
    yearsInRole: 7,
  },
  {
    slug: "pham.thi.linh",
    fullName: "Phạm Thị Linh",
    roleKey: "procurement_officer",
    targetLevel: "B1",
    targetWhy:
      "Recently moved over from finance — the role demands much more English than she expected.",
    personaNotes:
      "Limited business English. Comfortable with numbers and standard PO terminology but stumbles on negotiation language. Tends to keep emails very short to avoid mistakes. Learning fast but starting low.",
    proficiencyBand: "A2",
    yearsInRole: 1,
  },
  // ── Engineering ───────────────────────────────────────────────────────────
  {
    slug: "hoang.van.quan",
    fullName: "Hoàng Văn Quân",
    roleKey: "engineering_specialist",
    targetLevel: "C1",
    targetWhy:
      "Presenting a root-cause analysis to the parent-company engineering board next quarter — first time in English.",
    personaNotes:
      "Solid technical writing. Confident reading dense PDFs. Speaking is the gap — comfortable in 1-on-1 but tense in group meetings. Vocabulary deep in mechanical/electrical engineering.",
    proficiencyBand: "B2",
    yearsInRole: 8,
  },
  {
    slug: "ly.thi.hong",
    fullName: "Lý Thị Hồng",
    roleKey: "engineering_specialist",
    targetLevel: "C2",
    targetWhy:
      "Lead engineer on a joint venture with a UK firm — basically embedded with their team for 12 months.",
    personaNotes:
      "Already C1 — fluent and precise. Studied a year in Manchester. Wants polish: idiomatic register, executive-tone presentations, reducing minor L1 article drops.",
    proficiencyBand: "C1",
    yearsInRole: 9,
  },
  // ── Customer Service ──────────────────────────────────────────────────────
  {
    slug: "dang.van.phong",
    fullName: "Đặng Văn Phong",
    roleKey: "customer_service_lead",
    targetLevel: "C1",
    targetWhy:
      "Took over the English-speaking complaint queue last month. Dreads escalation calls — feels he's letting customers down.",
    personaNotes:
      "Functional B1 speaker. Listens better than he speaks. Hesitations under pressure; resorts to scripted phrases when stuck. Reads written complaints accurately but his replies sound flat.",
    proficiencyBand: "B1",
    yearsInRole: 2,
  },
  {
    slug: "trinh.thi.ngoc",
    fullName: "Trịnh Thị Ngọc",
    roleKey: "customer_service_lead",
    targetLevel: "C2",
    targetWhy:
      "Career goal — wants to move into the regional CX manager role, which is held by an Australian today.",
    personaNotes:
      "Strong C1. Calm and precise on calls; warm tone in writing. Looking for advanced polish — managing difficult conversations with a measured native-equivalent register.",
    proficiencyBand: "C1",
    yearsInRole: 6,
  },
];
