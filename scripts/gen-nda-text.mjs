// Regenerates src/lib/investor/nda-text.ts from the canonical NDA PDF.
import { PDFParse } from 'pdf-parse';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'docs/LingoPure main documents/Legal/LINGOPURE NDA, NON-COMPETE, NON-CIRCUMVENTION AND INTELLECTUAL PROPERTY PROTECTION AGREEMENT.pdf';
const r = await new PDFParse({ data: readFileSync(SRC) }).getText();
const text = (r.text || '')
  .replace(/\n-- \d+ of \d+ --\n/g, '\n\n')   // drop page markers
  .replace(/\n{3,}/g, '\n\n')
  .trim();
const out = `// AUTO-GENERATED from the canonical LingoPure NDA PDF — do NOT hand-edit.
// Regenerate: node scripts/gen-nda-text.mjs
// Source: docs/LingoPure main documents/Legal/LINGOPURE NDA, NON-COMPETE, NON-CIRCUMVENTION AND INTELLECTUAL PROPERTY PROTECTION AGREEMENT.pdf
//
// Bumping the NDA: replace the source PDF, re-run this generator, and bump
// NDA_VERSION. Acceptances are recorded against the version in force at accept time.

export const NDA_VERSION = "2026-06";
export const NDA_TEXT = ${JSON.stringify(text)};
`;
writeFileSync('src/lib/investor/nda-text.ts', out);
console.log('wrote src/lib/investor/nda-text.ts —', text.length, 'chars');
