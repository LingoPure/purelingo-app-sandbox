/**
 * Role-specific Phase 0b battery prompt seeder.
 *
 * Reads a role's name + description + role.profile_json (the rich
 * context produced by the role-discovery flow), then asks Claude to
 * author a pair of equivalent-difficulty prompts for each of the four
 * task types, calibrated to that role. Inserts them into
 * discovery_task_prompts with role_id set so the battery page picks
 * them up over the generic 0017 fallbacks for students assigned to
 * this role.
 *
 * Usage:
 *   npx tsx scripts/seed-role-battery-prompts.ts --role-id <uuid>
 *   npx tsx scripts/seed-role-battery-prompts.ts --role-name "Senior Account Manager"
 *   npx tsx scripts/seed-role-battery-prompts.ts --all   # every non-archived role in the DB
 *
 * Optional:
 *   --band B2|C1|...   (default: B2)
 *   --dry-run          (print what would be inserted, write nothing)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 *      ANTHROPIC_API_KEY.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const MODEL = "claude-sonnet-4-6";
type TaskType =
  | "email_writing"
  | "listen_paraphrase"
  | "read_summarise"
  | "vocab_cloze";
const ALL_BANDS = ["A2", "B1", "B2", "C1", "C2"] as const;
type Band = (typeof ALL_BANDS)[number];

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const out: {
    roleId?: string;
    roleName?: string;
    all?: boolean;
    band: Band;
    dryRun: boolean;
  } = { band: "B2", dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--role-id") out.roleId = args[++i];
    else if (a === "--role-name") out.roleName = args[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--band") {
      const v = args[++i];
      if (!(ALL_BANDS as readonly string[]).includes(v)) {
        throw new Error(`--band must be one of ${ALL_BANDS.join(", ")}`);
      }
      out.band = v as Band;
    } else if (a === "--dry-run") out.dryRun = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!out.roleId && !out.roleName && !out.all) {
    throw new Error(
      "Pass --role-id <uuid>, --role-name <substring>, or --all."
    );
  }
  return out;
}

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function anthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

// ─── Role lookup ─────────────────────────────────────────────────────────────

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  profile_json: unknown;
  employer_id: string | null;
};

async function findRoles(opts: {
  roleId?: string;
  roleName?: string;
  all?: boolean;
}) {
  const sb = adminSupabase();
  if (opts.roleId) {
    const { data, error } = await sb
      .from("roles")
      .select("id, name, description, profile_json, employer_id")
      .eq("id", opts.roleId)
      .maybeSingle();
    if (error) throw new Error(`role lookup failed: ${error.message}`);
    if (!data) throw new Error(`No role with id ${opts.roleId}`);
    return [data as RoleRow];
  }
  if (opts.roleName) {
    const { data, error } = await sb
      .from("roles")
      .select("id, name, description, profile_json, employer_id")
      .ilike("name", `%${opts.roleName}%`)
      .eq("is_archived", false);
    if (error) throw new Error(`role lookup failed: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error(`No role matching name ${JSON.stringify(opts.roleName)}`);
    }
    return data as RoleRow[];
  }
  // --all
  const { data, error } = await sb
    .from("roles")
    .select("id, name, description, profile_json, employer_id")
    .eq("is_archived", false);
  if (error) throw new Error(`role lookup failed: ${error.message}`);
  return (data ?? []) as RoleRow[];
}

// ─── Claude prompt schemas (mirror src/lib/onboarding/battery/types.ts) ──────

const EmailWritingPair = z.object({
  prompts: z
    .array(
      z.object({
        scenario: z
          .string()
          .min(60)
          .describe(
            "Role-specific business situation, 2-4 sentences. Names a counterparty, the ask, and the constraint."
          ),
        persona: z.string().min(20),
        target_word_count: z.object({
          min: z.number().int().min(80).max(180),
          max: z.number().int().min(150).max(280),
        }),
        instructions: z.string().min(20),
        rubric_anchors: z.object({
          register_tone: z.string().min(40),
          structural_integrity: z.string().min(40),
          strategic_content: z.string().min(40),
          lexical_range: z.string().min(40),
        }),
      })
    )
    .length(2),
});

const ListenParaphrasePair = z.object({
  prompts: z
    .array(
      z.object({
        instructions: z.string().min(20),
        plays_allowed: z.number().int().min(1).max(2),
        transcript: z
          .string()
          .min(150)
          .max(900)
          .describe(
            "30-45 seconds of natural spoken business English: voicemail or brief call segment from a colleague."
          ),
        key_points: z.array(z.string().min(20)).length(3),
      })
    )
    .length(2),
});

const ReadSummarisePair = z.object({
  prompts: z
    .array(
      z.object({
        instructions: z.string().min(20),
        body: z
          .string()
          .min(400)
          .max(2000)
          .describe(
            "200-300 word business email or memo with a surface ask AND buried subtext. Use indirect/hedge language so the subtext requires inference."
          ),
        surface_ask: z.string().min(20),
        subtext: z.string().min(40),
        expected_summary_outline: z.string().min(40),
      })
    )
    .length(2),
});

const VocabClozeItem = z.object({
  id: z.string().min(2),
  stem: z.string().min(20),
  options: z.array(z.string().min(2)).length(4),
  correct: z.string().min(2),
  difficulty_weight: z.number().min(0.5).max(1.6),
  rationale: z.string().min(40),
});

const VocabClozePair = z.object({
  prompts: z
    .array(
      z.object({
        instructions: z.string().min(20),
        items: z.array(VocabClozeItem).length(8),
      })
    )
    .length(2),
});

// ─── Generators ──────────────────────────────────────────────────────────────

function roleContextBlock(role: RoleRow): string {
  return [
    `Role name: ${role.name}`,
    role.description ? `Role description: ${role.description}` : null,
    role.profile_json
      ? `Role profile (rich context — responsibilities, vocabulary domain, day-to-day tasks):\n${JSON.stringify(role.profile_json, null, 2)}`
      : "Role profile: (none on file — generate plausible mid-career B2B context.)",
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}

const COMMON_RULES = `
LingoPure is a B2B Vietnamese / Southeast Asian business-English upskilling
platform. The student you are calibrating for works in a real role and needs
this English capability tested directly. Keep all prompts grounded in
plausible day-to-day situations for the role.

The two prompts in your output MUST be equivalent in difficulty so that
attempt 1 vs attempt 2 (re-test, ~6 weeks later) produces a comparable
score delta. Different content, same difficulty band.

Avoid stereotypes. Avoid sensitive topics (no medical, no political, no
personal-finance details).

Output ONLY the JSON object that matches the provided schema.
`;

async function generateEmailWritingPair(role: RoleRow, band: Band) {
  const sys =
    "You are LingoPure's role-aware prompt author. Generate two equivalent-difficulty email-writing prompts for a battery assessment.\n" +
    COMMON_RULES;
  const user = [
    `Difficulty band: ${band}`,
    "",
    roleContextBlock(role),
    "",
    "For each prompt, produce:",
    "- scenario: the situation (counterparty, the ask, the constraint)",
    "- persona: who the student plays in the email",
    "- target_word_count: { min, max }, between 100 and 250 words total range",
    "- instructions: brief tasking text the student sees",
    "- rubric_anchors: four short paragraphs (register_tone, structural_integrity, strategic_content, lexical_range) calibrated to ${band}. Each anchor is the rubric the scorer reads.",
    "",
    "The two scenarios must come from different angles of the role (e.g. one client-facing, one internal; one negotiation, one coordination).",
  ].join("\n");

  const r = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 3500,
    temperature: 0.6,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(EmailWritingPair) },
  });
  if (!r.parsed_output) throw new Error("email_writing: no parsed output");
  return r.parsed_output.prompts;
}

async function generateListenParaphrasePair(role: RoleRow, band: Band) {
  const sys =
    "You are LingoPure's role-aware prompt author. Generate two equivalent-difficulty listen-and-paraphrase prompts.\n" +
    COMMON_RULES;
  const user = [
    `Difficulty band: ${band}`,
    "",
    roleContextBlock(role),
    "",
    "For each prompt, produce:",
    "- instructions: the student's tasking",
    "- plays_allowed: 1 (default) or 2 if the band is A2/B1",
    "- transcript: 30-45 seconds of natural spoken English from a colleague — voicemail or short call segment. THREE distinct key points should be present, including ONE explicit action item with a deadline.",
    "- key_points: array of exactly 3 strings, each restating one key point clearly (these are what the scorer compares the student's answer against).",
    "",
    "The transcript MUST sound like real workplace speech — natural hesitation OK, but no filler-word overload. Use the role's industry vocabulary.",
  ].join("\n");

  const r = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 3500,
    temperature: 0.6,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ListenParaphrasePair) },
  });
  if (!r.parsed_output) throw new Error("listen_paraphrase: no parsed output");
  return r.parsed_output.prompts;
}

async function generateReadSummarisePair(role: RoleRow, band: Band) {
  const sys =
    "You are LingoPure's role-aware prompt author. Generate two equivalent-difficulty read-and-summarise prompts.\n" +
    COMMON_RULES;
  const user = [
    `Difficulty band: ${band}`,
    "",
    roleContextBlock(role),
    "",
    "For each prompt, produce:",
    "- instructions: the student's tasking",
    "- body: a 200-300 word business email or memo. It MUST contain a SURFACE ask (the literal request) AND a BURIED subtext (a second concern only visible if the reader notices indirect/hedge language). Hedge density rises with band.",
    "- surface_ask: one-sentence summary of the literal ask.",
    "- subtext: 1-2 sentences naming the buried question/risk/political dimension.",
    "- expected_summary_outline: what a strong student summary should include.",
    "",
    "Pick scenarios drawn from this role's actual workflow.",
  ].join("\n");

  const r = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.6,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ReadSummarisePair) },
  });
  if (!r.parsed_output) throw new Error("read_summarise: no parsed output");
  return r.parsed_output.prompts;
}

async function generateVocabClozePair(role: RoleRow, band: Band) {
  const sys =
    "You are LingoPure's role-aware prompt author. Generate two equivalent-difficulty vocabulary-at-register prompts (8 cloze items each, MCQ with 4 options).\n" +
    COMMON_RULES;
  const user = [
    `Difficulty band: ${band}`,
    "",
    roleContextBlock(role),
    "",
    "For each prompt, produce:",
    "- instructions: the student's tasking",
    "- items: exactly 8 cloze items. Each item:",
    "    - id: short unique string ('vc1' through 'vc8')",
    "    - stem: a sentence with '____' marking the gap. Use role-specific vocabulary the student would actually encounter.",
    "    - options: array of exactly 4 plausible candidates. Three are wrong-but-close in register/collocation/sense; one is the best B2 business-register fit.",
    "    - correct: the best option (must equal one of the options strings exactly).",
    "    - difficulty_weight: 0.8-1.5; raise for items where the distractors are very close.",
    "    - rationale: 1-2 sentences explaining WHY the correct answer is best vs each distractor (used by the dashboard's evidence panel).",
    "",
    "Items should test register sensitivity, collocation, and idiomatic phrasing — not literal vocabulary recall.",
  ].join("\n");

  const r = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.6,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(VocabClozePair) },
  });
  if (!r.parsed_output) throw new Error("vocab_cloze: no parsed output");
  return r.parsed_output.prompts;
}

// ─── DB write ────────────────────────────────────────────────────────────────

type InsertRow = {
  task_type: TaskType;
  role_id: string;
  difficulty_band: Band;
  variant_bucket: string;
  prompt_public: unknown;
  prompt_private: unknown;
};

function toInsertRows(
  role: RoleRow,
  band: Band,
  taskType: TaskType,
  pair:
    | Awaited<ReturnType<typeof generateEmailWritingPair>>
    | Awaited<ReturnType<typeof generateListenParaphrasePair>>
    | Awaited<ReturnType<typeof generateReadSummarisePair>>
    | Awaited<ReturnType<typeof generateVocabClozePair>>
): InsertRow[] {
  const variantBucket = `${band.toLowerCase()}-${taskType}-${role.id.slice(0, 8)}`;
  return pair.map((p) => {
    if (taskType === "email_writing") {
      const x = p as Awaited<ReturnType<typeof generateEmailWritingPair>>[number];
      return {
        task_type: taskType,
        role_id: role.id,
        difficulty_band: band,
        variant_bucket: variantBucket,
        prompt_public: {
          scenario: x.scenario,
          persona: x.persona,
          target_word_count: x.target_word_count,
          instructions: x.instructions,
        },
        prompt_private: { rubric_anchors: x.rubric_anchors },
      };
    }
    if (taskType === "listen_paraphrase") {
      const x = p as Awaited<ReturnType<typeof generateListenParaphrasePair>>[number];
      return {
        task_type: taskType,
        role_id: role.id,
        difficulty_band: band,
        variant_bucket: variantBucket,
        prompt_public: {
          instructions: x.instructions,
          plays_allowed: x.plays_allowed,
        },
        prompt_private: { transcript: x.transcript, key_points: x.key_points },
      };
    }
    if (taskType === "read_summarise") {
      const x = p as Awaited<ReturnType<typeof generateReadSummarisePair>>[number];
      return {
        task_type: taskType,
        role_id: role.id,
        difficulty_band: band,
        variant_bucket: variantBucket,
        prompt_public: { instructions: x.instructions, body: x.body },
        prompt_private: {
          surface_ask: x.surface_ask,
          subtext: x.subtext,
          expected_summary_outline: x.expected_summary_outline,
        },
      };
    }
    // vocab_cloze
    const x = p as Awaited<ReturnType<typeof generateVocabClozePair>>[number];
    return {
      task_type: taskType,
      role_id: role.id,
      difficulty_band: band,
      variant_bucket: variantBucket,
      prompt_public: {
        instructions: x.instructions,
        items: x.items.map((it) => ({
          id: it.id,
          stem: it.stem,
          options: it.options,
        })),
      },
      prompt_private: {
        items: x.items.map((it) => ({
          id: it.id,
          correct: it.correct,
          difficulty_weight: it.difficulty_weight,
          rationale: it.rationale,
        })),
      },
    };
  });
}

async function seedForRole(role: RoleRow, band: Band, dryRun: boolean) {
  console.log(`\n┌─── ${role.name} (${role.id}) ───`);
  const sb = adminSupabase();
  const allRows: InsertRow[] = [];

  // Generate four pairs in parallel — independent Claude calls.
  const [emails, listens, reads, vocabs] = await Promise.all([
    generateEmailWritingPair(role, band).catch((err) => {
      console.error(`│  email_writing FAILED: ${err.message}`);
      return [];
    }),
    generateListenParaphrasePair(role, band).catch((err) => {
      console.error(`│  listen_paraphrase FAILED: ${err.message}`);
      return [];
    }),
    generateReadSummarisePair(role, band).catch((err) => {
      console.error(`│  read_summarise FAILED: ${err.message}`);
      return [];
    }),
    generateVocabClozePair(role, band).catch((err) => {
      console.error(`│  vocab_cloze FAILED: ${err.message}`);
      return [];
    }),
  ]);

  if (emails.length) allRows.push(...toInsertRows(role, band, "email_writing", emails));
  if (listens.length) allRows.push(...toInsertRows(role, band, "listen_paraphrase", listens));
  if (reads.length) allRows.push(...toInsertRows(role, band, "read_summarise", reads));
  if (vocabs.length) allRows.push(...toInsertRows(role, band, "vocab_cloze", vocabs));

  console.log(`│  Generated ${allRows.length} prompt rows.`);

  if (dryRun) {
    for (const r of allRows) {
      console.log(`│    DRY: ${r.task_type} (${r.variant_bucket})`);
    }
    return { generated: allRows.length, written: 0 };
  }

  if (allRows.length === 0) {
    console.warn(`│  Nothing to write — all generators failed.`);
    return { generated: 0, written: 0 };
  }

  const { error } = await sb.from("discovery_task_prompts").insert(allRows);
  if (error) {
    throw new Error(`insert failed: ${error.message}`);
  }
  console.log(`└── Inserted ${allRows.length} rows for ${role.name}.`);
  return { generated: allRows.length, written: allRows.length };
}

async function main() {
  const opts = parseArgs();
  const roles = await findRoles(opts);
  console.log(
    `Seeding ${roles.length} role(s) at ${opts.band}${opts.dryRun ? " (DRY RUN)" : ""}.`
  );

  let totalGenerated = 0;
  let totalWritten = 0;
  for (const role of roles) {
    try {
      const r = await seedForRole(role, opts.band, opts.dryRun);
      totalGenerated += r.generated;
      totalWritten += r.written;
    } catch (err) {
      console.error(
        `Role ${role.id} (${role.name}) failed: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  console.log(
    `\nDone. Generated ${totalGenerated} prompt rows, wrote ${totalWritten}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
