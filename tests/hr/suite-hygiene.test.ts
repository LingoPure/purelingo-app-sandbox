/**
 * Guards against the test suite lying about its own coverage.
 *
 * WHY. `npm run test:hr` globs `tests/hr/*.test.ts`. The integration suite needs
 * Supabase credentials and an explicit HR_TEST_HARNESS opt-in, so when it was
 * briefly named `integration.test.ts` the unit runner picked it up, its
 * `before()` hook threw, and node reported those 24 tests as CANCELLED —
 * leaving a summary of `pass 54, fail 0` that looked entirely green while a
 * quarter of the suite had not run.
 *
 * That is the same failure the harness itself is written to prevent (missing
 * config fails rather than skips), reached from the other direction: not a
 * suite that skips quietly, but a runner that swallows one whole. Naming is the
 * only thing separating the two globs, and naming is exactly the kind of thing
 * that drifts.
 *
 * Integration suites use `.itest.ts`. Unit suites use `.test.ts`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HR_TESTS = join(process.cwd(), "tests/hr");

describe("test suite hygiene", () => {
  test("no *.test.ts file depends on the integration harness", () => {
    const offenders: string[] = [];

    for (const entry of readdirSync(HR_TESTS)) {
      if (!entry.endsWith(".test.ts")) continue;
      const source = readFileSync(join(HR_TESTS, entry), "utf8");
      // Import of the harness, not a mention of it in a comment.
      if (/from\s+["'].*\/harness["']|from\s+["']\.\/harness["']/.test(source)) {
        offenders.push(entry);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These files need Supabase credentials but match the UNIT glob, so the ` +
        `unit runner will cancel them and still report a green summary. ` +
        `Rename them to *.itest.ts: ${offenders.join(", ")}`
    );
  });

  test("the integration suite exists and is excluded from the unit glob", () => {
    const files = readdirSync(HR_TESTS);
    assert.ok(
      files.some((f) => f.endsWith(".itest.ts")),
      "no *.itest.ts found — the integration suite is missing or was renamed"
    );
    assert.ok(
      !files.includes("integration.test.ts"),
      "integration.test.ts matches the unit glob and will be silently cancelled"
    );
  });
});
