# PROJECT_STATE — LingoPure WOW Phase

**Updated:** 2026-09-12
**Scope doc:** `docs/WOW_PHASE_SCOPE.md` (approved + eng-reviewed; §11 locks all decisions)

## Build sequence (C0–C7) and current position

| Step | Status | Delivered |
|---|---|---|
| **C0. Curriculum Engine** | DONE | `suppabase/migrations/0037_curriculum_engine.sql` (curricula, curriculum_lessons, lesson_completions, tutor_feedback, curriculum_resets, all RLS + append-only triggers) · `src/lib/curriculum/curriculum-engine.ts` (CUR-ENGINE-v1.0.0, deterministic skill-gap/plan/reset) · `tests/curriculum/curriculum-engine.test.ts` (10/10 pass via `npm run test:curriculum`) |
| **C1. Org model (additive)** | DONE (schema+functions) | `supabase/migrations/0038_org_model_additive.sql` (organisations, organisation_memberships, organisation_departments, platform_admins; `current_org_role`, `org_is_owner_or_hr`, `org_employer_id`, `org_can_view_student`, `dept_can_view_student` SECURITY DEFINER; RLS per table). FK fix applied (teachers.id, not teachers.teacher_id). |
| **C1. platform_admins bootstrap** | PENDING | ADMIN_EMAILS → platform_admins seed — do with the auth wiring or a one-off endpoint |
| **C1. RLS DB-verify script** | PENDING | `tests/org/` + bash script next (mirror `scripts/hr-db-verify.sh`) |
| **C2. Dan dashboards → React** | NEXT | A1 learner dashboard (Phuong's journey, `2413` bucket insists the data exists), A2 student 6D/4D + `(app)/assessment/results/[id]`, A3 teacher intelligence + `(app)/teacher/students/[id]/report` |
| C3–C7 | PENDING | See §8 of scope doc |

## Key decisions locked (§11 of scope doc)
- Kira org pattern ADDITIVE (no rename, no `persons` table — memberships anchor `auth.users.id`)
- No C0-less dashboards — dynamic reset is the product spine
- Voice = DiscoveryWidget on discovery/onboarding only; classroom voices bespoke
- Billing display-only (synthetic `subscriptions`), departments fixed-nominated set, `platform_admins` canonical with ADMIN_EMAILS bootstrap

## Notes / gotchas
- `0014` teachers PK is `id` (not `teacher_id`) — 0037 uses `teachers(id)`.
- 2K result currently renders inline in `assessment-runner.tsx`; dedicated result/report pages must be created in C2 (API routes already exist).
- `@caistech/discovery-agent` NOT yet in package.json — add when wiring voice (C2 discovery surface).

## Environment
- Win32 / PowerShell 7 shell. Tests: `npm run test:curriculum` (node:test + tsx; `@/` path alias resolves).
- Unrelated pre-existing changes in tree: `src/middleware.ts` → `src/proxy.ts` migration in flight (Next 16), `tree.py`, BPO gate fixtures.