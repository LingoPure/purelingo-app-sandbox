/**
 * Validates a LessonScript against the schema, the structural rules (§4 of
 * the brief), and the content lint (§6). Runs on every script — static
 * lessons at build/load time, generated lessons before they are ever
 * returned to a client. Failing scripts are rejected with a readable error
 * list, never silently fixed or partially rendered.
 */
import {
  LessonScriptSchema,
  HIGHLIGHTABLE_BLOCK_TYPES,
  isBlockAction,
  isMarkAction,
  type LessonScript,
  type BlockAction,
} from "@/lib/whiteboard/schema";
import { isApprovedSourceId } from "@/lib/whiteboard/sources";
import { FORBIDDEN_CLAIM_TERMS, APPROVED_PRODUCT_NOUNS } from "../../../scripts/content-claims-rules.mjs";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const STAT_OR_PERCENT_RE = /\d+(\.\d+)?\s?%/;
const STAT_PHRASE_RE =
  /studies show|research proves|research shows|\b\d+(\.\d+)?\s?x\s+more\b|times more/i;
const CEFR_LEARNER_CLAIM_RE =
  /\byou(?:'re| are)\s+(?:an?\s+)?(A1|A2|B1|B2|C1|C2)\b/i;

/** Approved product nouns are exempt from the forbidden-term scan (they can
 *  legitimately contain substrings that would otherwise look like a stat,
 *  e.g. "LP-18" contains a digit — handled by the regexes above, which only
 *  match digit+% or an explicit comparative phrase, never a bare number). */
const APPROVED_NOUNS_LOWER = new Set(
  APPROVED_PRODUCT_NOUNS.map((n: string) => n.toLowerCase())
);

/** Finds a disallowed product noun: any capitalised-looking product-ish term
 *  that is not on the approved list is out of scope for this prototype's
 *  lint (free-text narration/content isn't scanned for arbitrary nouns —
 *  this only re-checks the SAME forbidden terms the CI content guard uses,
 *  per the brief: "Import that list; do not duplicate it"). */
function findForbiddenTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const term of FORBIDDEN_CLAIM_TERMS as string[]) {
    if (lower.includes(term)) hits.push(term);
  }
  return hits;
}

function findDisallowedProductNoun(text: string): string | null {
  // Conservative check: flag known-disallowed nouns explicitly, rather than
  // guessing at arbitrary capitalised phrases (which would false-positive
  // on proper nouns like "Aria" or "Claude" that aren't product claims).
  for (const term of findForbiddenTerms(text)) {
    if (!APPROVED_NOUNS_LOWER.has(term)) return term;
  }
  return null;
}

function lintText(text: string, where: string, errors: string[]): void {
  if (STAT_OR_PERCENT_RE.test(text) || STAT_PHRASE_RE.test(text)) {
    errors.push(
      `${where}: contains a percentage/statistic claim outside a source_embed — "${text}"`
    );
  }
  const noun = findDisallowedProductNoun(text);
  if (noun) {
    errors.push(`${where}: contains disallowed/fabricated term "${noun}" — "${text}"`);
  }
  if (CEFR_LEARNER_CLAIM_RE.test(text)) {
    errors.push(
      `${where}: makes a CEFR-level claim about the learner with no measured score to support it — "${text}"`
    );
  }
}

/** Plain text a content-lint pass should scan for a given block action. */
function textsOf(action: BlockAction): string[] {
  switch (action.type) {
    case "heading":
      return [action.text];
    case "text_block":
      return action.spans.map((s) => s.text);
    case "definition_list":
      return [
        ...(action.title ? [action.title] : []),
        ...action.items.flatMap((i) => [i.term, i.definition]),
      ];
    case "table":
      return [
        ...(action.title ? [action.title] : []),
        ...action.columns,
        ...action.rows.flat(),
      ];
    case "contrast":
      return [action.leftLabel, action.left, action.rightLabel, action.right];
    case "phrase_bank":
      return [action.title, ...action.phrases];
    case "source_embed":
      return []; // excerpt text comes from the registry, lint there instead.
    case "quick_check":
      return [action.prompt, ...(action.options ?? [])];
  }
}

/** The plain, matchable text of a highlightable block — single source for
 *  both the validator's "match occurs exactly once" check and the layout
 *  engine's geometry (@/lib/whiteboard/layout). Keep these in sync. */
export function flatTextOf(action: BlockAction): string | null {
  if (action.type !== "text_block") return null;
  return action.spans.map((s) => s.text).join(" ");
}

