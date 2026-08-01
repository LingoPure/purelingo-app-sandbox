#!/usr/bin/env bash
# HR integration tests — the TypeScript authorisation and lifecycle logic.
#
# Runs tests/hr/integration.test.ts against a REAL Supabase, with real user
# JWTs and real RLS. This is the layer scripts/hr-db-verify.sh cannot reach:
# that one proves the database constraints hold, but never executes a line of
# requests.ts or employees.ts.
#
# TARGET. Env-driven, so it works against a local `supabase start` stack or any
# remote project. Deliberately not pinned to one project: the module is built to
# be handed over, and a harness needing specific credentials would not travel.
#
#   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#
# Sourced from .env.local by default. Override by exporting them first.
#
# ISOLATION. Each run creates its own organisations with random ids and deletes
# them afterwards. It never reads or writes existing data, and cross-org
# isolation is itself one of the assertions.
#
# HR_TEST_HARNESS=1 is required by the test seam in src/lib/hr/deps.ts. That
# seam can swap the client carrying the caller's identity, so it refuses to
# engage without an explicit opt-in and refuses outright in production.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

MISSING=()
[ -n "${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}" ] || MISSING+=("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] || MISSING+=("NEXT_PUBLIC_SUPABASE_ANON_KEY")
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || MISSING+=("SUPABASE_SERVICE_ROLE_KEY")

if [ ${#MISSING[@]} -gt 0 ]; then
  # Fails rather than skips. A suite that quietly skips when unconfigured is
  # indistinguishable from one that passed, and the reason this harness exists
  # is that an untested path looked fine right up until it did not.
  echo "HR integration tests are not configured. Missing:" >&2
  for m in "${MISSING[@]}"; do echo "  - $m" >&2; done
  exit 1
fi

TARGET="${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
echo "==> target: $TARGET"
echo "==> creating isolated test organisations (removed on completion)"

export HR_TEST_HARNESS=1
export NODE_ENV=test

npx tsx --test tests/hr/integration.test.ts
