import { z } from "zod";

/** Book-a-demo — the corporate proposal intake.
 *  Two-sided by design: the LP side is the offering showcase on the page;
 *  this schema captures the booker's side (the org details that let LP build
 *  a full proposal). Single source of truth for the server action + client
 *  form (types are shared; the length/set constraints mirror the UI).
 */

export const PREFERRED_CONTACT_METHODS = [
  "Zalo",
  "WhatsApp",
  "Phone",
  "Email",
] as const;

export const ENGLISH_LEVELS = [
  "Beginner (A1–A2)",
  "Intermediate (B1)",
  "Upper-intermediate (B2)",
  "Advanced (C1–C2)",
  "Not sure yet",
] as const;

export const LEARNING_GOALS = [
  "Meetings & calls",
  "Presentations",
  "Negotiations",
  "Writing & email",
  "Listening & comprehension",
  "Speaking confidence",
  "Leadership & management English",
  "Customer-facing English",
] as const;

export const COMPANY_SIZES = ["1–49", "50–199", "200–499", "500+"] as const;

export const INDUSTRIES = [
  "Manufacturing",
  "Logistics & supply chain",
  "Banking & finance",
  "Retail & e-commerce",
  "Technology",
  "Professional services",
  "Education",
  "Healthcare",
  "Construction",
  "Other",
] as const;

export const HQ_MARKETS = ["Vietnam", "South East Asia", "Global", "Other"] as const;

export const START_TIMELINES = [
  "ASAP",
  "1–3 months",
  "3–6 months",
  "Just exploring",
] as const;

export const CURRENT_TRAINING = [
  "None",
  "In-house",
  "External provider",
  "Not sure",
] as const;

export const DEMO_BOOKING_STEPS = [
  "contact",
  "organisation",
  "schedule",
] as const;

export type DemoBookingStep = (typeof DEMO_BOOKING_STEPS)[number];

export const demoBookingSchema = z.object({
  contact: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1),
    email: z.string().trim().min(1).email(),
    phone: z.string().trim(),
    preferredContact: z.enum(PREFERRED_CONTACT_METHODS),
  }),
  organisation: z.object({
    company: z.string().trim().min(1),
    industry: z.enum(INDUSTRIES),
    companySize: z.enum(COMPANY_SIZES),
    hqMarket: z.enum(HQ_MARKETS),
    targetLearners: z.coerce.number().int().min(1).max(100000),
    learnerRoles: z.string().trim().min(1),
    englishLevels: z.array(z.enum(ENGLISH_LEVELS)).min(1),
    currentTraining: z.enum(CURRENT_TRAINING),
    currentProvider: z.string().trim().optional().or(z.literal("")),
    goals: z.array(z.enum(LEARNING_GOALS)).min(1).max(3),
    whyNow: z.string().trim().min(1),
    startTimeline: z.enum(START_TIMELINES),
    decisionTimeframe: z.string().trim().min(1),
    repReferralEmail: z.string().trim().email().optional().or(z.literal("")),
  }),
  schedule: z.object({
    preferredDate: z.string().min(1),
    preferredTime: z.string().min(1),
    timezone: z.string().min(1).default("UTC+7 (ICT)"),
    notes: z.string().trim().optional().or(z.literal("")),
  }),
  source: z.string().min(1).default("website"),
});

export type DemoBookingInput = z.infer<typeof demoBookingSchema>;

/** Flat column-mapped row for the demo_bookings table (camelCase -> snake_case). */
export function toDemoBookingRow(input: DemoBookingInput) {
  return {
    first_name: input.contact.firstName,
    last_name: input.contact.lastName,
    job_title: input.contact.jobTitle || null,
    email: input.contact.email,
    phone: input.contact.phone || null,
    preferred_contact: input.contact.preferredContact,

    company: input.organisation.company,
    industry: input.organisation.industry,
    company_size: input.organisation.companySize,
    hq_market: input.organisation.hqMarket,
    target_learners: input.organisation.targetLearners,
    learner_roles: input.organisation.learnerRoles,
    english_levels: input.organisation.englishLevels,
    current_training: input.organisation.currentTraining,
    current_provider: input.organisation.currentProvider || null,
    goals: input.organisation.goals,
    why_now: input.organisation.whyNow,
    start_timeline: input.organisation.startTimeline,
    decision_timeframe: input.organisation.decisionTimeframe,
    rep_referral_email: input.organisation.repReferralEmail || null,

    preferred_date: input.schedule.preferredDate,
    preferred_time: input.schedule.preferredTime,
    timezone: input.schedule.timezone,
    notes: input.schedule.notes || null,

    source: input.source,
    raw: input as unknown as Record<string, unknown>,
  } as const;
}

export const firstSchemaIssue = (error: z.ZodError): string => {
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path) return `${path}: ${issue.message}`;
    return issue.message;
  }
  return "Please complete all required fields.";
};