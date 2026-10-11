#!/usr/bin/env node
/**
 * Content-claims guard (Patch 02 §1).
 *
 * Do NOT generate product claims. This fails CI if a fabricated / disallowed
 * product term appears in USER-FACING content. Internal code (table names,
 * comments, domain types like CohortStudent) is out of scope — only the
 * marketing/content surfaces below are scanned.
 *
 * The forbidden-term list and the approved-product-noun list are shared
 * with src/lib/whiteboard/validate.ts (the lab-whiteboard content lint) via
 * ./content-claims-rules.mjs — a human adds to either list there, never the
 * model, and never by duplicating it into a second file.
 *
 * Run: node scripts/check-content-claims.mjs   (wired as `npm run check:content`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { FORBIDDEN_CLAIM_TERMS } from "./content-claims-rules.mjs";

// Fabricated / unsupported claims + editorial-leak phrases that must never ship.
const FORBIDDEN = FORBIDDEN_CLAIM_TERMS;

// User-facing content roots only.
const ROOTS = [
  "src/content",
  "src/app/(marketing)",
  "src/app/demo",
  "src/app/about",
  "src/app/pricing",
  "src/components/quick-walkthrough", // feeds both /demo and the homepage preview
];

function walk(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files = files.concat(walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) files.push(p);
  }
  return files;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const term of FORBIDDEN) {
      if (text.includes(term)) {
        violations.push({ file, term });
      }
    }
  }
}

if (violations.length) {
  console.error("✗ Fabricated / disallowed product claims found in content:\n");
  for (const v of violations) console.error(`  ${v.file}  →  "${v.term}"`);
  console.error(
    "\nDo not generate product claims. Remove the term, or (if it is a real, " +
      "approved product noun) add it to the approved list in this script — a human, not the model."
  );
  process.exit(1);
}

console.log("✓ No fabricated product claims in user-facing content.");
