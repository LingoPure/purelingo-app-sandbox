/**
 * Whiteboard lesson script — the single source of truth for the shape.
 * Everything else (validator, layout engine, player, renderer, Phase 2
 * generator) imports its types from here. Do not redeclare any of this
 * shape elsewhere.
 *
 * `lp18Sublevel` and `taxonomyRefs` are typed against the REAL taxonomy
 * (`@/lib/scoring/rubric`) rather than an invented ID space — there is no
 * separate "taxonomy" table in the database; the taxonomy is the `skill`
 * CHECK-constraint enum already enforced on `gap_scores`/`role_baselines`,
 * and the 18-sublevel ladder already defined in rubric.ts. A `TBD` sentinel
 * is allowed for `lp18Sublevel` because Phase 1's static lesson has no
 * measured score to map to (see content/lessons/repair-reformulation.json).
 */
import { z } from "zod";
import { LP18_BANDS, SKILL_KEYS, SUPPORTING_SKILL_KEYS } from "@/lib/scoring/rubric";

export const LP18_SUBLEVEL_TBD = "LP18_SUBLEVEL_TBD" as const;

/** Every scored dimension — the only valid values for `taxonomyRefs`. */
export const TAXONOMY_SKILL_KEYS = [...SKILL_KEYS, ...SUPPORTING_SKILL_KEYS] as const;

const Lp18SublevelSchema = z.union([
  z.literal(LP18_SUBLEVEL_TBD),
  z.enum(LP18_BANDS),
]);

const TaxonomyRefSchema = z.enum(TAXONOMY_SKILL_KEYS);

export const SpanSchema = z.object({
  text: z.string().min(1),
  bold: z.boolean().optional(),
});
export type Span = z.infer<typeof SpanSchema>;

const IdSchema = z.string().min(1);

const HeadingAction = z.object({
  type: z.literal("heading"),
  id: IdSchema,
  text: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2)]),
});

const TextBlockAction = z.object({
  type: z.literal("text_block"),
  id: IdSchema,
  spans: z.array(SpanSchema).min(1),
});

const DefinitionListAction = z.object({
  type: z.literal("definition_list"),
  id: IdSchema,
  title: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
      })
    )
    .min(1),
});

const TableAction = z.object({
  type: z.literal("table"),
  id: IdSchema,
  title: z.string().min(1).optional(),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

const ContrastAction = z.object({
  type: z.literal("contrast"),
  id: IdSchema,
  leftLabel: z.string().min(1),
  left: z.string().min(1),
  rightLabel: z.string().min(1),
  right: z.string().min(1),
});

const PhraseBankAction = z.object({
  type: z.literal("phrase_bank"),
  id: IdSchema,
  title: z.string().min(1),
  phrases: z.array(z.string().min(1)).min(1),
});

const SourceEmbedAction = z.object({
  type: z.literal("source_embed"),
  id: IdSchema,
  sourceId: z.string().min(1),
});

const HighlightAction = z.object({
  type: z.literal("highlight"),
  targetId: IdSchema,
  match: z.string().min(1),
});

const CircleAction = z.object({
  type: z.literal("circle"),
  targetId: IdSchema,
  match: z.string().min(1),
});

const QuickCheckAction = z.object({
  type: z.literal("quick_check"),
  id: IdSchema,
  prompt: z.string().min(1),
  mode: z.enum(["choice", "free_text", "spoken"]),
  options: z.array(z.string().min(1)).optional(),
});

/** Block-creating actions — each introduces one addressable board block. */
export const BlockActionSchema = z.discriminatedUnion("type", [
  HeadingAction,
  TextBlockAction,
  DefinitionListAction,
  TableAction,
  ContrastAction,
  PhraseBankAction,
  SourceEmbedAction,
  QuickCheckAction,
]);
export type BlockAction = z.infer<typeof BlockActionSchema>;

/** Mark actions — reference an existing block, never create one. */
export const MarkActionSchema = z.discriminatedUnion("type", [
  HighlightAction,
  CircleAction,
]);
export type MarkAction = z.infer<typeof MarkActionSchema>;

export const BoardActionSchema = z.union([BlockActionSchema, MarkActionSchema]);
export type BoardAction = z.infer<typeof BoardActionSchema>;

/** Block types that `highlight`/`circle` may target in Phase 1 (see layout.ts). */
export const HIGHLIGHTABLE_BLOCK_TYPES = ["text_block"] as const;

export const StepSchema = z.object({
  id: IdSchema,
  narration: z.string().min(1),
  actions: z.array(BoardActionSchema).min(1),
});
export type Step = z.infer<typeof StepSchema>;

export const ProvenanceSchema = z.object({
  source: z.enum(["static", "generated"]),
  model: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  schemaVersion: z.string().min(1),
  generatedAt: z.string().min(1).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const LessonScriptSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  lp18Sublevel: Lp18SublevelSchema,
  taxonomyRefs: z.array(TaxonomyRefSchema),
  provenance: ProvenanceSchema,
  steps: z.array(StepSchema).min(1),
});
export type LessonScript = z.infer<typeof LessonScriptSchema>;

/** Current schema version. Bump on any shape change (goes in `provenance.schemaVersion`). */
export const WHITEBOARD_SCHEMA_VERSION = "1.0.0";

export function isBlockAction(action: BoardAction): action is BlockAction {
  return action.type !== "highlight" && action.type !== "circle";
}

export function isMarkAction(action: BoardAction): action is MarkAction {
  return action.type === "highlight" || action.type === "circle";
}
