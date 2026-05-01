/**
 * Demo LingoPure teaching staff + ABC Manufacturer student assignments.
 *
 * Sits alongside abc-personas.ts and runs from the same seed script.
 * Provisional shape — when LingoPure shares their real org chart we
 * swap the data, not the schema.
 *
 * Assignment heuristic:
 *   - Speaking-heavy roles (BPO, sales, customer service) → primary
 *     teacher from the Speaking department
 *   - Writing-heavy roles (procurement, engineering, QA lead) → primary
 *     from Writing & Business English
 *   - QA Lead also gets a Speaking specialist (cross-department coverage)
 *   - One persona is assigned to the AI tutor as a forward-looking demo
 */

import type { AbcRoleKey } from "./abc-personas";

export const ABC_DEPARTMENTS = [
  {
    name: "Speaking & Conversational",
    focus:
      "Live calls, customer-facing speech, presentation delivery, listening under accent pressure.",
  },
  {
    name: "Writing & Business English",
    focus:
      "Email register, formal documents, contracts, technical and reading-intent work.",
  },
] as const;

export type AbcDepartmentName = (typeof ABC_DEPARTMENTS)[number]["name"];

export type AbcTeacher = {
  /** Used as the local-part of the synthetic email. */
  slug: string;
  fullName: string;
  bio: string;
  employmentType: "in_house" | "contractor" | "ai_tutor";
  /** Departments this teacher belongs to. First entry is their "home". */
  departments: AbcDepartmentName[];
  /** Department they're the head of, if any. */
  headOf?: AbcDepartmentName;
  /** Pretend ClassIn id — null for AI tutors. */
  classinAccountId: string | null;
};

export const ABC_TEACHERS: AbcTeacher[] = [
  {
    slug: "linh.tran",
    fullName: "Coach Linh Trần",
    bio: "10 years coaching Vietnamese B2B professionals on speaking confidence and customer-facing English. Hosts the live BPO conversation labs.",
    employmentType: "in_house",
    departments: ["Speaking & Conversational"],
    headOf: "Speaking & Conversational",
    classinAccountId: "classin-linh-tran",
  },
  {
    slug: "anh.pham",
    fullName: "Coach Anh Phạm",
    bio: "Sales-focused coach. Worked five years inside Australian export accounts before pivoting to teaching. Specialty: negotiation and price-defence dialogues.",
    employmentType: "contractor",
    departments: ["Speaking & Conversational"],
    classinAccountId: "classin-anh-pham",
  },
  {
    slug: "sarah.nguyen",
    fullName: "Coach Sarah Nguyễn",
    bio: "Cambridge-trained writing coach. Builds executive-tone email and report skills for engineers and procurement professionals.",
    employmentType: "in_house",
    departments: ["Writing & Business English"],
    headOf: "Writing & Business English",
    classinAccountId: "classin-sarah-nguyen",
  },
  {
    slug: "aria-tutor",
    fullName: "Aria (AI tutor)",
    bio: "Always-on AI tutor for between-class drills. Handles vocabulary sprints, listening warm-ups, and email rewrite practice.",
    employmentType: "ai_tutor",
    departments: ["Speaking & Conversational", "Writing & Business English"],
    classinAccountId: null,
  },
];

/** Maps a persona's role to (primary teacher slug, optional specialist slug). */
export const ABC_ASSIGNMENT_BY_ROLE: Record<
  AbcRoleKey,
  { primary: string; specialist?: string }
> = {
  production_operator: { primary: "linh.tran" },
  qa_lead: { primary: "sarah.nguyen", specialist: "linh.tran" },
  manuf_sales_rep: { primary: "anh.pham", specialist: "sarah.nguyen" },
  procurement_officer: { primary: "sarah.nguyen" },
  engineering_specialist: { primary: "sarah.nguyen", specialist: "anh.pham" },
  customer_service_lead: { primary: "linh.tran" },
};

/**
 * One persona gets assigned to Aria the AI tutor instead of a human
 * primary — used as the demo for the AI-tutor track.
 */
export const ABC_AI_TUTOR_PERSONA_SLUG = "le.thi.mai";
