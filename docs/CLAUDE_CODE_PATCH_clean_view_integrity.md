# Claude Code Patch Brief — Clean View Integrity

**Repo:** `lingo-pure-ai`
**Follows:** `CLAUDE_CODE_BRIEF_marketing_canvas.md`
**Priority:** Section 1 (deployment exposure) before anything else. It is live right now.
**Author:** Dennis McMahon

---

## Problem statement

Clean view currently hides *empty slots* but not the *sections that contain them*. The result is hollow rooms: a heading, then whitespace. Testimonials renders as "Not testimonials. Receipts." above nothing. The FAQ renders six accordion rows that open into emptiness.

An empty room reads as a bug. A missing room reads as a page. Clean view must look like a real, if incomplete, website — not a broken one.

Three separate defects, in priority order.

---

## 1. Deployment exposure — do this first

The canvas is on a public, indexable URL with an invented statistic ("1,200+ placement reports issued") sitting directly beneath two named client logos whose usage consent has not been confirmed. That combination is an unsourced performance claim attached to real clients, published.

### 1a. Block indexing

```ts
// app/layout.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  // ...
};
```

Add `public/robots.txt`:

```
User-agent: *
Disallow: /
```

### 1b. Password-protect the deployment

Enable Vercel Deployment Protection (Standard Protection) on the project. If the plan does not permit it, add basic auth middleware:

```ts
// middleware.ts — only when CANVAS_MODE is on
```

Do not skip this on the grounds that the URL is unguessable. Vercel preview URLs are enumerable and this one has already been shared in a group chat.

### 1c. Unsourced numbers must not render

Any numeric claim in the content layer carries its own status. A `pending` number does not render — not as zero, not as a placeholder, not at all.

```ts
// content/home/trustBand.ts
export const trustBand: ContentBlock<TrustBandData> = {
  id: 'home.trustBand',
  status: 'confirm',
  annotation: {
    label: 'Confirm before launch',
    note: 'Logo usage consent required for every client shown. Stat must be real and sourced.',
  },
  data: {
    logos: [
      { name: 'Tradeland', consent: false },
      { name: 'DatumHQ', consent: false },
    ],
    stat: null, // was '1,200+ placement reports issued' — invented placeholder
  },
};
```

Rules:

- `logos` filters to `consent === true` before render. Today that yields an empty array, so the logo strip does not render.
- Remove `Client 03` and `Client 04` entirely. They are lorem wearing a suit.
- `stat: null` means no stat renders. When Thao supplies a real, sourced figure, it goes here with `status: 'ready'`.
- If both `logos` and `stat` are empty, the whole TrustBand section does not render in clean view. See Section 2.

---

## 2. Section gating

### 2a. Derive section status from its blocks

Add to `content/types.ts`:

```ts
/**
 * A section is:
 *  - 'empty'    when every block in it is pending with null data
 *  - 'partial'  when some blocks have data and some do not
 *  - 'complete' when every block has data
 */
export type SectionFill = 'empty' | 'partial' | 'complete';

export function deriveSectionFill(blocks: ContentBlock[]): SectionFill {
  const filled = blocks.filter(b => b.data !== null).length;
  if (filled === 0) return 'empty';
  if (filled === blocks.length) return 'complete';
  return 'partial';
}
```

### 2b. `<SectionGate>`

```tsx
// components/marketing/SectionGate.tsx
'use client';

import { useSpecMode } from './SpecProvider';
import type { SectionFill } from '@/content/types';

interface Props {
  fill: SectionFill;
  children: React.ReactNode;
}

export function SectionGate({ fill, children }: Props) {
  const { specMode } = useSpecMode();
  if (!specMode && fill === 'empty') return null;
  return <>{children}</>;
}
```

Wrap every marketing section. Behaviour:

| Fill | Spec view | Clean view |
|---|---|---|
| `empty` | Renders with annotation + empty slots | **Section does not exist.** Heading, eyebrow, wrapper, padding — all gone |
| `partial` | Renders with annotation + empty slots for the gaps | Renders silently with whatever has data |
| `complete` | Renders with `ready` annotation | Renders |

The critical part is that `empty` removes the **entire `<section>` element**, including its heading and its vertical padding. Returning `null` from the children while keeping the wrapper leaves a gap in the page. Do not do that.

### 2c. Consequences on the current homepage

Verify each of these in clean view after the change:

