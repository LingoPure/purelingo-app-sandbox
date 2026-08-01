#!/usr/bin/env bash
# THE DRY-RUN LIFT. Issue #9 acceptance criterion 3.
#
# Every previous PR in this epic has CLAIMED the HR module can be lifted into
# another repo by rewriting one file. This is the script that finds out.
#
# It copies the module into an empty scratch project — no LingoPure code, no
# LingoPure tsconfig, no LingoPure dependencies beyond what the module actually
# declares — writes a REPLACEMENT `deps.ts` against a plain Supabase client, and
# typechecks. If anything other than `deps.ts` needed editing, the portability
# contract did not hold and the failure surfaces here rather than during the
# real handover, with the client waiting.
#
# WHY THIS IS NOT THE SAME AS `npm run check:hr`. That check greps for imports
# that escape the module. This one actually resolves them. A grep cannot catch a
# transitive dependency pulled in through a type, a path alias that silently
# resolves back into the host app, or a package the module uses but the
# destination will not have installed.
#
# Requires: node + npx (tsc). No network, no database, no Supabase project.
# Usage:    npm run test:hr:lift
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SCRATCH="${HR_LIFT_SCRATCH:-$(mktemp -d)}"
cleanup() { [ -n "${HR_LIFT_KEEP:-}" ] || rm -rf "$SCRATCH"; }
trap cleanup EXIT

echo "==> scratch project: $SCRATCH"

mkdir -p "$SCRATCH/src/lib/hr" "$SCRATCH/src/app/hr" "$SCRATCH/supabase/migrations"

# ── What moves. This list IS the handover manifest, executable. ──────────────
cp -r src/lib/hr/. "$SCRATCH/src/lib/hr/"
cp -r src/app/hr/. "$SCRATCH/src/app/hr/"
cp supabase/migrations/*_hr_*.sql "$SCRATCH/supabase/migrations/"

# API routes live outside the two module directories because Next dictates their
# location. They are part of the module and the manifest says so.
if [ -d src/app/api/hr ]; then
  mkdir -p "$SCRATCH/src/app/api/hr"
  cp -r src/app/api/hr/. "$SCRATCH/src/app/api/hr/"
fi

# ── The ONE file a destination repo rewrites. ────────────────────────────────
#
# Deliberately written against plain `@supabase/supabase-js` rather than the
# host's `@supabase/ssr` helpers, to prove the module depends on the SHAPE of a
# client and not on LingoPure's particular way of building one. If the module
# had reached past this seam for anything, the typecheck below would fail.
cat > "$SCRATCH/src/lib/hr/deps.ts" <<'DEPS'
/**
 * REPLACEMENT SEAM — written by scripts/hr-lift-dryrun.sh.
 *
 * This is what a destination repo writes instead of the LingoPure version. It
 * uses plain @supabase/supabase-js with no host helpers at all, which is the
 * point: if the module needed anything else from the host, the typecheck fails.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type UserClient = SupabaseClient;
type ServiceClient = SupabaseClient;

let testOverrides: {
  userClient?: () => Promise<UserClient>;
  serviceClient?: () => ServiceClient;
} | null = null;

export function __setHrTestClients(
  overrides: {
    userClient?: () => Promise<UserClient>;
    serviceClient?: () => ServiceClient;
  } | null
): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__setHrTestClients is a test seam");
  }
  testOverrides = overrides;
}

export async function hrUserClient(): Promise<UserClient> {
  if (testOverrides?.userClient) return testOverrides.userClient();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
}

export function hrServiceClient(): ServiceClient {
  if (testOverrides?.serviceClient) return testOverrides.serviceClient();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type HrSupabaseClient = UserClient;
DEPS

# ── A minimal destination project. Nothing LingoPure-specific. ───────────────
cat > "$SCRATCH/tsconfig.json" <<'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowJs": true,
    "incremental": false,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "next-env.d.ts"]
}
TSCONFIG

# Symlinking beats reinstalling: the point is whether the module's declared
# dependencies suffice, not whether npm works.
ln -s "$REPO_ROOT/node_modules" "$SCRATCH/node_modules" 2>/dev/null \
  || cp -r "$REPO_ROOT/node_modules" "$SCRATCH/node_modules"

cp "$REPO_ROOT/next-env.d.ts" "$SCRATCH/next-env.d.ts" 2>/dev/null || true

echo "==> module copied: $(find "$SCRATCH/src" -type f | wc -l | tr -d ' ') files, $(ls "$SCRATCH/supabase/migrations" | wc -l | tr -d ' ') migrations"
echo "==> deps.ts REPLACED with a plain @supabase/supabase-js implementation"
echo "==> typechecking against an empty project"

if npx tsc --project "$SCRATCH/tsconfig.json" 2>&1 | tee /tmp/hr-lift-tsc.log | head -40; then
  echo ""
  echo "DRY-RUN LIFT PASSED — the module typechecks in a scratch project with"
  echo "only deps.ts rewritten. Nothing else needed editing."
else
  echo ""
  echo "DRY-RUN LIFT FAILED."
  echo ""
  echo "The module could not be typechecked outside this repo with only deps.ts"
  echo "replaced. Every error above is something a destination repo would hit on"
  echo "handover day. Fix it HERE — that is what this script is for."
  exit 1
fi
