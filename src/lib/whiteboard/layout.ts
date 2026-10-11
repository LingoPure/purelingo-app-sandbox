/**
 * Deterministic column-flow layout engine.
 *
 * Pure function: the same script + the same `measureText` function always
 * produces the same positions — no randomness, no DOM access, no clock.
 * `measureText` is injected so this module has no browser dependency and is
 * unit-testable with a fixed, synthetic measurer (see
 * tests/whiteboard/layout.test.ts). The real app supplies a canvas-based
 * measurer (see components/whiteboard/Board.tsx).
 *
 * Column flow, like a teacher filling a whiteboard: blocks stack top-to-
 * bottom in the current column; when the next block would exceed the board
 * height, move to a new column. Layout is computed from the FULL script up
 * front, so blocks never move once a lesson starts playing — the player
 * only ever reveals/hides what's already placed.
 *
 * Highlight/circle geometry is computed here too (not at render time) so
 * zoom is purely a viewBox scale in Board.tsx — the same logical rectangle
 * lands exactly on the matched span at 50%, 100% and 150% zoom.
 *
 * Phase 1 scope: highlight/circle may only target a `text_block` (see
 * schema.ts HIGHLIGHTABLE_BLOCK_TYPES), and `match` must be word-aligned —
 * both enforced by the validator, assumed true here.
 */
import type { BlockAction, LessonScript, MarkAction, Span } from "@/lib/whiteboard/schema";
import { isBlockAction, isMarkAction } from "@/lib/whiteboard/schema";
import { flatTextOf } from "@/lib/whiteboard/validate";

export type MeasureText = (text: string, opts?: { bold?: boolean }) => number;

export type LayoutOptions = {
  measureText: MeasureText;
  columnWidth?: number;
  gutter?: number;
  topMargin?: number;
  sideMargin?: number;
  boardHeight?: number;
  blockGap?: number;
  blockPadding?: number;
  fontSizePx?: number;
  lineHeightPx?: number;
};

type ResolvedOptions = Required<LayoutOptions>;

/** Exported so rendering components (e.g. TextBlock) use the exact same
 *  padding the layout engine assumed when it computed positions/heights —
 *  a single source of truth, never a second hardcoded "12". */
export const BLOCK_PADDING = 12;

const DEFAULTS: Omit<ResolvedOptions, "measureText"> = {
  columnWidth: 300,
  gutter: 28,
  topMargin: 40,
  sideMargin: 40,
  boardHeight: 640,
  blockGap: 16,
  blockPadding: BLOCK_PADDING,
  fontSizePx: 18,
  lineHeightPx: 26,
};

export type WordPlacement = { text: string; bold: boolean; x: number; width: number; line: number };

export type TextBlockPlan = {
  lines: WordPlacement[][];
  lineHeight: number;
};

export type BlockLayout = {
  id: string;
  type: BlockAction["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  /** Only populated for `text_block` — consumed for mark geometry + rendering. */
  textPlan?: TextBlockPlan;
};

export type MarkRect = { x: number; y: number; width: number; height: number };

export type MarkLayout = {
  targetId: string;
  type: MarkAction["type"];
  stepId: string;
  rects: MarkRect[];
};

export type LessonLayout = {
  blocks: Record<string, BlockLayout>;
  marks: MarkLayout[];
  boardWidth: number;
  boardHeight: number;
  columns: number;
};

type WordToken = { text: string; bold: boolean; width: number };

function tokenize(spans: Span[], measure: MeasureText): WordToken[] {
  const words: WordToken[] = [];
  for (const span of spans) {
    for (const text of span.text.split(/\s+/).filter(Boolean)) {
      words.push({ text, bold: !!span.bold, width: measure(text, { bold: !!span.bold }) });
    }
  }
  return words;
}

/** Wraps already-tokenized words into lines of at most `maxWidth`. Always
 *  places at least one word per line, even if it alone exceeds maxWidth
 *  (never produces an empty line, never drops a word). */
function wrapWords(
  words: WordToken[],
  maxWidth: number,
  spaceWidth: number
): WordPlacement[][] {
  const lines: WordPlacement[][] = [];
  let current: WordPlacement[] = [];
  let x = 0;

  for (const word of words) {
    const gap = current.length === 0 ? 0 : spaceWidth;
    const nextX = x + gap;
    if (current.length > 0 && nextX + word.width > maxWidth) {
      lines.push(current);
      current = [{ text: word.text, bold: word.bold, x: 0, width: word.width, line: lines.length }];
      x = word.width;
    } else {
      current.push({ text: word.text, bold: word.bold, x: nextX, width: word.width, line: lines.length });
      x = nextX + word.width;
    }
  }
  if (current.length) lines.push(current);
  if (lines.length === 0) lines.push([]);
  return lines.map((line, i) => line.map((w) => ({ ...w, line: i })));
}

function wrapPlainText(text: string, maxWidth: number, measure: MeasureText): string[] {
  const words = text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, bold: false, width: measure(t) }));
  const spaceWidth = measure(" ");
  const lines = wrapWords(words, maxWidth, spaceWidth);
  return lines.map((line) => line.map((w) => w.text).join(" "));
}

