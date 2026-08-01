# HR & Leave Dashboard — questions before we build

Thao — the requirement is clear and we can build it. These are the decisions that
change how the system calculates things, so we need them settled before the
database is designed rather than after.

**Each question has a suggested default.** Where the default is right, just reply
"yes" — you only need to write an answer where you want something different.
The ones marked ⚠️ genuinely block the build; the rest we can start around.

---

## A. Working pattern and how days are counted

**A1. ⚠️ Does LingoPure Vietnam work Saturdays?**
Full day, half day (morning only), or not at all? If it varies by team, tell us
which teams.
*Suggested default: Monday–Friday only.*

**A2. ⚠️ Is leave counted in working days?**
If someone takes Friday to Monday, is that 2 days deducted (weekend excluded) or
4? We strongly recommend working days — weekends and public holidays inside a
leave period are not deducted.
*Suggested default: working days. Weekends and public holidays never deduct.*

**A3. Half days — morning or afternoon?**
Do we need to know which half someone is taking (so the calendar shows "Anh Thu —
afternoon"), or is "half day" enough?
*Suggested default: yes, record AM or PM.*

**A4. Can a half day only be at the start or end of a leave period?**
E.g. "Wednesday afternoon through Friday" = 2.5 days. You cannot take half of a
day in the middle of a block.
*Suggested default: yes, first or last day only.*

**A5. What is the standard working day?**
Start and end time, and lunch break. We need this to define what "half day" means
and to show sensible times on the calendar.
*Suggested default: 8:30–17:30, one hour lunch.*

---

## B. The leave year, accrual and carry-over

**B1. ⚠️ Does annual leave accrue monthly, or is it granted as a lump at the start
of the year?**
Monthly accrual means 1 day per month worked — so in March an employee has earned
3 days, not 12. A lump grant means all 12 are available from January.
*Suggested default: monthly accrual (1 day per month), which is the common
Vietnamese practice and protects the company if someone leaves mid-year.*

**B2. ⚠️ Does the leave year run January–December, or from each person's start
date?**
Calendar year is far simpler to administer. Anniversary-based means everyone has
a different reset date.
*Suggested default: calendar year, January–December.*

**B3. ⚠️ What happens to unused annual leave at the end of the year?**
Options: it expires; it carries over in full; it carries over up to a cap (e.g. 5
days) and must be used by a deadline (e.g. 31 March).
*Suggested default: carry over up to 5 days, must be used by 31 March, remainder
expires.*

**B4. New starters — is their first year pro-rated?**
Someone joining in July gets 6 days rather than 12?
*Suggested default: yes, pro-rated from the start date.*

**B5. Do long-serving staff get extra annual leave?**
Vietnamese labour law provides an additional day of annual leave per five years of
service with the same employer. Should the system apply this automatically, or do
you prefer to set each person's allowance manually?
*Suggested default: set manually per person — the system supports a different
allowance for each employee, so you keep control. Worth confirming with your
labour law adviser whether you want it automated.*

**B6. Is unused annual leave paid out when someone leaves?**
This affects whether we need a leaver report for payroll.
*Suggested default: yes, produce a final balance report on deactivation.*

---

## C. Balances, limits and sick leave

**C1. ⚠️ What happens if someone requests more days than they have left?**
Three options: (a) block the request entirely, (b) allow it and let the balance go
negative, (c) allow it but automatically convert the excess days to unpaid leave.
*Suggested default: (a) block, with a clear message showing what they have
available and suggesting unpaid leave instead.*

**C2. Is the "3 days sick leave" paid by the company?**
We assume this is 3 days of company-paid sick leave per year without needing a
medical certificate, and that anything beyond that goes through social insurance
(BHXH) with a certificate. Is that right? If so we will label it clearly so staff
do not mistake it for their total sick entitlement.
*Suggested default: yes — 3 days company-paid, no certificate required.*

**C3. Do you need to attach a medical certificate to a sick leave request?**
Needed if staff claim through BHXH. This means file upload and storage of medical
documents, which carries extra privacy obligations — so we would rather build it
deliberately than by accident.
*Suggested default: not in the first version. Tell us if you need it.*

**C4. Should there be a minimum notice period for annual leave?**
E.g. annual leave must be requested at least 3 working days in advance. Sick leave
obviously has no notice.
*Suggested default: no enforced minimum, but the manager sees how much notice was
given.*

**C5. Should the system stop too many people from the same team being off at
once?**
E.g. warn the manager if approving would leave fewer than 2 people in a team.
*Suggested default: not in the first version.*

---

## D. Approvals and cancellations

**D1. ⚠️ Who approves a Manager's (Admin's) own leave request?**
The requirement says managers approve their team, but does not say who approves
the manager.
*Suggested default: a Super Admin approves all Manager leave.*

