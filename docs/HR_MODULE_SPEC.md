# EPIC — HR & Leave Management module (portable)

**Status:** draft for review
**Target:** built in `lingopureai` as a sandbox, lifted into the main LingoPure repo
**Client contact / day-one Super Admin:** Thao
**Open client questions:** `docs/HR_MODULE_QUESTIONS_FOR_THAO.md`

---

## Context

LingoPure Pte Ltd needs an internal HR dashboard for its Vietnam staff: employees
submit leave requests, managers approve their own team, and a Super Admin manages
everyone plus roles, policies and individual leave balances. Source requirement is
the Trello card "LingoPure HR Dashboard" (Backlog, filed 2026-07-21), with a static
reference mock at `lingopure-hr-dashboard.thaolamx.chatgpt.site`.

The requirement is strong on screens and roles and near-silent on arithmetic. Every
rule that decides how many days come off a balance — working days vs calendar days,
accrual timing, carry-over, over-balance behaviour — is unspecified. That is where
leave systems generate both bugs and payroll disputes, so this spec makes those
rules **data** rather than code, and the unanswered ones become rows in a policy
table instead of rework.

**This repo is a build sandbox.** The module is developed here against the existing
Supabase project and Vercel deployment, then lifted into LingoPure's main repo. That
makes portability the primary architectural constraint, not an afterthought.

---

## Current State (verified 2026-08-01)

| Capability | State in this repo |
|---|---|
| Supabase auth + `@supabase/ssr` | ✅ `src/lib/supabase/{server,client,admin,middleware}.ts` |
| Role-gated portal pattern | ✅ `current_content_role()` in `supabase/migrations/0023_content_editors.sql` — `SECURITY DEFINER` role fn, RPC on the **user-scoped** client, writes service-role-only behind an app gate. **This is the pattern HR copies.** |
| Persistent nav chrome + Sign Out | ✅ `src/app/admin/layout.tsx` — sidebar collapsing at `md:`, 44px targets |
| i18n with Vietnamese | ✅ `src/lib/i18n/dictionary.ts:16` declares `vi` / Tiếng Việt; populated `vi` dict at line 274. **EN/VI is extending a dictionary, not building i18n.** |
| Resend email | 🟡 `src/lib/email/invite.ts` — hand-rolled `fetch`, no identification footer |
| Cron | ✅ `src/app/api/cron/nudges/route.ts` + `vercel.json` crons |
| Migration conventions | ✅ idempotent, `update_updated_at()` trigger, RLS on every table |
| Anything HR / leave / holiday | ❌ nothing exists |