function buildTextBlockPlan(
  spans: Span[],
  contentWidth: number,
  measure: MeasureText,
  lineHeight: number
): TextBlockPlan {
  const words = tokenize(spans, measure);
  const spaceWidth = measure(" ");
  const lines = wrapWords(words, contentWidth, spaceWidth);
  return { lines, lineHeight };
}

/** Character-offset span of each word in the plan's flattened word list,
 *  consistent with `flatTextOf()` (spans joined by single spaces) — used to
 *  map a validated `match` substring onto specific words for mark geometry. */
function wordCharOffsets(plan: TextBlockPlan): { start: number; end: number }[] {
  const offsets: { start: number; end: number }[] = [];
  let pos = 0;
  let first = true;
  for (const line of plan.lines) {
    for (const word of line) {
      if (!first) pos += 1; // the joining space in flatTextOf
      offsets.push({ start: pos, end: pos + word.text.length });
      pos += word.text.length;
      first = false;
    }
  }
  return offsets;
}

function estimateHeight(
  action: BlockAction,
  contentWidth: number,
  opts: ResolvedOptions,
  getSource: (sourceId: string) => { excerpt: string; title: string; publisher: string } | null
): { height: number; textPlan?: TextBlockPlan } {
  const pad = opts.blockPadding * 2;
  const lh = opts.lineHeightPx;

  switch (action.type) {
    case "heading": {
      const headingLineHeight = action.level === 1 ? lh * 1.4 : lh * 1.15;
      const lines = wrapPlainText(action.text, contentWidth, opts.measureText);
      return { height: lines.length * headingLineHeight + pad };
    }
    case "text_block": {
      const plan = buildTextBlockPlan(action.spans, contentWidth, opts.measureText, lh);
      return { height: plan.lines.length * lh + pad, textPlan: plan };
    }
    case "definition_list": {
      let height = pad + (action.title ? lh * 1.2 : 0);
      for (const item of action.items) {
        const lines = wrapPlainText(`${item.term}: ${item.definition}`, contentWidth, opts.measureText);
        height += lines.length * lh + 6;
      }
      return { height };
    }
    case "table": {
      const colWidth = contentWidth / Math.max(1, action.columns.length);
      let height = pad + (action.title ? lh * 1.2 : 0);
      height += wrapPlainText(action.columns.join(" / "), contentWidth, opts.measureText).length * lh + 8;
      for (const row of action.rows) {
        const rowLines = Math.max(
          1,
          ...row.map((cell) => wrapPlainText(cell, colWidth, opts.measureText).length)
        );
        height += rowLines * lh + 10;
      }
      return { height };
    }
    case "contrast": {
      const half = (contentWidth - 20) / 2;
      const leftLines = wrapPlainText(action.left, half, opts.measureText).length;
      const rightLines = wrapPlainText(action.right, half, opts.measureText).length;
      return { height: pad + lh * 1.2 + Math.max(leftLines, rightLines) * lh };
    }
    case "phrase_bank": {
      let height = pad + lh * 1.2;
      for (const phrase of action.phrases) {
        height += wrapPlainText(phrase, contentWidth - 16, opts.measureText).length * lh + 6;
      }
      return { height };
    }
    case "source_embed": {
      const source = getSource(action.sourceId);
      const pending = !source || source.excerpt === "__HUMAN_ENTRY_REQUIRED__";
      if (pending) return { height: 130 };
      const lines = wrapPlainText(source.excerpt, contentWidth, opts.measureText).length;
      return { height: pad + lh * 1.2 + lines * lh + lh };
    }
    case "quick_check": {
      const lines = wrapPlainText(action.prompt, contentWidth, opts.measureText).length;
      return { height: pad + lh + lines * lh + 36 };
    }
  }
}

