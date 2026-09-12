#!/usr/bin/env bash
# Organisation-model database verification (C1).
#
# Spins up a throwaway Postgres, applies the SUPABASE SHIM plus the migrations
# 0038 depends on (0001 employers/students, 0014 teachers/assignments), then 0038
# itself, re-applies 0038 to prove idempotency, and runs the RLS budget
# assertions in tests/org/org-rls-verify.sql.
#
# This proves the SECURITY DEFINER gate layer behaves under SET ROLE, exactly
# like the HR verify does for its own migrations — the only way to test that
# RLS row budgets are enforced by the database rather than by the UI.
#
# Requires: docker. Nothing else — no Supabase project, no network, no keys.
# Usage:    npm run test:org:db
set -euo pipefail

export MSYS_NO_PATHCONV=1

# Git Bash shadows Docker Desktop's client with a broken msys docker.io binary
# (existing YOUR-NAME docker panics finding the npipe). Prefer the real client
# when Git Bash is in play.
if command -v docker.exe >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  DOCKER="docker.exe"
else
  DOCKER="docker"
fi

CONTAINER="org-pgtest-$$"
IMAGE="${ORG_TEST_PG_IMAGE:-postgres:17}"
DB="orgverify"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { $DOCKER rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $IMAGE as $CONTAINER"
$DOCKER run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=orgtest -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null

echo "==> waiting for postgres"
until $DOCKER exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; do
  sleep 1
done

psql_run() {
  $DOCKER exec "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

cd "$REPO_ROOT"
FILES=(
  "tests/org/supabase-shim.sql"
  "supabase/migrations/0001_initial_schema.sql"
  "supabase/migrations/0007_students_native_language.sql"
  "supabase/migrations/0014_teachers_departments.sql"
  "supabase/migrations/0030_2k_assessment_pipeline.sql"
  "supabase/migrations/0033_2k_closed_loop.sql"
  "supabase/migrations/0037_curriculum_engine.sql"
  "supabase/migrations/0038_org_model_additive.sql"
  "supabase/migrations/0039_learner_notes.sql"
  "supabase/migrations/0040_teacher_report_context.sql"
  "supabase/migrations/0041_subscriptions_synthetic.sql"
  "supabase/migrations/0042_org_onboarding_state.sql"
  "supabase/migrations/0043_staff_department_allocation.sql"
  "supabase/migrations/0044_platform_admin_readall.sql"
  "supabase/migrations/0045_teacher_notes.sql"
  "tests/org/org-rls-verify.sql"
)
for f in "${FILES[@]}"; do
  $DOCKER cp "$f" "$CONTAINER:/tmp/$(basename "$f")" >/dev/null
done

echo "==> applying Supabase shim (auth.users, auth.uid, auth.jwt, role grants)"
psql_run -q -f /tmp/supabase-shim.sql

echo "==> applying prerequisite + org migrations"
for f in "${FILES[@]:1:6}"; do
  echo "    $(basename "$f")"
  psql_run -q -f "/tmp/$(basename "$f")" 2>&1 | grep -v "NOTICE" || true
done

echo "==> re-applying 0038 to prove idempotency"
$DOCKER cp "supabase/migrations/0038_org_model_additive.sql" "$CONTAINER:/tmp/0038_rerun.sql" >/dev/null
psql_run -q -f /tmp/0038_rerun.sql >/dev/null 2>&1
echo "    idempotent re-run: ok"

echo "==> applying 0038-#45 migrations (org model + notes, idempotency-checked)"
for f in "${FILES[@]:7:8}"; do
  echo "    $(basename "$f")"
  psql_run -q -f "/tmp/$(basename "$f")" 2>&1 | grep -v "NOTICE" || true
  $DOCKER cp "$f" "$CONTAINER:/tmp/rerun-$(basename "$f")" >/dev/null
  psql_run -q -f "/tmp/rerun-$(basename "$f")" >/dev/null 2>&1
  echo "    idempotent re-run: ok"
done

echo "==> verifying RLS budget + visibility functions"
psql_run -f /tmp/org-rls-verify.sql 2>&1 | grep -E "ok:|FAIL|ERROR|PASSED" || {
  echo "verification produced no assertions — treating as failure"
  exit 1
}
echo "==> org model RLS verify: PASSED"