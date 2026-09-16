# Role Matrix — LingoPure platform (C7)

The canonical spec for **who can see which surface and which rows**, covering
every portal and the RLS layer underneath. The DB half of this spec is
enforced by the harness `npm run test:org:db` (the "role × table visibility
grid" in `tests/org/org-rls-verify.sql`); the route half is intended for
`tests/e2e/06-role-matrix.spec.ts`.

## Role hierarchy

```
LingoPure Platform Admin (P0)
  └── Client Organisation Admin — owner / hr (P1)
        └── Department Head (P2)               [forward hook, not yet populated]
              └── Staff / Teacher / Student (P3)
```

Cross-cutting: **Content Editor** (`content_editors`) — out of C7 scope; and
**platform admin** is *not* an org member — it reads across orgs.

## Routes × roles

| Route | owner | hr | teacher | staff | student | platform admin | other |
|---|---|---:|---:|---:|---:|---:|---:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/admin` + sub-routes | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 |
| `/org/new` | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | any signed-in user bootstraps |
| `/org/onboarding/[orgId]` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `/org/[slug]` + departments / billing | ✅ | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| `/org/[slug]/staff`, `…/students`, `…/teachers` | ✅ | ✅ | ✅ list-only | 🚫 | 🚫 | 🚫 | 🚫 |
| `/org/[slug]/settings` | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| `/teacher`, `/teacher/students/[id]` | 🚫 | 🚫 | ✅ assigned only | 🚫 | 🚫 | 🚫 | 🚫 |
| `/teacher/students/[id]/report` | ✅ org ladder | ✅ | ✅ assigned | 🚫 | self only | ✅ | 🚫 |
| `/employer`, `/employer/*` | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | HR-admin only (`employer_admins`) |

Gates implemented in layouts/loaders:
- `/admin` → `isPlatformAdmin` (`src/lib/platform/auth.ts`) + 0044 RLS
- `/org/[slug]` → `getOrgIdentity` / `requireOrgRole` (`src/lib/org/auth.ts`)
- `/org/new`, `/org/onboarding` → owner/hr via `requireOrgRole`
- `/teacher` → `getTeacherIdentity` (`src/lib/teacher/auth.ts`) + `org_can_view_student` gates on every assessment read (`src/lib/2k/pipeline-loader.ts`)

## Row visibility × tables (DB grid, asserted in `test:org:db`)

Fixture orgs: **Celadon** (owner/hr/teacher/staff/student), **OtherCo** (staff +
teacher with cross-org assignment). `responses` counts rows under Phuong's
COMPLETE session only.

| Role | organisations | memberships | subscriptions | org_onboarding | assessment_sessions | assessment_responses | teacher_notes | classin_sessions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| owner | 1 | 5 | 1 | 1 | 2 | 1 | 1 | 1 |
| hr | 1 | 5 | 1 | 1 | 2 | 1 | 1 | 1 |
| teacher (assigned) | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 |
| staff | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| student | 1 | 1 | — | — | 0 | 0 | 0 | 0 |
| outsider (OtherCo) | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| teacherB (cross-org) | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| platform admin | 2 | 7 | 1 | 1 | 0 | 0 | 0 | 0 |

> Platform admin reads org-model tables (0044 read-all) only as a non-member;
> learner sessions stay behind the `org_can_view_student` gate (0040). The
> student-facing (C2) + teacher-facing (C6) surfaces — `teacher_notes` (0045)
> and `classin_sessions` (0049) — use the same `org_can_view_student` policy
> shape, so their row counts track the assessment tables exactly.

## DB functions (the permission model)

| Function | Purpose |
|---|---|
| `current_org_role(org_id)` | caller's role in an org (membership only) |
| `org_is_owner_or_hr(org_id)` | owner/hr boolean |
| `org_can_view_student(id)` | self / owner-hr / assigned teacher |
| `dept_can_view_student(id)` | **forward hook** — currently mirrors `org_can_view_student`; the dept-scoped branch activates when students become department-linked (0043 allocation) |
| `platform_is_admin()` | 0044 helper used by the read-all policies |

## Append-only budget

- **no UPDATE/DELETE** policies on any org-model table or membership table
  (writes are service-role after the UI gate)
- the single sanctioned UPDATE policy is `assessment_responses_self_update`
  (learner updates their own response only)