export function computeLayout(
  script: LessonScript,
  options: LayoutOptions,
  getSource: (sourceId: string) => { excerpt: string; title: string; publisher: string } | null = () => null
): LessonLayout {
  const opts: ResolvedOptions = { ...DEFAULTS, ...options };
  const contentWidth = opts.columnWidth - opts.blockPadding * 2;

  const blocks: Record<string, BlockLayout> = {};
  let column = 0;
  let y = opts.topMargin;
  let maxColumn = 0;

  for (const step of script.steps) {
    for (const action of step.actions) {
      if (!isBlockAction(action)) continue;
      const { height, textPlan } = estimateHeight(action, contentWidth, opts, getSource);

      if (y > opts.topMargin && y + height > opts.boardHeight) {
        column += 1;
        y = opts.topMargin;
      }
      maxColumn = Math.max(maxColumn, column);

      blocks[action.id] = {
        id: action.id,
        type: action.type,
        x: opts.sideMargin + column * (opts.columnWidth + opts.gutter),
        y,
        width: opts.columnWidth,
        height,
        column,
        textPlan,
      };
      y += height + opts.blockGap;
    }
  }

  const columns = maxColumn + 1;
  const boardWidth =
    opts.sideMargin * 2 + columns * opts.columnWidth + (columns - 1) * opts.gutter;

  const marks: MarkLayout[] = [];
  for (const step of script.steps) {
    for (const action of step.actions) {
      if (!isMarkAction(action)) continue;
      const target = blocks[action.targetId];
      if (!target?.textPlan) continue;

      const flat = findFlatText(script, action.targetId);
      if (flat == null) continue;
      const start = flat.indexOf(action.match);
      if (start === -1) continue;
      const end = start + action.match.length;

      const offsets = wordCharOffsets(target.textPlan);
      const flatWords = target.textPlan.lines.flat();
      const overlapping = flatWords.filter(
        (_, i) => offsets[i].end > start && offsets[i].start < end
      );
      if (overlapping.length === 0) continue;

      const byLine = new Map<number, WordPlacement[]>();
      for (const w of overlapping) {
        byLine.set(w.line, [...(byLine.get(w.line) ?? []), w]);
      }

      const pad = opts.blockPadding;
      const rects: MarkRect[] = [...byLine.entries()].map(([lineIdx, words]) => {
        const minX = Math.min(...words.map((w) => w.x));
        const maxX = Math.max(...words.map((w) => w.x + w.width));
        return {
          x: target.x + pad + minX,
          y: target.y + pad + lineIdx * target.textPlan!.lineHeight,
          width: maxX - minX,
          height: target.textPlan!.lineHeight,
        };
      });

      marks.push({ targetId: action.targetId, type: action.type, stepId: step.id, rects });
    }
  }

  return { blocks, marks, boardWidth, boardHeight: opts.boardHeight, columns };
}

function findFlatText(script: LessonScript, blockId: string): string | null {
  for (const step of script.steps) {
    for (const action of step.actions) {
      if (isBlockAction(action) && action.id === blockId) {
        return flatTextOf(action);
      }
    }
  }
  return null;
}

export { wrapPlainText };
