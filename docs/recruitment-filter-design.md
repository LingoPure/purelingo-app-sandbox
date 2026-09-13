# Recruitment Filter — Office Hours Design Doc

**Status:** Hypothesis — not validated
**Date:** 2026-09-13
**Product:** LingoPure corporate offering (Enterprise lane)
**Feature:** Use the LP self-assessment as a candidate screening tool at the hiring front door

---

## The six forcing questions

### Q1. Customer (demand reality)
**Existing Enterprise clients** — orgs already paying for LingoPure English training. This is an
upsell add-on to the training contract, not a standalone product for new buyers. Same L&D budget
holder, warm relationship, harder to lose.

### Q2. Status quo (who we displace)
**No real English screen exists.** These clients trust certificates (IELTS/TOEFL) or gut-feel in
interviews, then discover the real gap after onboarding. We are not competing against other tests —
we are entering a vacuum. Easiest possible market entry.

### Q3. Desperate specificity (the win moment)
**Save interview time.** Hiring managers burn 3–5 hours per candidate on manual English screening
that is still unreliable. The assessment front-loads that information so interviews focus on
domain fit, not English triage. (Secondary win: avoid bad hires via a visual role-fit report.)

### Q4. Narrowest wedge (the thin MVP)
**Email-in, role-fit PDF out.**
1. Employer admin pastes/enters a candidate email
2. Candidate receives a link → takes the voice discovery + battery (NO account required)
3. A one-page role-fit PDF (candidate vs. role baseline, gaps + evidence) is generated and
   shared back with the employer — dismissal decision made in 30 seconds

Reuses existing engines (voice discovery, LP-18 battery, role baselines) — zero new assessment
infrastructure. The only new surface is the invite link, the no-account candidate session, and the
role-fit PDF output.

### Q5. Observation (what we've actually seen)
**No data yet — this is all hypothesis.** No real candidate has run this flow. Per the validation
pipeline, this feature must be validated (does a real Enterprise client want it?) before any build
beyond the thin MVP.

### Q6. Future-fit (where it leads)
**A talent pipeline into training.** Every screened candidate becomes a known-quantity lead:
- rejected-but-close candidates → funneled into individual LingoPure training
- hired candidates → onboarded straight into role-baselined classes

The screening itself becomes the front door of the training business.

---

## Verdict (THIN MVP rubric)

| Axis | Score | Notes |
|---|---|---|
| Experience (whole promise) | Target: MAX | Candidate feels the full assessment; employer gets a decisive role-fit PDF |
| Scale/ops infrastructure | Target: ZERO | No candidate accounts, no employer console changes, no billing |

**Gate:** validate demand with 1–2 existing Enterprise clients before building — demonstrate the
role-fit PDF on a real role with a real candidate sample. This feature is only built after a GO.

## Build sketch (post-GO, post-validation)

1. `candidate_invites` table — employer_id, candidate email, token, status, result linkage
2. `/screen/:token` route — no-account candidate session reusing battery flow, results scoped to invite only
3. Role-fit PDF generation — candidate micro-band scores overlaid on the role baseline
4. Employer share-back — PDF delivery + optional embed in employer console
5. Optional later: distribution to staffing agencies/BPOs (white-label lane)