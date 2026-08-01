#!/usr/bin/env bash
# HR foundation database verification. Issue #4 acceptance criteria 1-6, 9, 10.
#
# Spins up a throwaway Postgres, applies the HR migration to an EMPTY database,
# re-applies it to prove idempotency, then runs the RLS and constraint
# assertions in tests/hr/rls-verify.sql.
#
# Two things this proves that a live database cannot:
#
#   1. The migration applies with NOTHING else present — no other LingoPure
#      migration, no prior schema. That is the portability claim in the
#      migration header, and running against the shared sandbox (where 0001-0026
#      already exist) would never test it.
#
#   2. RLS is verified by querying AS each role. Postgres bypasses RLS for a
#      table's owner, so the assertions `set role authenticated` first. Testing
#      through the application would only ever prove the UI hides things.
#
# Requires: docker. Nothing else — no Supabase project, no network, no keys.
# Usage:    npm run test:hr:db
set -euo pipefail

# Git Bash on Windows rewrites /tmp/... into a Windows path when it crosses into
# docker. This turns that off for the container paths below.
export MSYS_NO_PATHCONV=1

CONTAINER="hr-pgtest-$$"
IMAGE="${HR_TEST_PG_IMAGE:-postgres:17}"
DB="hrverify"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $IMAGE as $CONTAINER"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=hrtest -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null

echo "==> waiting for postgres"
until docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; do
  sleep 1
done

psql_run() {
  docker exec "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

# Host paths are passed RELATIVE, deliberately. On Git Bash, `pwd` yields
# /c/Users/... which the Windows docker binary cannot resolve, and
# MSYS_NO_PATHCONV=1 (needed for the container-side /tmp paths) switches off the
# translation that would otherwise fix it. Relative paths sidestep both.
cd "$REPO_ROOT"
# HR migrations are discovered by glob and applied in filename order, so a new
# one is picked up without editing this script. The *_hr_NN_* naming is what
# carries the module's internal ordering through a renumbering into another repo.
HR_MIGRATIONS=$(ls supabase/migrations/*_hr_*.sql | sort)

for f in \
  "tests/hr/supabase-shim.sql" \
  $HR_MIGRATIONS \
  "tests/hr/rls-verify.sql" \
  "tests/hr/employees-verify.sql" \
  "tests/hr/calendar-verify.sql"
do
  docker cp "$f" "$CONTAINER:/tmp/$(basename "$f")" >/dev/null
done

echo "==> applying Supabase shim (auth.users, auth.uid, auth.jwt, role grants)"
psql_run -q -f /tmp/supabase-shim.sql

echo "==> applying HR migrations to an EMPTY database"
for f in $HR_MIGRATIONS; do
  echo "    $(basename "$f")"
  psql_run -q -f "/tmp/$(basename "$f")" 2>&1 | grep -v "NOTICE" || true
done

echo "==> re-applying to prove idempotency"
for f in $HR_MIGRATIONS; do
  psql_run -q -f "/tmp/$(basename "$f")" >/dev/null 2>&1
done
echo "    idempotent re-run: ok"

echo "==> verifying RLS policies and ledger constraints"
psql_run -f /tmp/rls-verify.sql 2>&1 | grep -E "ok:|FAIL|ERROR|PASSED" || {
  echo "verification produced no assertions — treating as failure"
  exit 1
}

echo "==> verifying employee-record constraints"
psql_run -f /tmp/employees-verify.sql 2>&1 | grep -E "ok:|FAIL|ERROR|PASSED" || {
  echo "verification produced no assertions — treating as failure"
  exit 1
}

echo "==> verifying team-calendar privacy"
psql_run -f /tmp/calendar-verify.sql 2>&1 | grep -E "ok:|FAIL|ERROR|PASSED" || {
  echo "verification produced no assertions — treating as failure"
  exit 1
}

echo ""
echo "HR foundation database verification: PASSED"