**D2. ⚠️ Who approves a Super Admin's own leave?**
*Suggested default: another Super Admin. If there is only one Super Admin, their
leave is recorded as automatically approved and shown clearly as self-approved in
the audit history.*

**D3. Can a Super Admin approve leave for anyone, or only when the manager has not
responded?**
*Suggested default: a Super Admin can approve anyone at any time.*

**D4. ⚠️ Can staff cancel their own leave after it has been approved?**
And does that need manager approval, or is it automatic? Different answer for
leave in the future vs leave already taken?
*Suggested default: staff can cancel future approved leave themselves and the
balance is returned automatically; leave that has already started or passed can
only be cancelled by a Super Admin.*

**D5. When an employee is deactivated, what happens to their pending requests?**
*Suggested default: pending requests are automatically declined and the manager is
notified.*

---

## E. Public holidays

**E1. Who maintains the public holiday calendar each year?**
The requirement says Super Admin — we just want to confirm one named person owns
this, because Tet dates change annually.
*Suggested default: Super Admin, reviewed each November for the following year.*

**E2. Do you use compensatory working days ("làm bù") around Tet and long
weekends?**
This is where a Saturday is worked to bridge a holiday. If yes, the calendar needs
to record both "this day is a holiday" and "this Saturday is a working day", and
the leave calculation has to respect both.
*Suggested default: yes, we build support for it.*

**E3. How far in advance should the holiday reminder email go out?**
*Suggested default: 7 days before.*

---

## F. Design, language and rollout

**F1. Is the mockup at `lingopure-hr-dashboard.thaolamx.chatgpt.site` a fixed
design, or a general direction?**
We can follow it closely or use it as a starting point and match the lingopure.com
brand.
*Suggested default: general direction, matched to the LingoPure brand.*

**F2. ⚠️ Vietnamese, English, or both?**
If both, staff pick their own language and the system remembers it — including in
the notification emails. We are building the framework for both regardless, so
this is about how much translation work is needed, not whether it is possible.
*Suggested default: both, with Vietnamese as the default for staff.*

**F3. Where should this live?**
We recommend `hr.lingopure.com` — separate from the public website, not linked
from it, not findable by search engines. Only people with a login can reach it.
*Suggested default: `hr.lingopure.com`.*

**F4. ⚠️ Who are the Super Admins on day one?**
Names and work email addresses.

**F5. ⚠️ We need the employee list to set the system up.**
For each person: first name, last name, work email, job title, department, role
(Super Admin / Manager / Staff), who their manager is, and employment start date.
A spreadsheet is fine — we can send you a template.

**F6. ⚠️ What are everyone's current leave balances?**
If we go live part-way through the year, the system needs each person's opening
balance — annual leave already taken in 2026 and sick leave already taken. Without
this the balances will be wrong from day one. Again, a spreadsheet is fine.

**F7. When do you want this live?**
Going live at the start of a leave year (1 January) avoids the opening-balance
import in F6 entirely and is much cleaner. Mid-year is possible but needs F6.

---

## F-bis. Context we are missing

Three short ones that shape how much of this is migration versus building fresh.

**F8. What do you use for leave today?**
A shared spreadsheet, Zalo messages to a manager, email to HR, paper forms, or
nothing formal? If it is a spreadsheet, that same sheet is probably the source for
the opening balances in F6, which saves you compiling them twice.

**F9. What prompted this now?**
Headcount growth, a disagreement over someone's balance, an audit, or simply wanting
it tidier? Whatever prompted it usually names the one thing that has to work on day
one, and it is rarely the biggest feature on the list.

**F10. How many employees, and how many of them are managers?**
The requirement describes departments and team calendars. At a dozen people with two
managers that layer barely matters; at sixty it is most of the product. The number
tells us how much to build there.

---

## G. Data protection — for your legal adviser, not for you to answer now

Two items we are flagging so they are not a surprise later. We are not giving legal
advice here; these are questions for your Vietnamese counsel.

**G1. Sick leave records are health data.** Under Vietnam's personal data rules
this is treated as sensitive personal data and carries stricter handling and
notification requirements than ordinary employee records.

**G2. Where the data is stored.** Employee records will sit in a managed database
outside Vietnam (currently Tokyo; Singapore is also available). Vietnam's rules on
transferring personal data outside the country may require an assessment and a
filing. **We need to know your preference before we build**, because the storage
region cannot be changed afterwards without migrating the whole system — it is
inexpensive to decide now and expensive to change later.

**G3. Which legal entity operates this?** The privacy notice needs to name the
company collecting the data, with its registration details. Please confirm the
correct entity name and registration number.

---

## What we will do while waiting

We are not blocked on all of this. We will start on the parts that do not depend on
your answers: the database design, the roles and permissions model, the audit
trail, and the screen structure. The questions marked ⚠️ need answers before we
finalise the leave calculation and before go-live.
