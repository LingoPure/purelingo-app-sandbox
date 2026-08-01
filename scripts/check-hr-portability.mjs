#!/usr/bin/env node
/**
 * HR module portability check. Issue #4 acceptance criteria 8 and 9.
 *
 * The HR module is built in this repo as a sandbox and is designed to be lifted
 * into LingoPure's own repo. Two properties make that lift mechanical instead of
 * archaeological, and both degrade silently under normal development:
 *
 *   1. Only `src/lib/hr/deps.ts` may import from outside the module. Every other
 *      HR file goes through that seam, so handover means rewriting ONE file.
 *
 *   2. No `hr_*` table may foreign-key to a non-`hr_*` table, except `auth.users`.
 *      One stray FK to `students` or `employers` and the schema cannot be
 *      transplanted without dragging LingoPure's domain along with it.
 *
 * "We'll be careful" does not hold across sessions. A grep does.
 *
 * Usage:  node scripts/check-hr-portability.mjs
 * Exit:   0 clean, 1 violation, 2 harness error.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
const MODULE_DIRS = ["src/lib/hr", "src/app/hr"];
const SEAM = "src/lib/hr/deps.ts";
const MIGRATIONS_DIR = "supabase/migrations";

/** Non-`hr_` tables an HR table is allowed to reference. */
const FK_ALLOWLIST = new Set(["auth.users"]);

const violations = [];

function walk(dir) {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(join(dir, entry)));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      out.push(join(dir, entry));
    }
  }
  return out;
}

// ── Check 1: only the seam imports outward ───────────────────────────────────
//
// Matches `from "@/..."` and `import("@/...")`. Relative imports that climb out
// of the module (`../../lib/supabase`) are caught too — they are the same
// violation wearing a different syntax.
const OUTWARD_ALIAS = /(?:from|import)\s*\(?\s*["'](@\/[^"']+)["']/g;
const OUTWARD_RELATIVE = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']*)["']/g;

function importEscapesModule(specifier, fromFile) {
  if (specifier.startsWith("@/")) {
    // `@/lib/hr/...` is internal; anything else leaves the module.
    return !specifier.startsWith("@/lib/hr") && !specifier.startsWith("@/app/hr");
  }
  // Resolve the relative path and see whether it lands inside a module dir.
  const fromDir = join(REPO_ROOT, fromFile, "..");
  const resolved = relative(REPO_ROOT, join(fromDir, specifier)).replace(/\\/g, "/");
  return !MODULE_DIRS.some((d) => resolved.startsWith(d));
}

const moduleFiles = MODULE_DIRS.flatMap(walk).map((p) => p.replace(/\\/g, "/"));

for (const file of moduleFiles) {
  if (file === SEAM) continue;
  const source = readFileSync(join(REPO_ROOT, file), "utf8");
  const lines = source.split("\n");

  for (const pattern of [OUTWARD_ALIAS, OUTWARD_RELATIVE]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const specifier = match[1];
      if (!importEscapesModule(specifier, file)) continue;
      const lineNo = source.slice(0, match.index).split("\n").length;
      violations.push(
        `${file}:${lineNo}  imports "${specifier}" from outside the HR module.\n` +
          `    ${lines[lineNo - 1]?.trim() ?? ""}\n` +
          `    Fix: re-export it from ${SEAM} and import from there.`
      );
    }
  }
}

// ── Check 2: no FK out of the hr_ namespace ──────────────────────────────────
const FK_PATTERN = /references\s+(?:public\.)?([a-z_][a-z0-9_]*(?:\.[a-z0-9_]+)?)\s*\(/gi;

const hrMigrations = existsSync(join(REPO_ROOT, MIGRATIONS_DIR))
  ? readdirSync(join(REPO_ROOT, MIGRATIONS_DIR)).filter((f) => /_hr_\d+_/.test(f))
  : [];

if (hrMigrations.length === 0) {
  console.warn(
    `warn: no *_hr_NN_*.sql migrations found in ${MIGRATIONS_DIR} — FK check asserted nothing.`
  );
}

for (const file of hrMigrations) {
  const path = join(MIGRATIONS_DIR, file);
  const source = readFileSync(join(REPO_ROOT, path), "utf8");
  // Strip line comments so the prose in the header cannot trip the pattern.
  const sql = source.replace(/^\s*--.*$/gm, "");
  FK_PATTERN.lastIndex = 0;
  let match;
  while ((match = FK_PATTERN.exec(sql)) !== null) {
    const target = match[1].toLowerCase();
    if (target.startsWith("hr_") || FK_ALLOWLIST.has(target)) continue;
    const lineNo = sql.slice(0, match.index).split("\n").length;
    violations.push(
      `${path}:~${lineNo}  hr_ table references "${target}", which is outside the ` +
        `hr_ namespace and not in the allowlist (${[...FK_ALLOWLIST].join(", ")}).\n` +
        `    A foreign key into LingoPure's domain makes the schema untransplantable.`
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  console.error(
    `\nHR portability check FAILED — ${violations.length} violation(s):\n`
  );
  for (const v of violations) console.error(`  ${v}\n`);
  console.error(
    "The HR module must lift into another repo by rewriting only " +
      `${SEAM}. See docs/HR_MODULE_SPEC.md section A3.\n`
  );
  process.exit(1);
}

console.log(
  `HR portability check passed — ${moduleFiles.length} module file(s), ` +
    `${hrMigrations.length} migration(s), 0 violations.`
);
