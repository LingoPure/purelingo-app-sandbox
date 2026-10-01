/**
 * Shared content for the ~30-second sandbox-flow preview, consumed by both
 * the marketing-canvas variant (src/components/marketing/QuickWalkthrough.tsx)
 * and the /demo-page variant (src/components/demo/QuickWalkthrough.tsx).
 *
 * All sample data below is illustrative only — never a real student's — and
 * labelled as such wherever it renders. Copy avoids terms disallowed by
 * scripts/check-content-claims.mjs.
 */

export const STEP_MS = 7500; // 4 steps x 7.5s ~= 30s total

export type WalkthroughStep = {
  tag: string;
  title: string;
  body: string;
};

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    tag: "Step 1 · 2 minutes",
    title: "Create a free account",
    body: "No credit card. Just enough to save your results.",
  },
  {
    tag: "Step 2 · ~25 minutes",
    title: "Talk to Aria",
    body: "A real conversation, not a multiple-choice form. Aria listens for how you actually communicate — speaking, listening, grammar, live interaction.",
  },
  {
    tag: "Step 3 · Instant",
    title: "Your skill profile",
    body: "Mapped against your target level the moment the conversation ends.",
  },
  {
    tag: "Step 4",
    title: "A plan built on your gaps",
    body: "Live classes and micro-lessons aimed at exactly what's holding you back — not a generic course.",
  },
];

export type SampleSkill = {
  key: string;
  label: string;
  score: number | null;
  target: number;
};

export const SAMPLE_SKILLS: SampleSkill[] = [
  { key: "speaking", label: "Speaking", score: 640, target: 800 },
  { key: "listening", label: "Listening", score: 710, target: 800 },
  { key: "writing", label: "Writing", score: 520, target: 800 },
  { key: "reading", label: "Reading", score: 780, target: 800 },
  { key: "grammar", label: "Grammar", score: 600, target: 800 },
  { key: "live_interaction", label: "Live Interaction", score: null, target: 800 },
];

export const SAMPLE_PLAN = [
  { week: "Week 1–2", focus: "Grammar precision in client emails" },
  { week: "Week 3–4", focus: "Live-interaction turn-taking on calls" },
  { week: "Week 5–6", focus: "Presenting numbers with confidence" },
];
