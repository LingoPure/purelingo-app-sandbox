/**
 * Report executor: for each requested section, run a tier-filtered retrieval and
 * synthesise the section ONLY from those chunks (degrade-don't-fake: a section
 * with no coverage is marked, never invented). Assembles markdown + the union of
 * cited sources. Sections run in parallel (independent retrievals).
 *
 * Reuses the Phase-2 retrieval + context builder; the report PDF/markdown delivery
 * is handled by the run route + report-pdf.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { retrieveChunks, type RetrievedChunk } from "@/lib/investor/retrieval";
import { buildContext } from "@/lib/investor/ask-prompt";
import { defaultTitleFor, type ReportSpec } from "@/lib/investor/report-spec";
import type { Citation } from "@/lib/investor/answer";
import type { Tier } from "@/lib/investor/auth";

const SECTION_MODEL = process.env.INVESTOR_ANSWER_MODEL ?? "claude-sonnet-4-6";
const NOT_COVERED = "Not covered in the available dataroom.";

const SECTION_SYSTEM = `You are the LingoPure investor analyst drafting ONE section of an investor report. Write the section body using ONLY the provided dataroom excerpts.

Rules:
- Cite every factual claim inline as [Document name, p.N] from the excerpt you used.
- If the excerpts do not cover this section, reply with exactly: "${NOT_COVERED}" and nothing else.
- Be concise, factual, and specific. Use short paragraphs or "- " bullet points. Plain text only (no markdown headings — the section heading is added for you).
- Never invent a figure, date, or name. Do not repeat the section heading. Do not allude to documents outside the excerpts.`;

export type BuiltSection = { heading: string; body: string; sourceCount: number };
export type BuiltReport = {
  title: string;
  markdown: string;
  sections: BuiltSection[];
  citations: Citation[];
};

async function synthSection(
  anthropic: Anthropic,
  heading: string,
  topic: string | null,
  allowedTiers: Tier[]
): Promise<{ section: BuiltSection; chunks: RetrievedChunk[] }> {
  const query = topic ? `${heading} — ${topic}` : heading;
  const chunks = await retrieveChunks(query, allowedTiers, 8);
  if (chunks.length === 0) {
    return { section: { heading, body: NOT_COVERED, sourceCount: 0 }, chunks: [] };
  }
  const r = await anthropic.messages.create({
    model: SECTION_MODEL,
    max_tokens: 1200,
    system: SECTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Report section: ${heading}\n${topic ? `Report focus: ${topic}\n` : ""}\nDataroom excerpts:\n\n${buildContext(chunks)}\n\n---\nWrite the "${heading}" section now.`,
      },
    ],
  });
  const block = r.content.find((b) => b.type === "text");
  const body = block && block.type === "text" && block.text.trim() ? block.text.trim() : NOT_COVERED;
  return { section: { heading, body, sourceCount: chunks.length }, chunks };
}

export async function buildReport(spec: ReportSpec, allowedTiers: Tier[]): Promise<BuiltReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const anthropic = new Anthropic({ apiKey });

  const results = await Promise.all(
    spec.sections.map((h) => synthSection(anthropic, h, spec.topic ?? null, allowedTiers))
  );

  const title = defaultTitleFor(spec);
  let md = `# ${title}\n\n`;
  for (const { section } of results) {
    md += `## ${section.heading}\n\n${section.body}\n\n`;
  }

  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const { chunks } of results) {
    for (const c of chunks) {
      if (seen.has(c.documentId)) continue;
      seen.add(c.documentId);
      citations.push({ documentId: c.documentId, displayName: c.displayName, page: c.page });
    }
  }

  return { title, markdown: md.trim(), sections: results.map((r) => r.section), citations };
}
