/**
 * The manifest of editable copy blocks: which leaves of src/content/home.ts a
 * content editor may change, keyed by (section, block_key) where block_key is a
 * dotted path within the section. This single list drives both the editor UI
 * and the overlay (src/content/resolve.ts). Annotation notes, CTAs, hrefs, and
 * the research-pending empty slots are deliberately NOT editable here — they are
 * structure or canvas-only, not marketing copy. (Testimonials/logo CRUD is a
 * separate follow-up.)
 */

export interface EditableBlock {
  section: string;
  /** Dotted path within home[section], e.g. "steps.0.h3". */
  key: string;
  /** Human label shown in the editor. */
  label: string;
  /** Group heading in the editor (the section's display name). */
  group: string;
  /** Longer inputs get a textarea. */
  multiline?: boolean;
}

export const EDITABLE_BLOCKS: EditableBlock[] = [
  { group: "Hero", section: "hero", key: "eyebrow", label: "Eyebrow" },
  { group: "Hero", section: "hero", key: "h1", label: "Headline", multiline: true },
  { group: "Hero", section: "hero", key: "lede", label: "Sub-headline", multiline: true },
  { group: "Hero", section: "hero", key: "micro", label: "Micro line" },

  { group: "Problem", section: "problem", key: "eyebrow", label: "Eyebrow" },
  { group: "Problem", section: "problem", key: "h2", label: "Heading", multiline: true },
  { group: "Problem", section: "problem", key: "quote.text", label: "Illustrative quote", multiline: true },

  { group: "Audience fork", section: "fork", key: "cards.0.h3", label: "Companies — heading", multiline: true },
  { group: "Audience fork", section: "fork", key: "cards.0.p", label: "Companies — body", multiline: true },
  { group: "Audience fork", section: "fork", key: "cards.1.h3", label: "Individuals — heading", multiline: true },
  { group: "Audience fork", section: "fork", key: "cards.1.p", label: "Individuals — body", multiline: true },

  { group: "How it works", section: "how", key: "eyebrow", label: "Eyebrow" },
  { group: "How it works", section: "how", key: "h2", label: "Heading" },
  { group: "How it works", section: "how", key: "steps.0.h3", label: "Step 1 — title" },
  { group: "How it works", section: "how", key: "steps.0.p", label: "Step 1 — body", multiline: true },
  { group: "How it works", section: "how", key: "steps.1.h3", label: "Step 2 — title" },
  { group: "How it works", section: "how", key: "steps.1.p", label: "Step 2 — body", multiline: true },
  { group: "How it works", section: "how", key: "steps.2.h3", label: "Step 3 — title" },
  { group: "How it works", section: "how", key: "steps.2.p", label: "Step 3 — body", multiline: true },

  { group: "Proof", section: "proof", key: "eyebrow", label: "Eyebrow" },
  { group: "Proof", section: "proof", key: "h2", label: "Heading", multiline: true },
  { group: "Proof", section: "proof", key: "lede", label: "Body", multiline: true },

  { group: "Outcomes", section: "outcomes", key: "eyebrow", label: "Eyebrow" },
  { group: "Outcomes", section: "outcomes", key: "h2", label: "Heading" },
  { group: "Outcomes", section: "outcomes", key: "company.h3", label: "Company — column title" },
  { group: "Outcomes", section: "outcomes", key: "company.items.0.b", label: "Company — benefit 1 (bold)" },
  { group: "Outcomes", section: "outcomes", key: "company.items.0.span", label: "Company — benefit 1 (detail)", multiline: true },
  { group: "Outcomes", section: "outcomes", key: "company.items.1.b", label: "Company — benefit 2 (bold)" },
  { group: "Outcomes", section: "outcomes", key: "company.items.1.span", label: "Company — benefit 2 (detail)", multiline: true },
  { group: "Outcomes", section: "outcomes", key: "company.items.2.b", label: "Company — benefit 3 (bold)" },
  { group: "Outcomes", section: "outcomes", key: "company.items.2.span", label: "Company — benefit 3 (detail)", multiline: true },

  { group: "Objections", section: "objections", key: "eyebrow", label: "Eyebrow" },
  { group: "Objections", section: "objections", key: "h2", label: "Heading" },
  { group: "Objections", section: "objections", key: "faqs.0.q", label: "Question 1", multiline: true },
  { group: "Objections", section: "objections", key: "faqs.1.q", label: "Question 2", multiline: true },
  { group: "Objections", section: "objections", key: "faqs.2.q", label: "Question 3", multiline: true },
  { group: "Objections", section: "objections", key: "faqs.3.q", label: "Question 4", multiline: true },
  { group: "Objections", section: "objections", key: "faqs.4.q", label: "Question 5", multiline: true },
  { group: "Objections", section: "objections", key: "faqs.5.q", label: "Question 6", multiline: true },

  { group: "Final CTA", section: "final", key: "h2", label: "Heading", multiline: true },
  { group: "Final CTA", section: "final", key: "p", label: "Body", multiline: true },
];

/** Read a value by dotted path from a section object. */
export function getByPath(sectionObj: unknown, path: string): string | null {
  let cur: unknown = sectionObj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    const idx = /^\d+$/.test(seg) ? Number(seg) : seg;
    cur = (cur as Record<string | number, unknown>)[idx];
  }
  return typeof cur === "string" ? cur : null;
}

/** Set a value by dotted path on a (mutable) section object. */
export function setByPath(sectionObj: unknown, path: string, value: string): void {
  const segs = path.split(".");
  let cur = sectionObj as Record<string | number, unknown>;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const idx = /^\d+$/.test(seg) ? Number(seg) : seg;
    if (cur[idx] == null || typeof cur[idx] !== "object") return;
    cur = cur[idx] as Record<string | number, unknown>;
  }
  const last = segs[segs.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
}
