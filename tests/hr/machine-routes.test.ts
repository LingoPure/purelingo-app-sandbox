/**
 * Machine-callable route guard.
 *
 * WHY THIS EXISTS. A session-refresh middleware redirects anything without a
 * session, and a Next matcher normally runs on everything — so a cron route is
 * 307'd to /login unless it is explicitly excluded. A redirect is not an error:
 * nothing throws, nothing logs, the caller often follows it to a 200 HTML page,
 * and the scheduled job simply never runs while looking perfectly healthy from
 * outside.
 *
 * `@caistech/portfolio-gate` ships `portfolio-gate-audit-machine-routes` for
 * exactly this, but it needs >= 0.10.0 and this repo is on 0.3.0 (the bump and
 * the CI wiring both live on the unmerged `chore/gate-machine-routes` branch).
 * So this test stands in until that lands: same assertion, no new dependency.
 *
 * It reads the middleware SOURCE rather than importing it, because importing
 * `src/middleware.ts` pulls in `next/server` and a Supabase client, neither of
 * which will initialise in a bare test runner.
 *
 * Run: npm run test:hr
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const MIDDLEWARE = join(REPO_ROOT, "src/lib/supabase/middleware.ts");

/** Every route file carrying the `@machine-callable` marker. */
function findMarkedRoutes(dir: string, found: string[] = []): string[] {
  const abs = join(REPO_ROOT, dir);
  for (const entry of readdirSync(abs)) {
    const rel = join(dir, entry);
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) {
      findMarkedRoutes(rel, found);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      const source = readFileSync(join(REPO_ROOT, rel), "utf8");
      if (source.includes("@machine-callable")) {
        found.push(rel.replace(/\\/g, "/"));
      }
    }
  }
  return found;
}

/** The prefixes the middleware redirects to /login when there is no session. */
function protectedPrefixes(): string[] {
  const source = readFileSync(MIDDLEWARE, "utf8");
  const block = source.match(/const PROTECTED_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(block, "could not locate PROTECTED_PREFIXES in the middleware");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** `src/app/api/hr/cron/holiday-notice/route.ts` -> `/api/hr/cron/holiday-notice` */
function routePathFor(file: string): string {
  return (
    "/" +
    file
      .replace(/^src\/app\//, "")
      .replace(/\/route\.tsx?$/, "")
      // Route groups like (app) are organisational and not part of the URL.
      .replace(/\((?:[^)]+)\)\//g, "")
  );
}

describe("machine-callable routes", () => {
  test("at least one route is marked, so this test is not vacuous", () => {
    // A guard that silently asserts nothing is worse than no guard: it reports
    // green while covering an empty set.
    const marked = findMarkedRoutes("src/app");
    assert.ok(
      marked.length > 0,
      "no route carries @machine-callable — either the marker was dropped or this test needs deleting"
    );
  });

  test("no marked route is captured by the middleware's protected prefixes", () => {
    const marked = findMarkedRoutes("src/app");
    const prefixes = protectedPrefixes();

    for (const file of marked) {
      const path = routePathFor(file);
      for (const prefix of prefixes) {
        assert.ok(
          !path.startsWith(prefix),
          `${path} is machine-callable but starts with the protected prefix "${prefix}". ` +
            `It will be redirected to /login and the job will silently never run. ` +
            `Either move the route or exclude it in ${MIDDLEWARE}.`
        );
      }
    }
  });

  test("the HR holiday cron is marked and reachable", () => {
    // Named explicitly rather than left to the sweep above: it is the route
    // this guard was written for, and a rename that dropped the marker would
    // otherwise pass by covering nothing.
    const marked = findMarkedRoutes("src/app");
    assert.ok(
      marked.some((f) => f.includes("api/hr/cron/holiday-notice")),
      "the HR holiday-notice cron route is missing its @machine-callable marker"
    );
  });

  test("every marked route is listed in vercel.json crons", () => {
    // A scheduled route nobody scheduled is the same silent nothing, reached by
    // a different path.
    const vercel = JSON.parse(readFileSync(join(REPO_ROOT, "vercel.json"), "utf8")) as {
      crons?: Array<{ path: string }>;
    };
    const scheduled = new Set((vercel.crons ?? []).map((c) => c.path));

    for (const file of findMarkedRoutes("src/app")) {
      const path = routePathFor(file);
      assert.ok(
        scheduled.has(path),
        `${path} is marked @machine-callable but has no entry in vercel.json crons`
      );
    }
  });
});
