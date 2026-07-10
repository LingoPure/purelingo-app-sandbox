# Claude Code Build Brief — LingoPure Marketing Site Canvas

**Repo:** `lingo-pure-ai` (deployed at `lingo-pure-ai.vercel.app`)
**Author:** Dennis McMahon
**Date:** July 2026
**Audience:** Claude Code (execution), Minh (template layering + ongoing dev), Thao & Daniel (review)

---

## 0. Read this first

The current repo is a **product demo**: a single B2B-oriented page with a hero, three numbered feature blocks, and a "Get started" signup CTA.

We are not deleting it. We are building a **marketing landing site** alongside it, structured as a sales flow rather than a feature tour, and using it as a shared offline canvas for the team to review and mark up.

The canvas has to be a working page, not a wireframe. Nobody reviews a blank page usefully.

### What this is for

1. **Thao and Daniel review a real page**, not a document, and react to actual copy in actual position.
2. **Minh layers a purchased WordPress/template design over the top** of an agreed structure, rather than discovering the structure after the template is bought.
3. **Copy that depends on customer research drops in later** without a code change or a rebuild.

That third point drives the entire architecture below. Read Section 3 before writing any component.

---

## 1. Before you start — verify, don't assume

Inspect the repo and confirm:

- Framework and version (assume Next.js App Router until proven otherwise)
- Styling approach (assume Tailwind; if it's CSS modules or styled-components, adapt but keep the token principle in Section 4)
- TypeScript present? If not, add it for the content layer at minimum.
- Existing routes, existing components, existing deploy config
- Whether anything currently lives at `/`

Report what you found before making changes. If the stack differs materially from the assumptions here, say so and propose the adaptation rather than silently working around it.

---

## 2. Routing changes

| Route | What goes there | Status |
|---|---|---|
| `/` | **New.** Marketing homepage — the full sales flow | Build |
| `/product` | The existing product demo page, moved here intact | Move |
| `/for-companies` | B2B landing page | Build (scaffold + content shell) |
| `/for-individuals` | B2C landing page | Build (scaffold + content shell) |
| `/method` | LP-18, CEFR, how placement works | Build (scaffold) |
| `/book-a-demo` | Booking flow. Calendar embed placeholder for now | Stub |

Move the existing page to `/product` with a redirect from any existing deep links. Do not rewrite it, do not restyle it, do not "improve" it. It is a working artifact and it is not the subject of this task.

---

## 3. The content layer — the most important instruction in this brief

**No user-facing copy may be hardcoded in a component.** All of it lives in `content/`, as typed objects.

Create `content/types.ts`:

```ts
export type BlockStatus = 'ready' | 'confirm' | 'pending';

export interface Annotation {
  /** Short uppercase label, e.g. "Evidence pending" */
  label: string;
  /** Why this block is in this state, and what unblocks it */
  note: string;
}

export interface ContentBlock<T = unknown> {
  id: string;
  status: BlockStatus;
  annotation?: Annotation;
  /** Null when status === 'pending' and nothing shippable exists yet */
  data: T | null;
}
```

Then one file per homepage section: `content/home/hero.ts`, `content/home/problem.ts`, and so on.

### Why this matters

- `status: 'pending'` means we have deliberately not written the copy, because it must come from customer interviews. The component renders a visible **empty slot** instead of inventing something.
- `status: 'confirm'` means shippable placeholder copy exists but must be validated.
- `status: 'ready'` means it's final.
- Replacing pending copy is then a **content file edit**, not a code change. No PR review, no component surgery, no regression risk. Marketing can do it.
- The annotation layer is *generated* from `status` and `annotation`. It is never written by hand into markup.

Guessing at pending copy to "make the page look finished" is the single worst thing that can be done to this repo. An empty slot is information. Invented copy is noise that will survive to production because it looked plausible.

---

## 4. Design tokens — so Minh can layer a template over the top

All colour, type, spacing and radius values live in **one file** as CSS custom properties. Components reference tokens only. No hex values, no arbitrary pixel values, no `text-[#0B1F24]` anywhere in a component.

```css
:root {
  --ink: #0B1F24;
  --teal: #12525F;
  --teal-soft: #E7EFF0;
  --go: #0E7C66;
  --paper: #FAFAF7;
  --line: #DCE3E3;
  --muted: #5C6B6E;
  /* markup layer — never used by production UI */
  --mark: #B91C1C;
  --mark-bg: #FEF3F2;
}
```

If Tailwind: extend the theme from these variables so `bg-ink` resolves to `var(--ink)`. Do not duplicate the palette in `tailwind.config`.

The point: Minh should be able to swap the entire visual identity by editing one file, and later mirror the same structure in WordPress. If a template's design has to be reverse-engineered out of forty components, this has failed.

---

## 5. Component structure — one component per sales flow stage

Ten sections, in this order. The order is not negotiable; each stage earns the right to the next.

```
components/marketing/
  01-Hero.tsx              // Promise
  02-TrustBand.tsx         // Permission
  03-Problem.tsx           // Problem
  04-AudienceFork.tsx      // Qualify
  05-HowItWorks.tsx        // Mechanism
  06-ProofOfMethod.tsx     // Proof
  07-Outcomes.tsx          // Benefit
  08-Testimonials.tsx      // Social proof
  09-Objections.tsx        // Remove friction
  10-FinalCTA.tsx          // Convert
  Footer.tsx
  Nav.tsx
```

Numbered filenames are deliberate: the order carries meaning that a reader needs, and losing it is how a sales page decays back into a feature list.

### Section notes

- **01 Hero** — one H1, one subhead, one primary CTA (`Book a free demo class`), one secondary (`I'm looking for my team`). No carousel. `status: pending`.
- **02 TrustBand** — logo strip + one hard number. `status: confirm` (logo consent unverified).
- **03 Problem** — three to four customer verbatims as pull-quotes. One illustrative, two empty slots. `status: pending`.
- **04 AudienceFork** — two equal-weight cards. **Not** tabs, **not** a dropdown. This is the structural spine of the site. Everything below it on the homepage is summary; the real argument lives on the two landing pages.
- **05 HowItWorks** — three steps. `status: ready`. Build this first, it has no dependencies.
- **06 ProofOfMethod** — the LP-18 report artifact, displayed large. Image slot pending Thao's anonymised export. `status: ready` for copy.
- **07 Outcomes** — two columns, different benefits per audience. Company column `confirm`, individual column `pending`.
- **08 Testimonials** — three slots, all `pending`. Needs photo, first name, role, company, one specific claim.
- **09 Objections** — accordion. Questions drafted, all answers `pending`.
- **10 FinalCTA** — one offer, one button, no inline form.

---

## 6. The annotation layer

Two modes, toggled by a control fixed top-right, persisted to `localStorage`:

- **Spec view** (default) — shows annotations, empty slots, and a vertical stage marker on the left edge of each section
- **Clean view** — shows only what a visitor would see

Build this as `components/marketing/AnnotationLayer.tsx` plus a `<SpecProvider>` context. Annotations render from the content layer's `status` and `annotation` fields. Colour-code: green (`ready`), amber (`confirm`), red (`pending`).

Gate the whole thing behind `NEXT_PUBLIC_CANVAS_MODE=true` so it cannot ship to production. The env var defaults to `false`.

Also add a fixed `Sales flow canvas — not the production site` bar at the top of every page while canvas mode is on.

---

## 7. Quality floor — do not announce it, just meet it

- Responsive to 360px. The fork stacks; the steps stack; nothing overflows.
- Vietnamese diacritics render correctly at every weight of every font used. Test with `Tiếng Việt · nghiệp vụ · chuyên nghiệp`. Premium display faces frequently ship broken Vietnamese coverage and it is discovered after purchase.
- Visible keyboard focus on every interactive element.
- `prefers-reduced-motion` respected.
- Semantic heading order. One `h1` per page.
- Lighthouse mobile performance ≥ 90 on the homepage. No hero video, no parallax, no scroll-jacking.
- All images `next/image` with explicit dimensions.
- FAQ accordion uses `<details>`/`<summary>` or an accessible disclosure pattern, and emits FAQ schema.

---

## 8. Explicit non-goals

Do not build, and do not helpfully add:

- Course catalogue, LMS features, or student login. That is the Learning Dashboard, a separate phase.
- Any authentication.
- A pricing page. Whether pricing is public is an unresolved commercial decision.
- A CMS integration. WordPress is Minh's decision to make later.
- Animation beyond a subtle scroll reveal, if any.
- Investor-facing content anywhere above the footer. The category framing we use in board material — communication intelligence, governance infrastructure, LP-1000 — is correct for a board deck and wrong for a hero. A company whose staff freeze in English meetings does not search for governance infrastructure. Investor content sits behind a discreet `/company` footer link or nowhere at all.

---

## 9. Build order

1. Verify the stack. Report findings.
2. Move existing page to `/product`. Confirm it still works.
3. Tokens file. Nothing else until this exists.
4. Content types + content layer for the homepage, with every block's `status` set honestly.
5. `SpecProvider`, `AnnotationLayer`, canvas-mode env gate.
6. Sections 05, 06, 10, Nav, Footer — the `ready` ones. Deploy. Get it in front of the team.
7. Sections 01, 02, 03, 04, 07, 08, 09 — with pending slots rendering as empty slots.
8. Route scaffolds for `/for-companies`, `/for-individuals`, `/method`, `/book-a-demo`.
9. Lighthouse + diacritics + keyboard pass.

Deploy after step 6, not at the end. The team should see something real within a day.

---

## 10. Acceptance criteria

- [ ] `/product` renders the original demo unchanged
- [ ] Homepage renders all ten sections in order
- [ ] Toggling Spec/Clean view changes nothing about layout, only annotation visibility
- [ ] Every string on the page is traceable to a file in `content/`
- [ ] `grep -r '#' components/` returns no hex colours
- [ ] Setting a block's `status` to `pending` causes an empty slot to render, with no code change
- [ ] `NEXT_PUBLIC_CANVAS_MODE=false` removes the toggle, the bar, all annotations, and all empty slots
- [ ] No `h2` precedes the `h1`
- [ ] Vietnamese renders correctly in nav, headings and body
- [ ] Lighthouse mobile performance ≥ 90

---

## 11. A note on judgement

Several sections in this brief instruct you to leave copy empty. You will be tempted to fill them, because a page with holes in it feels unfinished and filling them is easy.

Don't. Those holes are the deliverable. They mark exactly where the site's argument depends on evidence we do not yet have, and a plausible invented sentence in one of those slots will be read, approved, and shipped, because it will look like everything around it.

If you believe a slot can be filled from something already in the repo or in this brief, say so and ask. Do not fill it silently.
