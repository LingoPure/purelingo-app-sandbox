# Claude Code Brief — Admin Backend Audit & ClassIn Integration Discovery

**Repo:** `lingo-pure-ai`
**Author:** Dennis McMahon (Fractional CTO)
**Date:** 10 July 2026
**Audience:** Claude Code (execution), Minh (ongoing dev), Dennis (review)

---

## 0. Read this first

This brief has **two phases and a hard gate between them.**

**Phase A is investigation.** You audit, you report, you build nothing.
**Phase B is scaffolding.** It does not begin until a human has read the Phase A report and said go.

Two assumptions drive this brief, and **both may be wrong**:

1. There is no admin backend in this repo.
2. ClassIn is not integrated and its API surface has not been evaluated.

I believe both are true. I have not verified either. **Your first job is to prove or disprove them, not to act on them.**

If you find that an admin surface already exists in some form, say so and stop. Building a second one is worse than building none. If you find ClassIn integration code, say so and stop — it may be dead code, it may be live, and the difference matters.

**Do not scaffold anything in Phase A. Do not create files. Do not run migrations. Read and report.**

---

## PHASE A — AUDIT

### A1. Repo baseline

Inspect and report:

- Framework and exact version. (Assumed: Next.js App Router.)
- Styling approach. (Assumed: Tailwind + CSS custom property tokens.)
- TypeScript coverage — full, partial, or content layer only.
- Auth: is there any authentication in this repo at all? What provider? What roles, if any?
- All routes, with a one-line description of each.
- Deploy configuration. Environment variables in use. Confirm whether `NEXT_PUBLIC_CANVAS_MODE` exists and what it gates.
- Supabase project region, if discoverable from config. **Report it explicitly.** Do not change it.

### A2. Admin backend — does anything already exist?

Search the codebase for any surface, however partial, that allows content or configuration change without a code deploy. Look for, at minimum:

- Routes under `/admin`, `/dashboard`, `/studio`, `/cms`, `/manage`
- Any CMS integration (Sanity, Contentful, Payload, Strapi, Tina, Keystone, Directus)
- Supabase tables that look like content storage rather than domain data
- Any write path from a browser session to a content table
- Feature flags, remote config, or environment-driven copy
- Any RLS policies suggesting an admin role

**Report format:**

| Finding | Location | Live / dead / partial | Assessment |
|---|---|---|---|

If nothing exists, say so in one line and move on. Do not pad.

### A3. The content layer — current state

The marketing site is specified to use a typed content layer where every block carries `status: 'ready' | 'confirm' | 'pending'`.

Report:

- Does `content/types.ts` exist? Does it match the specified shape?
- List every content file, its section, and the `status` of each block within it.
- Is any user-facing copy hardcoded in a component? **List every instance.** This is the thing an admin backend cannot fix.
- Is any content stored in the database, or is it all in source?

This determines whether an admin backend edits **files** (requiring a build) or **rows** (not requiring one). That is the central architectural decision in Phase B and I want it made from evidence.

### A4. Design tokens — current state

- Locate the tokens file. Confirm it is one file.
- List every colour, type, spacing and radius token.
- **Find every violation:** hex values, arbitrary pixel values, `text-[#...]` arbitrary Tailwind classes, inline styles. List each with file and line.

Minh cannot layer a template over a repo with token leakage. This list is what he has to clear first.

### A5. ClassIn — what, if anything, exists

Search for any reference to ClassIn, EEO, or their SDKs / endpoints anywhere in the repo, including:

- Source, config, environment variable names, comments, migrations, package manifests, and dead branches.

For each hit: is it live, dead, or aspirational?

**Then, separately, report on documentation only.** Do not attempt any network call to ClassIn and do not attempt to use credentials.

From publicly available ClassIn / EEO developer documentation, answer:

1. **SDK embed.** Is there a documented embed SDK? Can a classroom be rendered inside a host application, or only linked to in a new context?
2. **LTI / analytics API.** What structured signals are documented as available post-session? At what granularity — per session, per learner, per event? Pull or push? What is the latency?
3. **Recording download API.** Is there a documented endpoint? Critically: **does it yield separable per-speaker audio tracks, or only a single mixed classroom track?**
4. **Enrolment API.** Can learners and classes be created and managed programmatically?
5. **Terms.** From the published User Agreement and Privacy Policy: what does the licence say about bulk export, data retention, and use of session data for model training? What does it say about data residency?