**Org-model collision to avoid.** This repo already models three org charts:
`employers` → `students` (the buyer's staff), and `teachers` + `departments`
(LingoPure's academic staff). HR is LingoPure's *own* org chart and overlaps
`teachers`. Attaching HR to `teachers` would make the module unliftable on day one.
HR gets its own `hr_employees` with **no foreign key to any LingoPure table**.

---

## Architecture

### A1. Balance is an append-only ledger, never a mutable column

The single load-bearing decision. `hr_leave_ledger` holds one signed row per balance
event; a balance is `SUM(days)` over it. Four separate requirements in the card fall
out of this one structure rather than needing four mechanisms:

| Card requirement | How the ledger satisfies it |
|---|---|
| "prevent duplicate deductions if the approval action is triggered more than once" | partial unique index on `(request_id, entry_type)` — a second approval write violates the constraint |
| "cancelling previously approved leave should restore the relevant balance" | a compensating `request_cancelled` row, not a subtraction |
| "record every manual adjustment with previous balance / new balance / reason" | the `manual_adjustment` rows **are** the history; previous and new balance are derivable |
| "declined or pending requests must not deduct any balance" | no ledger row is written until approval |

A mutable `annual_leave_remaining` column would drift, and once it drifts there is
nothing to reconcile against.

### A2. Every unanswered policy question is a column, not a code path

`hr_org_policy` holds the rules. Thao's answers become `UPDATE` statements.

| Thao question | Policy column |
|---|---|
| A1 Saturdays worked | `working_days int[]`, `saturday_hours` |
| A2 working days vs calendar days | `count_basis` |
| A5 standard working day | `day_start_time`, `day_end_time` |
| B1 accrual vs lump grant | `accrual_mode` |
| B2 leave year basis | `leave_year_basis` |
| B3 carry-over | `carry_over_max_days`, `carry_over_expiry_month` |
| B4 pro-rata first year | `prorate_first_year` |
| B5 seniority accrual | per-person `hr_employee_entitlements.annual_allowance` |
| C1 over-balance behaviour | `over_balance_policy` |
| C4 minimum notice | `min_notice_days` |
| D1/D2 who approves approvers | `approver_escalation` |
| D4 self-cancel approved leave | `self_cancel_future`, `self_cancel_past` |
| E3 holiday reminder lead time | `holiday_notice_days` |
| F2 default language | `default_locale` |

Every one ships with the recommended default from the questions doc. Nothing is
blocked on an answer; answers change a row.

### A3. Portability — the module must lift cleanly

- **Namespace:** `hr_*` tables, `src/lib/hr/**`, `src/app/hr/**`, migrations named
  `00NN_hr_NN_<topic>.sql` so they are greppable and internally ordered after
  renumbering into the destination repo.
- **Zero imports from LingoPure domain code.** No `@/lib/employer`, no `@/lib/classin`,
  no FK to `employers` / `students` / `teachers` / `departments`.
- **One dependency seam.** `src/lib/hr/deps.ts` is the **only** file in the module that
  imports from outside `src/lib/hr` and `src/app/hr`. It re-exports the Supabase client
  factories and the session getter. Swap-in = rewrite one file.
  A CI check enforces this: any other module file importing `@/lib/{supabase,employer,…}`
  fails the build.
- **No private-registry dependencies.** `@caistech/*` packages live on a private GitHub
  Packages registry the destination repo will not have. The email layer is a small local
  implementation (~80 lines) mirroring `src/lib/email/invite.ts`. **This deliberately
  inverts the portfolio `@caistech`-first rule, because this module is built to be handed
  over to a repo that cannot reach that registry.**
- **Module-local i18n.** `src/lib/hr/i18n/` mirrors the shape of `src/lib/i18n` but
  resolves locale from `hr_employees.locale` rather than `students.native_language`.
  Convergent shape, independent code.

### A4. RLS is the enforcement boundary

The card is explicit: "permission rules must be enforced by the backend and not only
hidden in the UI." That means database policies, not `if (role === 'admin')`.

Three `SECURITY DEFINER` functions, following the `current_content_role()` precedent:

```sql
public.hr_current_employee()            -- → hr_employees.id for auth.uid(), by user_id OR email
public.hr_current_role()                -- → 'super_admin' | 'admin' | 'staff' | null
public.hr_can_view_employee(target uuid)-- → the visibility predicate every policy uses
```

`hr_can_view_employee` is where "Admin sees only assigned team members" actually lives:

- `super_admin` → true for every employee in the same org
- `admin` → true when `target.manager_id = hr_current_employee()`, or self
- `staff` → true only for self

**Do not copy `src/lib/employer/auth.ts:41`.** It uses the service-role client to dodge
an `@supabase/ssr` cookie-timing race, which bypasses RLS entirely. Defensible for a demo
employer gate; fatal here, where per-role isolation *is* the product. HR reads go through
the user-scoped client so policies apply. Service-role is used only in explicitly-gated
write paths, same as `content_editors`.

### A5. Timezone

Every date decision — "off today", effective dates, holiday boundaries, accrual dates —
computes in the org timezone (`Asia/Ho_Chi_Minh`), never server UTC and never the browser.
Vercel runs UTC; a 7-hour offset makes "today" wrong for 7 hours a day. One helper,
`src/lib/hr/dates.ts`, owns this; no direct `new Date()` in module logic.

### A6. Sandbox data policy

The sandbox **never receives the real employee roster**. Seed data is realistic but
fabricated. The real roster and opening balances (Thao doc F5/F6) are loaded only in the
destination environment, after the swap-in. This is the control that replaces
infrastructure isolation.

---

## Schema

All tables carry `org_id`, have RLS enabled, and use the existing `update_updated_at()`
trigger.

```sql
-- The tenancy anchor. One row on day one; exists so the module is org-scoped
-- from the first migration rather than being retrofitted.
hr_organisations (
  id, name, legal_entity, registration_number, country,
  timezone default 'Asia/Ho_Chi_Minh', created_at, updated_at
)

-- Employee record. Exists BEFORE the person has a login (Super Admin creates,
-- then invites), so auth_user_id is nullable and email is the bootstrap key —
-- the 0023_content_editors pattern.
hr_employees (
  id, org_id,
  auth_user_id uuid null unique → auth.users,
  email text not null,
  first_name, last_name, job_title, department,
  hr_role text check in ('super_admin','admin','staff'),
  manager_id uuid null → hr_employees,          -- self-referencing
  employment_start_date date not null,
  employment_end_date date null,
  status text check in ('invited','active','deactivated'),
  locale text default 'vi' check in ('en','vi'),
  invited_at, invite_accepted_at,
  unique (org_id, lower(email))
)

-- A TABLE, not an enum: the card requires the Super Admin to configure leave
-- policies. Adding "maternity leave" must not require a migration.
hr_leave_types (
  id, org_id, code, name_en, name_vi,
  deducts_balance bool,        -- false for unpaid + public_holiday
  default_allowance numeric(4,1) null,
  requires_approval bool default true,
  active bool default true, sort_order,
  unique (org_id, code)
)

-- Per-person, per-year allowance. This is the card's "edit the employee's annual
-- allowance", and it is what makes seniority accrual (Thao B5) a data question.
hr_employee_entitlements (
  id, org_id, employee_id, leave_type_id, leave_year int,
  allowance numeric(4,1) not null,
  unique (org_id, employee_id, leave_type_id, leave_year)
)

hr_leave_requests (
  id, org_id, employee_id, leave_type_id,
  start_date date, end_date date,
  start_half text null check in ('am','pm'),   -- half-day on the first day
  end_half   text null check in ('am','pm'),   -- half-day on the last day
  requested_days numeric(4,1) not null,        -- computed at submit, frozen
  reason text,
  status text check in ('pending','approved','declined','cancelled'),
  decided_by, decided_at, decision_note,
  cancelled_by, cancelled_at, cancellation_reason,
  created_at, updated_at
)

-- THE core table. Balance = SUM(days). Signed: positive grants, negative consumes.
hr_leave_ledger (
  id, org_id, employee_id, leave_type_id, leave_year int,
  entry_type text check in (
    'opening_balance','accrual','request_approved','request_cancelled',
    'manual_adjustment','carry_over','expiry'
  ),
  days numeric(4,1) not null,
  request_id uuid null → hr_leave_requests,
  effective_date date not null,
  reason text,                      -- CHECK: mandatory when entry_type='manual_adjustment'
  created_by uuid null → hr_employees,
  created_at timestamptz
)
-- The idempotency guard the card asks for in prose:
create unique index hr_ledger_one_entry_per_request
  on hr_leave_ledger (request_id, entry_type) where request_id is not null;

hr_public_holidays (
  id, org_id, date, name_en, name_vi,
  is_recurring bool,                -- fixed-date (National Day) vs lunar (Tet)
  notify_days_before int, notified_at,
  unique (org_id, date)
)

-- The làm bù requirement: a Saturday designated as a working day to bridge a
-- holiday. A holidays-only table cannot express this, and getting it wrong
-- corrupts every day count in that week.
hr_working_day_overrides (
  id, org_id, date, is_working_day bool not null, note,
  unique (org_id, date)
)

hr_org_policy (org_id pk, …)        -- see A2; one row per org

-- Non-balance events: role changes, deactivation, policy edits, holiday edits,
-- invite resends. Balance events are audited by the ledger itself.
hr_audit_log (
  id, org_id, actor_employee_id, action, entity_type, entity_id,
  before jsonb, after jsonb, created_at
)
```

### The day-count function

The one piece of logic worth stating precisely, because everything else depends on it:

```
countLeaveDays(start, end, startHalf, endHalf, policy, holidays, overrides) → numeric

  for each calendar date from start to end (in org timezone):
    working = ISO-dow ∈ policy.working_days
    if override exists for date: working = override.is_working_day
    if a public holiday falls on date: working = false
    if working: days += 1
  if startHalf is set and the start date was working: days -= 0.5
  if endHalf is set and the end date was working and end ≠ start: days -= 0.5
  return days
```

Public holidays and weekends are excluded, satisfying "Public Holidays do not
deduct Annual or Sick Leave" structurally rather than as a special case. The
override lookup precedes the holiday check so a `làm bù` Saturday counts as a
working day.

---

## Child issues

```
EPIC — HR & Leave module
 │
 ├─ #1 Foundation ──────────────┬─> #2 Employees, roles, teams
 │   schema · ledger · RLS      │       │
 │   policy · deps seam         │       ├─> #3 Leave engine
 │   NO client answers needed   │       │       │
 │                              │       │       ├─> #5 Notifications + i18n
 │                              └───────┴─> #4 Calendar + holidays
 │                                              │
 └─ #6 Swap-in kit ─────────────────────────────┘  (last: verifies the lift)
```

**Sequencing rationale.** #1 is first because it needs zero answers from Thao and
everything else sits on it — starting anywhere else means rework once the ledger
lands. #3 is the highest-risk issue (it owns the arithmetic and the approval race)
and depends on the most client answers, so it deliberately sits behind #1 and #2
rather than being attempted early. #4 must precede any go-live even though it looks
peripheral: without the holiday calendar the day count is wrong, so it is not
optional. #6 is last because it verifies the lift against the finished module.

| # | Title | Priority | Effort (human / CC) | Blocked on |
|---|---|---|---|---|
| 1 | Foundation: schema, ledger, RLS, policy, deps seam | Critical | ~1 wk / ~4h | nothing |
| 2 | Employees, roles, team assignment, invites | Critical | ~1 wk / ~4h | Thao F4/F5 to seed |
| 3 | Leave engine: request → approve → deduct → cancel | Critical | ~1.5 wk / ~6h | Thao A1–A5, B1–B4, C1, D1–D5 |
| 4 | Team calendar, VN public holidays, comp working days | High | ~1 wk / ~4h | Thao A1, E1–E3 |
| 5 | Email notifications + EN/VI | High | ~0.5 wk / ~3h | Thao F2 |
| 6 | Swap-in kit: portability manifest, seed data, handover | Medium | ~0.5 wk / ~2h | #1–#5 |

Total ≈ 5.5 weeks human / ≈ 23h CC.

---

## Acceptance criteria (epic level)

1. A Staff user cannot read any `hr_employees` row but their own, verified by
   querying the API directly with their session — not by checking the UI.
2. An Admin can read exactly the employees whose `manager_id` is their own employee
   id, and no others, verified the same way.
3. A Super Admin can read every employee in their org and none in any other org
   (verified with a second seeded org).
4. Approving the same request twice writes exactly one `request_approved` ledger row;
   the second attempt fails on the unique index and returns a clean error.
5. A request spanning Friday→Monday over a normal weekend deducts 2.0 days.
6. A request spanning a week containing one public holiday deducts 4.0 days.
7. A request spanning a week containing a `làm bù` Saturday override deducts 6.0 days.
8. A half-day request deducts exactly 0.5.
9. Declining a request writes no ledger row; the balance is unchanged.
10. Cancelling an approved request writes a compensating row and restores the balance
    to its pre-approval value exactly.
11. Every manual adjustment appears in the ledger with actor, reason, effective date
    and derivable before/after balances; an adjustment with no reason is rejected.
12. Adjusting one employee's balance changes no other employee's balance.
13. Public Holiday and Unpaid Leave requests deduct nothing from annual or sick.
14. Notification emails reach the assigned manager, the Super Admin, and the requester,
    each in that recipient's own locale.
15. Every page renders correctly at 375px and 1440px with no horizontal scroll, 44px
    touch targets, 16px base text.
16. Every page carries an explanatory header; every authenticated route carries the
    persistent nav with Settings and Sign Out.
17. `grep -rn "@/lib/\(employer\|classin\|investor\|content\|i18n\|supabase\)" src/lib/hr src/app/hr`
    returns matches in `deps.ts` only.
18. No `hr_*` table has a foreign key to any non-`hr_*` table except `auth.users`.

Criteria 17 and 18 are the portability contract, checked in CI.

---

## Testing plan

| Layer | What | Count |
|---|---|---|
| Unit | `countLeaveDays` across weekends, holidays, overrides, half-days, single-day, reversed ranges | +18 |
| Unit | Balance projection from ledger; carry-over and expiry arithmetic | +8 |
| Integration | RLS: staff / admin / super-admin read scopes, cross-org isolation | +9 |
| Integration | Approve-twice idempotency; concurrent approve by manager and Super Admin | +4 |
| Integration | Cancel restores exactly; declined writes nothing | +4 |
| Integration | Overlapping-request rejection; over-balance behaviour per policy | +4 |
| E2E | Staff submits → manager approves → balance updates → email sent | +1 |
| E2E | Super Admin adjusts one balance → audit row → other employee unaffected | +1 |

The approve-twice and concurrent-approver tests are the ones that matter most; they
cover the failure the card calls out in prose and that the unique index exists to stop.

---

## Rollback

Per-issue: each migration ships a paired `down` script, and no destructive change to
existing LingoPure tables is made at any point — the module is purely additive, so
rollback is dropping `hr_*` and deleting `src/{lib,app}/hr`. No LingoPure table is
altered, which is also what makes the module liftable.

---

## Out of scope

- Payroll integration or salary data of any kind.
- Timesheets, attendance, clock-in.
- Performance reviews, recruitment, onboarding checklists.
- Medical certificate upload (Thao C3 — deferred by default; needs an explicit yes,
  because it changes the data-protection posture).
- Multi-org tenant UI. `org_id` exists on every table so the module *can* become
  multi-tenant, but no org-switching UI, no org admin, no billing is built.
- Migrating the real roster or opening balances into this sandbox (A6).
- Any change to the existing LingoPure product surfaces.

---

## Open questions

11 blocking questions are with Thao in `docs/HR_MODULE_QUESTIONS_FOR_THAO.md`, each
with a recommended default. Issue #1 needs none of them. Issue #3 needs most of them.
Because every answer maps to a `hr_org_policy` column (A2), a late answer is an
`UPDATE`, not a rewrite.

Three further questions for Dennis, unanswered:
- What does LingoPure use for leave today? (determines migration effort)
- What triggered the request now? (names the day-one must-work feature)
- Headcount and manager count? (decides whether the team layer is load-bearing)
