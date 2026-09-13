# Service package & pricing — questions for Dan

Dan — before we wire pricing into the corporate flow, we need the commercial
model settled. The production LingoPure site prices *per class hour* (1:1 /
group tables), but the Sandbox offering is structured around three **service
packages** instead, so prod pricing doesn't map cleanly. These questions define
how we charge for the packages we're actually proposing.

**Each question has a suggested default.** Where the default is right, just reply
"yes" — you only need to write an answer where you want something different.
The ones marked ⚠️ genuinely change the DB / proposal design; the rest we can
start around.

---

## A. The packages themselves

Our current build is scoped to three packages (`SERVICE_PACKAGES`), each with a
fixed department set. The corporate demo intake (Book-a-demo) and the proposal
that follows need to price *something* — the package is the unit.

**A1. ⚠️ Do these three packages stay the commercial unit?**
  1. **1:1 Tutoring** — Academic only
  2. **Tutor + AI** — Academic + AI Coaching
  3. **Full BPO** — Inbound, Outbound, Logistics
*Suggested default: yes — fix the packages now; the demo/proposal prices in terms of one of these.*

**A2. Should a package also be purchasable for non-BPO companies?**
E.g. a bank or a manufacturer with 200 learners — do they buy the same packages
with their own department allocation, or do we need a fourth (e.g. "Corporate —
custom departments")?
*Suggested default: one extra package "Corporate / Custom" with free-form departments.*

---

## B. Pricing structure

**B1. ⚠️ What is the pricing unit?**
Per learner per month (seat), per assessed head, per class hour, or a fixed
package price for the whole org? The seats-vs-hours choice changes every
report and the proposal template.
*Suggested default: per learner per month for training + a fixed per-learner fee for the baseline assessment.*

**B2. Currency and markets**
Vietnam (VND), SEA/US (USD), or both? Do prices show one currency or both in the
demo and proposal?
*Suggested default: VND for Vietnam, USD for everything else, shown both when relevant.*

**B3. Is the assessment ever sold standalone?**
Our self-assessment funnel (voice discovery + battery) is the "taste". For
companies that only want candidate screening or a one-off level audit — do we
price that separately, or is it always bundled into a package?
*Suggested default: bundled into packages; standalone screening priced later once validated.*

**B4. What's the minimum contract length?**
Month-to-month, 3/6/12 months? The demo and proposal should present the
commitment explicitly.
*Suggested default: 6-month minimum, monthly opt-out after.*

---

## C. What the demo/proposal needs to show

**C1. Should the demo walkthrough show indicative price ranges per package, or no numbers at all**
(clean "we'll send a tailored proposal")?
*Suggested default: indicative ranges only — the tailored number arrives in the proposal.*

**C2. Does the Book-a-demo request need to ask a budget range?**
We deliberately kept budget out of the intake form (it's a potential
friction point for decision makers). Do you want it back in, or keep it for the
demo call itself?
*Suggested default: keep out of the form — capture it on the call and store it on the booking.*

---

## D. Commercial ops

**D1. Discounting / annual prepay**
Do we support a discount for annual prepayment, volume seats (e.g. >50 learners),
or multi-year deals? The proposal template should reflect whatever we support.
*Suggested default: annual prepay −10%, volume tiering by headcount.*

**D2. Who owns pricing sign-off on the proposal?**
Once our intake captures the org details, the proposal that comes out of it is
built by LingoPure on this side. Is there a fixed price list you'll maintain, or
is each proposal priced case-by-case?
*Suggested default: a maintained price list per package, reviewed quarterly.*

---

## E. Cross-product note (not a blocker)

Prod's per-class pricing is still relevant to the **individual** funnel
(people who buy classes directly, not via an employer package). We are only
saying it's not the frame for the corporate package model. If you'd like a
compatibility view (package price ≈ equivalent hours at prod rates), we can add
it to the proposal as evidence.

---

**Echo to Dennis:** prod's pricing page stays as-is for now; nothing is built
against it. Once Dan answers A–D, we wire the agreed model into the packages,
the demo booking, and the proposal template in one pass.