| Section | Fill today | Clean view result |
|---|---|---|
| 02 TrustBand | `empty` (no consented logos, no sourced stat) | Section gone |
| 03 Problem | `partial` (one quote) | One quote, no dashed boxes, no gaps |
| 07 Outcomes | `partial` | **Single full-width column.** Not a two-column grid with a void on the right |
| 08 Testimonials | `empty` | Section gone. "Not testimonials. Receipts." goes with it |
| 09 Objections | `empty` (six questions, zero answers) | Section gone |

Section 07 is the one that needs care. A grid whose second child returns `null` still reserves the column. The Outcomes component must count its filled columns and set `grid-template-columns` accordingly, or render a single column when only one has data.

### 2d. The FAQ is the worst case

Six accordion rows that open into nothing is not an unfinished section — it is a broken interaction, and it is the first thing anyone will click.

Under `SectionGate`, Objections has fill `empty` and disappears from clean view entirely. In spec view it stays, because the drafted questions are useful to review even without answers. That is the correct split.

Do not "solve" this by shipping placeholder answers.

---

## 3. Spec content leaking into clean view

The problem quote currently renders `Illustrative only — replace with real verbatim` as a visible `<cite>` in clean view. It escaped the `.slot--empty { display: none }` rule because it is markup wearing a content costume.

**Root cause:** editorial commentary was placed in `data` rather than `annotation`.

**Rule:** anything a visitor must never see lives in `annotation`. Nothing in `data` is ever hidden. If a `data` field needs a caveat, the caveat is not a `data` field.

Fix the problem block:

```ts
// content/home/problem.ts
export const problemQuotes: ContentBlock<Quote[]> = {
  id: 'home.problem.quotes',
  status: 'pending',
  annotation: {
    label: 'Evidence pending — do not write this from the pitch deck',
    note: 'Quote 01 is illustrative and must be replaced with a real verbatim before launch. Quotes 02 and 03 awaiting interviews (research Q1, Q2).',
  },
  data: [
    { text: 'I can read English fine. I freeze the moment I have to speak in the meeting.', attribution: null },
  ],
};
```

`attribution: null` renders nothing. It does not render an empty `<cite>`, and it does not render a dash.

Then audit every content file for the same pattern. Grep for these strings and confirm each lives in `annotation`, not `data`:

```
Illustrative
placeholder
TODO
awaiting
pending
replace with
Owner:
```

Add a test that fails if any of them appear in a `data` field.

---

## 4. Nav and route integrity

- Nav says **Results**, the section it links to says **What you receive**. Pick one word and use it in both places. A nav label is a promise about what is below it.
- `/for-companies` and `/for-individuals` are linked from four places on the homepage and are currently scaffolds. Either ship a holding page with the hero and a single CTA, or the review begins with two dead ends. A holding page is fifteen minutes and it is worth it.
- Confirm `/book-a-demo`, `/method`, `/company`, `/privacy`, `/terms`, `/contact` return something. A footer full of 404s undermines the entity-naming credibility the footer exists to establish.

---

## 5. Also

The SayFixed feedback widget renders in the footer. This page is about to be sent to the CEO and COO. Confirm that is intentional before circulating; if it is, it should probably sit under canvas mode with the rest of the review tooling.

---

## 6. Acceptance criteria

- [ ] Deployment returns `X-Robots-Tag: noindex` and `robots.txt` disallows all
- [ ] Deployment requires a password
- [ ] No invented statistic renders anywhere in clean view
- [ ] `Client 03` and `Client 04` do not exist in the codebase
- [ ] Clean view contains zero empty dashed boxes
- [ ] Clean view contains zero headings followed by whitespace
- [ ] TrustBand, Testimonials and Objections are absent from the clean-view DOM — not hidden, absent
- [ ] Outcomes renders as one full-width column in clean view, with no reserved empty column
- [ ] Vertical rhythm in clean view has no double-padding gaps where a section was removed
- [ ] `Illustrative only` appears nowhere in clean view
- [ ] Toggling Spec → Clean does not shift the layout of any section that renders in both
- [ ] A test fails if spec vocabulary appears in any `data` field
- [ ] Nav labels match the headings they link to
- [ ] Every link on the homepage and in the footer resolves

---

## 7. What this achieves

After the patch, clean view reads as a real page that is missing its evidence — a hero, a problem, a fork, a method, a proof, a benefit, a close. Short, but coherent, and obviously deliberate.

Before the patch it reads as a page someone abandoned halfway.

Those two impressions are very different, and Daniel will form one of them in about four seconds.