If the documentation does not answer a question, **write "not documented"**. Do not infer. Do not fill the gap with what a platform of this type usually does. An honest "not documented" is worth more here than a plausible guess, because the plausible guess will end up in a board paper.

### A6. Score row provenance — check and report

Inspect the schema for the table holding score rows.

- Do rows carry `model_id`, `rubric_version`, `prompt_hash` (or equivalents)?
- If not, how many rows exist without them?
- Do rows carry `extraction_method`?

Report only. **This is urgent, but it is Minh's to fix, not yours.**

### A7. Audio retention — check and report

In the voice discovery pipeline:

- Is conversation audio persisted anywhere, or is only the transcript retained?
- If audio is retained: where, in what format, with what retention policy, and is it linked to the session ID?
- If not: identify the exact point in the pipeline where the audio is available and discarded.

Report only. Do not implement.

---

## GATE

**Stop. Produce `AUDIT_REPORT.md` and end your turn.**

The report should contain:

1. **Assumptions tested.** For each of the two headline assumptions: confirmed, refuted, or partially. One sentence each.
2. The findings from A1–A7, in order.
3. **What I got wrong in this brief.** If the repo materially differs from what is described here, say so plainly and propose the adaptation. Do not silently work around a wrong instruction.
4. **The one architectural question Phase B turns on:** should the admin backend edit content *files* or content *rows*? Give your recommendation and the reasoning, in under 200 words.

Do not proceed to Phase B without explicit human approval.

---

## PHASE B — SCAFFOLD (gated)

*Do not read this as instructions to execute. Read it as the shape of the thing that gets built if and when Phase A clears.*

### B1. Admin backend

**Purpose:** marketing and operations staff change content, configuration and assets without engineering involvement. Today every copy change costs a developer. That is the problem being solved. Nothing else.

**Scope — in:**

| Capability | Note |
|---|---|
| Edit copy in any content block | The core feature |
| Change a block's `status` | `pending` → `confirm` → `ready` |
| Testimonials CRUD, with ordering | |
| Client logo upload and swap | |
| Publish / unpublish a section | |
| Vietnamese translation alongside English | Per-block, side by side |
| Role-based access | `admin`, `marketing`, `readonly` |
| Audit log | Who changed what, when, previous value |
| Preview before publish | Non-negotiable |

**Scope — explicitly out:**

- Learner data. Score rows. Session records. Anything in the telemetry path.
- Anything that writes to a table containing personal data.
- User management beyond the three roles above.
- Course catalogue, pricing, or e-commerce.

The admin backend touches **content**. It does not touch **the instrument**. Enforce this at the database with RLS, not in application code.

**Constraints:**

- The `pending` semantics must survive. An admin can move a block from `pending` to `confirm`, but the UI must make clear that a `pending` block is *intentionally empty* and that filling it in with invented copy defeats its purpose. Put that sentence in the UI.
- Preview must render the public component, not an approximation of it.
- Audit log rows are append-only.
- No admin route may be reachable without authentication, including in preview deployments.

### B2. ClassIn integration — *specification only, no code*

Based on the A5 findings, produce `CLASSIN_INTEGRATION_SPEC.md` describing the seam. Do not implement it.

The intended architecture is three narrow pipes and nothing more:

1. **Enrolment out** — LingoPure creates and manages learners and classes in ClassIn.
2. **Structured signals in** — via the sanctioned analytics API only.
3. **Audio in** — *conditional.* Only if A5.3 establishes that separable per-speaker audio is retrievable. If it yields only a mixed track, this pipe does not exist and the spec should say so.

**Governing principle:** rent the classroom, own the microphone. ClassIn is a vendor signal source, not a data moat. Nothing arriving through these pipes enters the derived scoring path without an explicit, documented decision.

The spec must include, for each pipe: whether it is documented as possible, the endpoints involved, the data shape, the failure modes, the residency implication, and — separately and prominently — **what the terms of service permit**. A technically feasible pipe that the licence forbids is not a pipe.

Where A5 returned "not documented", the spec says "requires written confirmation from EEO account contact" and names it as a blocker. It does not guess.

---

## Conduct

- Verify, don't assume. Every assumption in this brief is a hypothesis.
- Report before you build. Twice: at the Gate, and before any irreversible operation.
- Never invent content to fill a `pending` slot.
- Never create or migrate a Supabase project. Region selection is irreversible and is a compliance decision, not a technical one.
- If an instruction here conflicts with what you find in the repo, the repo wins and you say so.
- "Not documented" and "I don't know" are correct answers. Plausible fabrication is not.