export function validateLessonScript(input: unknown): ValidationResult {
  const parsed = LessonScriptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      ),
    };
  }
  const script = parsed.data;
  const errors: string[] = [];

  errors.push(...validateStructure(script));
  errors.push(...validateContentLint(script));

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateStructure(script: LessonScript): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenStepIds = new Set<string>();
  const blockTypeById = new Map<string, BlockAction["type"]>();

  // Pass 1: collect every block id (ids must be unique across the WHOLE
  // script, not just within a step) and check step-id uniqueness.
  for (const step of script.steps) {
    if (seenStepIds.has(step.id)) {
      errors.push(`step "${step.id}": duplicate step id`);
    }
    seenStepIds.add(step.id);

    for (const action of step.actions) {
      if (!isBlockAction(action)) continue;
      if (seenIds.has(action.id)) {
        errors.push(`step "${step.id}": duplicate id "${action.id}"`);
      }
      seenIds.add(action.id);
      blockTypeById.set(action.id, action.type);
    }
  }

  // Pass 2: quick_check placement, and mark-action (highlight/circle)
  // references — must point at a block introduced in the same or an
  // earlier step, and `match` must occur exactly once in that block's text.
  const introducedBefore = new Set<string>();
  for (const step of script.steps) {
    const quickCheckIndices: number[] = [];

    step.actions.forEach((action, idx) => {
      if (action.type === "quick_check") quickCheckIndices.push(idx);

      if (isMarkAction(action)) {
        if (!introducedBefore.has(action.targetId) && !blockIdIntroducedInStep(step, action.targetId, idx)) {
          errors.push(
            `step "${step.id}": ${action.type} targets "${action.targetId}", which has not been introduced yet`
          );
          return;
        }
        const targetType = blockTypeById.get(action.targetId);
        if (targetType && !(HIGHLIGHTABLE_BLOCK_TYPES as readonly string[]).includes(targetType)) {
          errors.push(
            `step "${step.id}": ${action.type} targets "${action.targetId}" (type "${targetType}"), ` +
              `which is not a highlightable block type in Phase 1 (${HIGHLIGHTABLE_BLOCK_TYPES.join(", ")})`
          );
          return;
        }
        const targetBlock = findBlockById(script, action.targetId);
        if (targetBlock) {
          const flat = flatTextOf(targetBlock);
          if (flat != null) {
            const occurrences = countOccurrences(flat, action.match);
            if (occurrences !== 1) {
              errors.push(
                `step "${step.id}": ${action.type}.match "${action.match}" occurs ${occurrences} times in "${action.targetId}" (must be exactly 1)`
              );
            } else if (!isWordAligned(flat, action.match)) {
              errors.push(
                `step "${step.id}": ${action.type}.match "${action.match}" must start and end on a word boundary in "${action.targetId}"`
              );
            }
          }
        }
      }
    });

    if (quickCheckIndices.length > 1) {
      errors.push(`step "${step.id}": contains more than one quick_check`);
    }
    if (
      quickCheckIndices.length === 1 &&
      quickCheckIndices[0] !== step.actions.length - 1
    ) {
      errors.push(`step "${step.id}": quick_check must be the last action in the step`);
    }

    for (const action of step.actions) {
      if (isBlockAction(action)) introducedBefore.add(action.id);
      if (action.type === "source_embed" && !isApprovedSourceId(action.sourceId)) {
        errors.push(
          `step "${step.id}": source_embed "${action.id}" references unknown sourceId "${action.sourceId}"`
        );
      }
    }
  }

  return errors;
}

function blockIdIntroducedInStep(
  step: LessonScript["steps"][number],
  id: string,
  beforeIdx: number
): boolean {
  return step.actions
    .slice(0, beforeIdx)
    .some((a) => isBlockAction(a) && a.id === id);
}

function findBlockById(script: LessonScript, id: string): BlockAction | null {
  for (const step of script.steps) {
    for (const action of step.actions) {
      if (isBlockAction(action) && action.id === id) return action;
    }
  }
  return null;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + 1);
  }
  return count;
}

/** `match` must start/end on a word boundary — see layout.ts for why
 *  (highlight/circle geometry is computed word-by-word in Phase 1). A word
 *  character here is alphanumeric only (like regex `\w`), so a match may
 *  legitimately sit directly against punctuation — "simply" ending right
 *  before a colon, or a quote mark immediately before "Let" — without
 *  failing alignment; only sitting against another letter/digit fails it. */
function isWordAligned(haystack: string, needle: string): boolean {
  const start = haystack.indexOf(needle);
  if (start === -1) return false;
  const end = start + needle.length;
  const before = haystack[start - 1];
  const after = haystack[end];
  const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);
  return !isWordChar(before) && !isWordChar(after);
}

function validateContentLint(script: LessonScript): string[] {
  const errors: string[] = [];

  lintText(script.title, "title", errors);

  for (const step of script.steps) {
    lintText(step.narration, `step "${step.id}".narration`, errors);

    for (const action of step.actions) {
      if (action.type === "source_embed") continue; // excerpt text is lint-exempt (registry-controlled).
      if (isMarkAction(action)) continue;

      for (const text of textsOf(action)) {
        lintText(text, `step "${step.id}".${action.type}("${action.id}")`, errors);
      }
    }
  }

  return errors;
}
