# LingoPure investor dataroom — what it does (brief for Dan)

**Purpose.** A plain-language summary of the investor dataroom + its admin console, so you can update Dan on the functionality that exists. Grounded in the shipped code (`/investor/*`, `lib/investor/*`, migrations `0020`–`0022`). Runs in LingoPure's own Tokyo Supabase.

---

## What an investor experiences

An invited investor signs in to the **dataroom** (`/investor`) and can:

- **Ask questions and get cited answers.** A retrieval-augmented Q&A answers from the uploaded source documents and **cites them** — so every answer is traceable to a document, not asserted. (`lib/investor/answer.ts`, `retrieval.ts`; `dataroom_chunks` embeddings.)
- **Browse the source documents** behind those answers (`/investor/documents`).
- **Generate reports** from the dataroom (`/investor/reports`; `dataroom_reports`).
- **Talk to a voice agent** ("Morgan") for a spoken walk-through (`lib/investor/voice-morgan.ts`; `investor_voice_sessions`).

### Two access tiers, NDA-gated

- **Main dataroom** — every invited investor gets this.
- **Confidential deep-dive** (board materials) — reachable **only** if (a) the admin *entitled* that investor to deep-dive, **and** (b) the investor **accepts the online NDA in-app**. The admin decides entitlement; the NDA is what actually unlocks access — the admin can never bypass the NDA. (`deep_dive_invited` + `investor_nda_acceptances`, migration `0021`.)

---

## What the operator (admin) console does

`/investor/admin` is operator-only — gated by an email allowlist (`ADMIN_EMAILS`), rejected **after** sign-in, never at the form. It has:

- **Investors** — invite an investor by email (they receive a magic-link via Resend), set their **deep-dive entitlement**, and see the full list with status and **whether/when they accepted the NDA**. (`investors/actions.ts`.)
- **Documents** — manage the dataroom's source documents (what the cited Q&A answers from).
- **Reports** — the reports surface.
- **Access log** — an audit of who accessed what, and when. (`access-log`; `dataroom_audit`.)

---

## The three things worth telling Dan

1. **It's evidence-based by design.** Answers are **cited to source documents**, and access is **logged** — the same "show, don't assert" posture that matters in diligence. Nothing is a black box.
2. **Confidential material is protected two ways.** Deep-dive needs both an admin entitlement **and** a signed in-app NDA; acceptances are recorded with a timestamp. An investor cannot reach board materials by guessing a URL.
3. **It all runs in LingoPure's own Tokyo (Japan) infrastructure** — the dataroom, the documents, the access log, the NDA record — not on a third party's platform, and not in the PRC.

---

## Honest limits (so nothing is oversold)

- Q&A quality depends on the documents uploaded — it answers from what's in the dataroom, not beyond it.
- The voice agent is a convenience layer over the same cited Q&A, not a separate source of truth.
- This brief describes the **investor** dataroom/console specifically; the separate marketing-content admin (editors editing the public site) is covered in `docs/ADMIN_CONTENT_for_strategy_advisor.md`.
