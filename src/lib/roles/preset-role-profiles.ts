/**
 * Curated role-profile content for the 9 built-in preset roles, in the SAME
 * shape a voice-discovery interview produces (see score-role-discovery.ts) —
 * so primeContext + battery-content generation can treat a preset role and
 * a voice-interviewed role identically, instead of presets being the only
 * roles stuck on the generic prompt.
 *
 * Keyed by the preset's exact name (matches both self-setup.tsx's ROLES and
 * scripts/seed-lingopure-preset-roles.ts's PRESET_ROLES — kept in sync by
 * convention, not a shared import, since one is a client-side React array
 * and the other a plain-node seed script).
 *
 * Consumed by scripts/backfill-preset-role-profiles.ts, which writes this
 * onto every existing `roles` row whose name matches and whose profile_json
 * is still null (across every employer — self-setup creates one role row
 * per org, so the same preset name recurs under many employer_ids).
 */

import type { SkillKey } from "@/lib/scoring/rubric";

export type PresetRoleProfile = {
  responsibilities: string[];
  vocabularyDomain: string[];
  notesForLessonPlanner: string;
  skills: Record<SkillKey, { rationale: string; examples: string[] }>;
};

export const PRESET_ROLE_PROFILES: Record<string, PresetRoleProfile> = {
  "Inbound Sales": {
    responsibilities: [
      "Answer inbound calls/chats from prospects and qualify their intent",
      "Explain product fit in real time without a script",
      "Hand off qualified leads to account managers with an accurate summary",
      "Log call outcomes in the CRM",
    ],
    vocabularyDomain: ["sales qualification", "product features", "pricing tiers", "objection handling"],
    notesForLessonPlanner:
      "Lean on live inbound-call scenarios where the prospect's real need is disguised in a vague opening question — the skill being tested is decoding intent fast, not vocabulary range.",
    skills: {
      speaking: {
        rationale: "Has to think and respond in real time on a live call, not from a script.",
        examples: ["talking a confused prospect through plan options on a live call"],
      },
      listening: {
        rationale: "Must decode prospect intent — the biggest failure mode is answering the wrong question.",
        examples: ["catching that 'is this suitable for a small team' really means 'can I get a discount'"],
      },
      writing: {
        rationale: "Low written workload; CRM notes are brief internal shorthand.",
        examples: ["a one-line CRM note after each call"],
      },
      reading: {
        rationale: "Occasional lead-form or email context to skim before a callback.",
        examples: ["skimming a lead's form submission before calling back"],
      },
      grammar: {
        rationale: "Spoken accuracy matters more than written for this role.",
        examples: ["correcting a tense slip mid-call without losing the thread"],
      },
      live_interaction: {
        rationale: "Turn-taking and repair are constant — prospects interrupt, go quiet, change the subject.",
        examples: ["recovering smoothly when a prospect goes off-topic mid-pitch"],
      },
    },
  },

  "Outbound Sales": {
    responsibilities: [
      "Cold-call or cold-message prospects who did not ask to be contacted",
      "Open a conversation and earn attention before being hung up on",
      "Push past the first 'no' to the real objection",
      "Book follow-up meetings",
    ],
    vocabularyDomain: ["cold outreach", "objection handling", "closing language", "value proposition"],
    notesForLessonPlanner:
      "Prioritise confidence and recovery-from-rejection scenarios over vocabulary breadth — the job is persuasion under immediate pushback, not technical precision.",
    skills: {
      speaking: {
        rationale: "Confidence and fluency in the opening seconds determine whether the call continues at all.",
        examples: ["holding tone and pace through the first 10 seconds of a cold call despite an unfriendly opener"],
      },
      listening: {
        rationale: "Needs to catch a hesitant 'maybe' versus a hard 'no' to choose the next move.",
        examples: ["hearing the difference between a polite brush-off and genuine interest"],
      },
      writing: {
        rationale: "Mostly short outreach templates and follow-up one-liners.",
        examples: ["a two-line follow-up email after a call that didn't close"],
      },
      reading: {
        rationale: "Skims account notes before dialling; depth not required.",
        examples: ["scanning a prospect's account note before the call"],
      },
      grammar: {
        rationale: "Errors matter less than pace and conviction in a cold-outreach context.",
        examples: ["staying persuasive through a grammar slip rather than stopping to self-correct"],
      },
      live_interaction: {
        rationale: "Must keep control of the call and redirect objections without losing the prospect.",
        examples: ["pivoting smoothly when a prospect cuts in with 'we already have a vendor'"],
      },
    },
  },

  "Inbound Customer Service": {
    responsibilities: [
      "Take inbound support calls/chats from existing customers",
      "Diagnose the actual issue behind the complaint",
      "De-escalate frustrated callers",
      "Document resolution accurately",
    ],
    vocabularyDomain: ["account/billing terms", "product troubleshooting", "service-level language", "de-escalation phrasing"],
    notesForLessonPlanner:
      "Weight listening and live_interaction heavily — this role's failure mode is resolving the WRONG issue because the agent didn't listen past the customer's frustration.",
    skills: {
      speaking: {
        rationale: "Needs to reassure, not just inform, a frustrated caller.",
        examples: ["staying calm and clear while a customer is venting"],
      },
      listening: {
        rationale: "The customer leads the conversation — misunderstanding the issue means the wrong fix.",
        examples: ["realising a customer's 'it's broken' actually describes a billing error, not a product fault"],
      },
      writing: {
        rationale: "Case notes and short follow-up emails confirming resolution.",
        examples: ["writing a resolution summary a colleague can pick up later"],
      },
      reading: {
        rationale: "Reads account history and prior tickets before responding.",
        examples: ["checking a customer's ticket history before calling back"],
      },
      grammar: {
        rationale: "Clarity under pressure matters more than textbook accuracy.",
        examples: ["keeping sentences simple and correct while de-escalating"],
      },
      live_interaction: {
        rationale: "Constant repair — asking clarifying questions without sounding like they're not listening.",
        examples: ["asking 'just to confirm, is it X or Y' without frustrating an already-annoyed caller"],
      },
    },
  },

  "Inbound Tech Support": {
    responsibilities: [
      "Take technical support calls from non-technical customers",
      "Translate vague symptom descriptions into a diagnosable fault",
      "Walk a customer through a fix step by step",
      "Escalate to engineering with a precise technical writeup",
    ],
    vocabularyDomain: ["technical troubleshooting terms", "product architecture", "step-by-step instructional language", "escalation/ticketing language"],
    notesForLessonPlanner:
      "Vocabulary precision is the differentiator here, not speaking fluency — a technically precise but halting explanation beats a fluent but vague one.",
    skills: {
      speaking: {
        rationale: "Needs to explain technical steps clearly, not performatively.",
        examples: ["walking a non-technical customer through a reset procedure"],
      },
      listening: {
        rationale: "Must extract precise technical details from imprecise, non-technical descriptions.",
        examples: ["figuring out from 'it's just not working' which component actually failed"],
      },
      writing: {
        rationale: "Escalation notes to engineering must be technically precise.",
        examples: ["writing an escalation ticket engineering can act on without a follow-up call"],
      },
      reading: {
        rationale: "Reads technical documentation and prior ticket threads regularly.",
        examples: ["reading a changelog to check if a reported bug was already fixed"],
      },
      grammar: {
        rationale: "Precision matters because technical instructions are followed literally.",
        examples: ["getting the sequence of steps and conditionals right ('if X, then Y') without ambiguity"],
      },
      live_interaction: {
        rationale: "Back-and-forth diagnosis — confirming each step worked before moving to the next.",
        examples: ["checking 'did that fix it?' before moving to the next troubleshooting step"],
      },
    },
  },

  "Back Office Operations": {
    responsibilities: [
      "Process documents, forms, and internal paperwork",
      "Enter and reconcile data against source documents",
      "Produce internal reports",
      "Rarely speak to customers directly",
    ],
    vocabularyDomain: ["operational/process terminology", "internal reporting language", "data/record-keeping terms"],
    notesForLessonPlanner:
      "This is a document-in, document-out function — spend lesson time on written precision and reading comprehension, not conversational fluency.",
    skills: {
      speaking: {
        rationale: "Spoken English is incidental to this role, mostly internal check-ins.",
        examples: ["a short status update in a team standup"],
      },
      listening: {
        rationale: "Internal instructions only, low stakes.",
        examples: ["following a verbal handover from a colleague"],
      },
      writing: {
        rationale: "The core output of the role — precision matters because output feeds other processes.",
        examples: ["writing a reconciliation note that another team relies on without re-checking"],
      },
      reading: {
        rationale: "Reads source documents and internal procedures constantly.",
        examples: ["reading a supplier invoice against a purchase order line by line"],
      },
      grammar: {
        rationale: "Written accuracy is the highest-stakes skill here — errors propagate downstream.",
        examples: ["getting dates, figures, and references exactly right in a written report"],
      },
      live_interaction: {
        rationale: "Minimal real-time spoken exchange required.",
        examples: ["a brief handover conversation at shift change"],
      },
    },
  },

  "Quality Assurance": {
    responsibilities: [
      "Listen to or read recorded customer interactions",
      "Score interactions against a quality rubric",
      "Write evaluation feedback for agents",
      "Identify systemic issues across many interactions",
    ],
    vocabularyDomain: ["quality rubric/scoring language", "coaching/feedback phrasing", "compliance terminology"],
    notesForLessonPlanner:
      "The core skill is analytical writing — producing feedback another person will act on — not live conversation.",
    skills: {
      speaking: {
        rationale: "Occasional verbal coaching sessions with agents.",
        examples: ["talking an agent through a missed scoring point"],
      },
      listening: {
        rationale: "Needs to catch subtle quality issues in recorded calls, not just the obvious ones.",
        examples: ["noticing an agent technically answered the question but missed the customer's real concern"],
      },
      writing: {
        rationale: "Produces written evaluations that must be specific and actionable.",
        examples: ["writing feedback an agent can actually act on, not just 'needs improvement'"],
      },
      reading: {
        rationale: "Reads transcripts and rubric criteria closely.",
        examples: ["cross-checking a call transcript against every rubric line item"],
      },
      grammar: {
        rationale: "Feedback must read as professional and precise, since agents take it as a formal record.",
        examples: ["writing a grammatically clean evaluation that reads as credible, not sloppy"],
      },
      live_interaction: {
        rationale: "Some back-and-forth in calibration sessions with other evaluators.",
        examples: ["defending a score in a calibration discussion with another QA reviewer"],
      },
    },
  },

  "Recruitment / HR": {
    responsibilities: [
      "Screen candidates by phone or video",
      "Read and shortlist resumes",
      "Write job postings and internal policies",
      "Run interviews and give feedback to hiring managers",
    ],
    vocabularyDomain: ["HR/recruitment terminology", "interview phrasing", "policy/compliance language"],
    notesForLessonPlanner:
      "No single skill dominates — the role shifts between reading, speaking, and writing within the same day, so balance practice across all three rather than specialising.",
    skills: {
      speaking: {
        rationale: "Runs live phone/video screens where rapport and clarity matter.",
        examples: ["putting a nervous candidate at ease in the first minute of a screen"],
      },
      listening: {
        rationale: "Must catch what a candidate is NOT saying, not just what they are.",
        examples: ["noticing a candidate deflecting when asked about a gap in their work history"],
      },
      writing: {
        rationale: "Writes job postings and policies that must be clear to a general audience.",
        examples: ["writing a job posting that doesn't quietly discourage qualified candidates with jargon"],
      },
      reading: {
        rationale: "Reads resumes and cover letters quickly and critically.",
        examples: ["spotting inflated claims on a resume against what the interview reveals"],
      },
      grammar: {
        rationale: "Policy documents in particular need to be precise, since they're read literally.",
        examples: ["writing a leave policy where ambiguous wording would create real disputes"],
      },
      live_interaction: {
        rationale: "Interviews are a real-time two-way exchange, not a script.",
        examples: ["following up on an unexpected answer instead of moving to the next scripted question"],
      },
    },
  },

  "Accounts / Finance": {
    responsibilities: [
      "Prepare financial reports and statements",
      "Reconcile accounts against source records",
      "Correspond in writing with vendors/auditors on financial matters",
      "Rarely interact live in English",
    ],
    vocabularyDomain: ["financial/accounting terminology", "invoicing and payment terms", "audit/compliance language"],
    notesForLessonPlanner:
      "Document-driven function — writing precision prevents real financial risk, so weight writing and grammar far above speaking.",
    skills: {
      speaking: {
        rationale: "Spoken English is rare and low-stakes for this role.",
        examples: ["a brief verbal update to a manager on a reconciliation status"],
      },
      listening: {
        rationale: "Occasional verbal instructions from finance leadership.",
        examples: ["following a verbal change to a reporting deadline"],
      },
      writing: {
        rationale: "The primary output — a wording error in a financial document is a real risk, not a style issue.",
        examples: ["writing a variance explanation that an auditor will scrutinise line by line"],
      },
      reading: {
        rationale: "Reads contracts, invoices, and financial statements closely.",
        examples: ["catching a discrepancy between a contract's payment terms and an invoice"],
      },
      grammar: {
        rationale: "Highest-stakes skill in this role — ambiguous wording in a financial document creates real risk.",
        examples: ["getting currency, date, and quantity references unambiguous in a written report"],
      },
      live_interaction: {
        rationale: "Minimal real-time exchange required.",
        examples: ["a short clarifying question to a vendor over email, rarely live"],
      },
    },
  },

  "Training / L&D": {
    responsibilities: [
      "Deliver live training sessions to staff",
      "Design training materials and slide decks",
      "Answer questions from trainees in real time",
      "Adjust delivery pace based on the room's comprehension",
    ],
    vocabularyDomain: ["instructional/presentation language", "subject-matter terminology being taught", "facilitation phrasing"],
    notesForLessonPlanner:
      "Training IS delivery — if the trainer can't present fluently and confidently, nothing else about the role matters. Weight speaking heavily.",
    skills: {
      speaking: {
        rationale: "Delivery IS the job — a trainer who can't present clearly fails regardless of subject knowledge.",
        examples: ["holding a room's attention through a 20-minute live training segment"],
      },
      listening: {
        rationale: "Needs to catch confused follow-up questions mid-session and adjust.",
        examples: ["recognising a trainee's question signals the whole room is lost, not just one person"],
      },
      writing: {
        rationale: "Produces training materials and slide content.",
        examples: ["writing slide content that's clear read cold, without the trainer's spoken explanation"],
      },
      reading: {
        rationale: "Reads source material to build training content from.",
        examples: ["reading a technical manual to extract what trainees actually need to know"],
      },
      grammar: {
        rationale: "Materials are read by trainees without the trainer present to clarify, so clarity matters.",
        examples: ["writing instructions trainees can follow correctly without asking a follow-up question"],
      },
      live_interaction: {
        rationale: "Fields live questions and redirects discussion without losing the room.",
        examples: ["handling an off-topic question without derailing the session"],
      },
    },
  },
};
