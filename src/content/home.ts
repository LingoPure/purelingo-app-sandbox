/**
 * Marketing homepage content — the single source of copy for the sales-flow
 * canvas. Draft messaging is REAL (so reviewers react to actual copy) but is
 * marked with a status + explainer note: `pending` (comes from customer
 * research), `confirm` (validate before launch), `ready` (final, ships now).
 * Genuinely unfillable sub-items are `EmptySlot`s (problem 2–3, individual
 * outcomes, testimonials, FAQ answers, the report image).
 *
 * Copy lives here, not in components, so it is editable in one place without
 * code surgery. (Bilingual VI wiring is deferred until copy is validated —
 * translating draft-to-be-replaced copy isn't worth it yet.)
 */
import type { Annotation, BlockStatus } from "@/content/types";

type Anno = Annotation & { status: BlockStatus };
type Cta = { label: string; href: string; ghost?: boolean };
type Slot = { title: string; note: string };

export const home = {
  nav: {
    links: [
      { label: "For companies", href: "/for-companies" },
      { label: "For individuals", href: "/for-individuals" },
      { label: "Method", href: "/method" },
      { label: "The report", href: "/#proof" },
    ],
    cta: { label: "Try the demo", href: "/demo" },
  },

  hero: {
    stage: "01 · Promise",
    anno: {
      status: "pending",
      label: "Evidence pending — highest value sentence on the site",
      note: 'H1 below is a placeholder. Final headline comes from research Q7: "what can you do now that you couldn\'t before", B2C segment. Under 12 words. No carousel. Existing line "Close your team\'s English gap, and prove it." is strong — but it is B2B-only, so it moves to /for-companies rather than the homepage.',
    } as Anno,
    eyebrow: "Business English · Vietnam & Southeast Asia",
    h1: "English that holds up when it actually counts.",
    lede: "Placement in one class. Progress you can see. Certification you can show. For teams that need to work in English, and for professionals who need to be heard in it.",
    ctas: [
      { label: "Try a free demo class", href: "/demo" },
      { label: "I'm looking for my team", href: "/for-companies", ghost: true },
    ] as Cta[],
    micro: "Free · 45 minutes · you receive an LP-18 placement report either way",
  },

  trust: {
    stage: "02 · Permission",
    // Consent-gated: only logos with consent:true ever render. None hold
    // written consent today, so the logo strip renders nothing. (Client 03/04
    // deleted — lorem in a suit.)
    logos: [
      { name: "Tradeland", consent: false },
      { name: "DatumHQ", consent: false },
    ] as { name: string; consent: boolean }[],
    // No invented number. A real, sourced figure goes here with a real value.
    statValue: null as string | null,
    statLabel: "placement reports issued",
    logosSlot: {
      title: "Logo strip pending",
      note: "Written usage consent required per client before any logo displays.",
    } as Slot,
    statSlot: {
      title: "Stat pending",
      note: "A real, defensible, sourced figure only — no placeholder number.",
    } as Slot,
    anno: {
      status: "confirm",
      label: "Confirm before launch",
      note: 'Written logo usage consent required for every client shown. If we don\'t hold it, use descriptors ("a Vietnamese logistics firm") until we do. The stat must be a real, defensible number — pick one and source it.',
    } as Anno,
  },

  problem: {
    stage: "03 · Problem",
    eyebrow: "The situation",
    h2: "Most people here don't need more English. They need it to work under pressure.",
    anno: {
      status: "pending",
      label: "Evidence pending — do not write this from the pitch deck",
      note: 'Quote 01 below is ILLUSTRATIVE and must be replaced with a real verbatim before launch. Quotes 02 and 03 await interviews (research Q1 "what were you trying to fix", Q2 "what had you already tried that didn\'t work"). If we write these ourselves they read as communication-friction/telemetry copy — the customer version sells.',
    } as Anno,
    quote: {
      text: "I can read English fine. I freeze the moment I have to speak in the meeting.",
      // Editorial caveat lives in the annotation, never in data. Null renders
      // nothing (no empty <cite>, no dash) — nothing here leaks into clean view.
      attribution: null as string | null,
    },
    slots: [
      {
        title: "Problem statement 02",
        note: "Awaiting verbatim · B2B learner segment · source: interview, question 1",
      },
      {
        title: "Problem statement 03",
        note: "Awaiting verbatim · B2B buyer segment · likely the cost of miscommunication rather than the discomfort of it",
      },
    ] as Slot[],
  },

  fork: {
    stage: "04 · Qualify",
    anno: {
      status: "ready",
      label: "Structural requirement — write today",
      note: "Two equal-weight paths. Not a dropdown, not tabs. This is disqualifying criterion M1 for template selection: if a template cannot express this, it is the wrong template. Everything below this point on the homepage is summary. The real argument lives on the two landing pages.",
    } as Anno,
    cards: [
      {
        tag: "For companies",
        h3: "Your team can read the contract. Can they hold the call?",
        p: "Assess a whole team in a week. Get a capability baseline, not an attendance sheet — and a monthly report you can take to your board.",
        cta: { label: "Try a team assessment", href: "/demo" },
      },
      {
        tag: "For individuals",
        h3: "You've done the courses. You still don't sound like yourself.",
        p: "Start with one free class and a placement report that tells you exactly where you are, and exactly what's holding you back.",
        cta: { label: "Try a free demo class", href: "/demo" },
      },
    ],
    annoConfirm: {
      status: "confirm",
      label: "Confirm with research",
      note: 'Both card headlines are drafted from hypothesis, not evidence. The B2C line assumes "I\'ve tried and failed before" is the dominant unspoken objection for adult learners. If the churned interviews confirm it, this deserves its own section on /for-individuals rather than an FAQ line. If they don\'t, replace it.',
    } as Anno,
  },

  how: {
    stage: "05 · Mechanism",
    anno: {
      status: "ready",
      label: "Ready — build now, no research dependency",
      note: "Identical for both audiences. Numbering is used here because this genuinely is a sequence: the order carries information the reader needs. Unblocks a large part of the page.",
    } as Anno,
    eyebrow: "How it works",
    h2: "Three steps, and the first one is free.",
    steps: [
      {
        num: "STEP 01",
        h3: "A real class, not a sales call",
        p: "45 minutes with a LingoPure teacher. Live, in ClassIn. You are assessed while you speak, not by a form.",
      },
      {
        num: "STEP 02",
        h3: "Your LP-18 placement report",
        p: "Within 48 hours: your CEFR level, your micro-level placement across 18 bands, your strengths, and the specific things holding you back.",
      },
      {
        num: "STEP 03",
        h3: "A programme built on that report",
        p: "Live classes and micro-lessons targeted at your gaps. Progress re-measured as you go. CEFR-aligned certification through TrackTest.",
      },
    ],
  },

  proof: {
    stage: "06 · Proof",
    anno: {
      status: "ready",
      label: "Ready — our most under-used asset",
      note: "Anonymise a real LP-18 report and show it large. Show, don't claim. Most competitors in this market cannot produce anything like it, and it converts because it is free, specific, and obviously expensive to produce.",
    } as Anno,
    eyebrow: "What you receive",
    h2: 'We don\'t tell you you\'re "intermediate". We show you which eighteenth.',
    lede: "CEFR gives you six levels. That's too coarse to act on. LP-18 splits each level into three micro-bands and maps your communication signals against them — so the next class targets something specific instead of something general.",
    cta: { label: "See yours after one class", href: "/demo" },
    slot: {
      title: "LP-18 report artifact",
      note: "Insert anonymised student report (currently produced in Canva, 2 pages). Owner: Thao · No research dependency · Start immediately",
    },
  },

  outcomes: {
    stage: "07 · Benefit",
    anno: {
      status: "pending",
      label: "Evidence pending — benefits must differ by audience",
      note: "Reusing the same three benefits for companies and individuals is the mistake the current site already makes. Source: research Q7, split by segment. The company column is drafted from what we know buyers ask for; the individual column cannot be guessed.",
    } as Anno,
    eyebrow: "What you get",
    h2: "Different buyers. Different wins.",
    company: {
      h3: "If you run a team",
      items: [
        {
          b: "Capability you can measure",
          span: "A baseline, a target, and a monthly movement figure per person — not hours attended.",
        },
        {
          b: "Fewer expensive misunderstandings",
          span: "The rework, the lost deal, the client who quietly stopped replying.",
        },
        {
          b: "Something to show the board",
          span: "Reporting that survives contact with a CFO, and certification that outlasts the employee.",
        },
      ],
    },
    individual: {
      h3: "If it's for you",
      slot: {
        title: "Three benefits — awaiting evidence",
        note: 'Source: research Q7, B2C adult learner segment. Hypothesis to test, not to ship: the win is not "better English", it is being taken seriously in a room where you currently are not. Confirm or discard.',
      } as Slot,
    },
  },

  testimonials: {
    stage: "08 · Social proof",
    anno: {
      status: "pending",
      label: "Evidence pending — three slots, none fillable today",
      note: 'Photo, first name, role, company, and one specific claim each. "Great teachers, very friendly" is worthless. "I ran our Q2 supplier negotiation in English" is a sale. Written consent must be captured at the time of the interview, not chased afterwards.',
    } as Anno,
    eyebrow: "In their words",
    h2: "Not testimonials. Receipts.",
    slots: [
      {
        title: "Testimonial 01",
        note: "B2C adult learner · specific claim · photo + first name + role",
      },
      {
        title: "Testimonial 02",
        note: "B2B buyer, HR or L&D · outcome framed commercially · logo consent required",
      },
      {
        title: "Testimonial 03",
        note: "B2B learner, the employee in the class · addresses the fear, not the feature",
      },
    ] as Slot[],
  },

  objections: {
    stage: "09 · Remove friction",
    anno: {
      status: "pending",
      label: "Evidence pending — this is why the churned interviews matter",
      note: 'Questions below are drafted from hypothesis. The real ones come from research Q5 ("what nearly stopped you signing up") and from people who left. This section cannot be invented, and it is the most commonly skipped research group. Two churned interviews minimum, and not run by a founder — nobody tells the COO why they left.',
    } as Anno,
    eyebrow: "Before you book",
    h2: "The things you were about to ask.",
    faqs: [
      {
        q: "What if my English is too low to start?",
        open: true,
        answer: {
          title: "Answer pending",
          note: "Under 60 words. This is likely the top B2C objection. Confirm its rank from interviews before deciding it goes first.",
        } as Slot,
      },
      {
        q: "I've tried English courses before and stopped. Why would this be different?",
        answer: {
          title: "Answer pending",
          note: "Hypothesis: this is the dominant unspoken objection in adult language learning. If confirmed, it earns its own homepage section, not an FAQ row.",
        } as Slot,
      },
      {
        q: "How much does it cost?",
        answer: {
          title: "Answer pending — and a commercial decision, not a design one",
          note: "Hiding price is defensible for B2B and hostile for B2C. Research tells us whether price was a real objection or a proxy for something else.",
        } as Slot,
      },
      {
        q: "We already have an English training budget. What does this replace?",
        answer: {
          title: "Answer pending",
          note: "B2B buyer objection. Likely the one that decides the deal.",
        } as Slot,
      },
      {
        q: "What happens to the certification if a staff member leaves?",
        answer: {
          title: "Answer pending",
          note: "Buyers ask this. It is a real fear and it has a good answer.",
        } as Slot,
      },
      {
        q: "Will my staff be embarrassed in front of each other?",
        answer: {
          title: "Answer pending",
          note: "The buyer and the learner are different people with different fears. Untested purchase driver — worth a specific question in the B2B interviews.",
        } as Slot,
      },
    ],
  },

  final: {
    stage: "10 · Convert",
    anno: {
      status: "ready",
      label: "Ready — one offer, one button",
      note: "No inline form fields. The click goes to a booking flow with a calendar embed. This is the primary conversion event for the entire site; every page must be one click from it.",
    } as Anno,
    h2: "Find out where you actually stand. It takes 45 minutes.",
    p: "One free class with a real teacher. One LP-18 placement report. No obligation to continue, and the report is yours either way.",
    cta: { label: "Try a free demo class", href: "/demo" },
    microPrefix: "Companies with five or more staff — ",
    microLink: { label: "try a team assessment instead", href: "/demo" },
  },

  footer: {
    legalLeft: [
      "LingoPure Pte. Ltd. · Singapore",
      "A subsidiary of LingoPure Limited (New Zealand)",
      "CEFR certification delivered in partnership with TrackTest",
    ],
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Contact", href: "/contact" },
      { label: "Company", href: "/company" },
    ],
    langs: "English · Tiếng Việt",
    anno: {
      status: "confirm",
      label: "Confirm",
      note: 'Entity naming must be correct — corporate procurement and investors both check. The "Company" link is where investor-facing material lives. It does not belong anywhere above this line.',
    } as Anno,
  },
} as const;

export type HomeContent = typeof home;
