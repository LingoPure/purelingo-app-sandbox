/**
 * Content overlay. Starts from the static src/content/home.ts (the seed +
 * fallback) and overlays edited rows on top: scalar copy blocks from
 * marketing_content, plus the testimonials and client-logo lists.
 *
 *   - Public page  → getHomeContent()             PUBLISHED scalar + published lists.
 *   - Gated preview → getHomeContent({draft:true})  DRAFT scalar + unpublished lists.
 *
 * Anything un-edited falls back to the source file, so the page always renders.
 */
import { home, type HomeContent } from "@/content/home";
import { EDITABLE_BLOCKS, getByPath, setByPath } from "@/content/editable";
import { createClient } from "@/lib/supabase/server";
import type { EditorBlock } from "@/app/admin/content/content-editor-client";

type ContentRow = {
  section: string;
  block_key: string;
  en: string | null;
  vi: string | null;
  draft_en: string | null;
  draft_vi: string | null;
  status?: string | null;
};

export type PublicTestimonial = {
  id: string;
  quote: string;
  name: string;
  role: string | null;
  company: string | null;
  photoUrl: string | null;
};

export type PublicLogo = { id: string; name: string; logoUrl: string | null };

export type ResolvedHome = {
  home: HomeContent;
  testimonials: PublicTestimonial[];
  logos: PublicLogo[];
};

/**
 * Load every editable copy block plus its current published/draft value and
 * status, for the /admin/content editor. Merges the static source default
 * (home.ts) with any marketing_content overlay so the editor always edits the
 * live value.
 */
export async function loadEditorBlocks(): Promise<EditorBlock[]> {
  const rows: Map<string, ContentRow> = new Map();
  try {
    const supabase = await createClient();
    const { data: rowData } = await supabase
      .from("marketing_content")
      .select("section, block_key, en, vi, draft_en, draft_vi, status")
      .eq("page", "home");
    for (const row of (rowData as ContentRow[] | null) ?? []) {
      rows.set(`${row.section}::${row.block_key}`, row);
    }
  } catch {
    // No marketing_content table / not signed in — fall through to static defaults.
  }

  const blocks: EditorBlock[] = [];
  for (const b of EDITABLE_BLOCKS) {
    const section = (home as unknown as Record<string, unknown>)[b.section];
    const seeded = section ?? Object.create(null);
    const row = rows.get(`${b.section}::${b.key}`);
    blocks.push({
      section: b.section,
      key: b.key,
      label: b.label,
      group: b.group,
      multiline: b.multiline ?? false,
      en: row?.draft_en ?? row?.en ?? getByPath(seeded, b.key) ?? "",
      vi: row?.draft_vi ?? row?.vi ?? "",
      status: (row?.status as EditorBlock["status"]) ?? "ready",
    });
  }
  return blocks;
}

export async function getHomeContent(
  opts: { draft?: boolean; lang?: "en" | "vi" } = {}
): Promise<ResolvedHome> {
  const { draft = false, lang = "en" } = opts;
  const merged = structuredClone(home) as HomeContent;
  const editable = new Set(EDITABLE_BLOCKS.map((b) => `${b.section}::${b.key}`));

  let testimonials: PublicTestimonial[] = [];
  let logos: PublicLogo[] = [];

  try {
    const supabase = await createClient();

    // Scalar copy blocks.
    const { data: rowData } = await supabase
      .from("marketing_content")
      .select("section, block_key, en, vi, draft_en, draft_vi")
      .eq("page", "home");
    for (const row of (rowData as ContentRow[] | null) ?? []) {
      if (!editable.has(`${row.section}::${row.block_key}`)) continue;
      const published = lang === "vi" ? row.vi : row.en;
      const drafted = lang === "vi" ? row.draft_vi ?? row.vi : row.draft_en ?? row.en;
      const value = draft ? drafted : published;
      if (typeof value !== "string" || value.length === 0) continue;
      const section = (merged as unknown as Record<string, unknown>)[row.section];
      if (section && typeof section === "object") setByPath(section, row.block_key, value);
    }

    // Testimonials — public: published only; preview: all.
    let tq = supabase
      .from("marketing_testimonials")
      .select("id, quote, name, role, company, photo_url")
      .order("sort_order", { ascending: true });
    if (!draft) tq = tq.eq("published", true);
    const { data: tData } = await tq;
    testimonials = ((tData as Array<Record<string, unknown>> | null) ?? []).map((t) => ({
      id: String(t.id),
      quote: String(t.quote ?? ""),
      name: String(t.name ?? ""),
      role: (t.role as string | null) ?? null,
      company: (t.company as string | null) ?? null,
      photoUrl: (t.photo_url as string | null) ?? null,
    }));

    // Logos — consent is always required to display; published gates live vs draft.
    let lq = supabase
      .from("marketing_logos")
      .select("id, name, logo_url")
      .eq("consent", true)
      .order("sort_order", { ascending: true });
    if (!draft) lq = lq.eq("published", true);
    const { data: lData } = await lq;
    logos = ((lData as Array<Record<string, unknown>> | null) ?? []).map((l) => ({
      id: String(l.id),
      name: String(l.name ?? ""),
      logoUrl: (l.logo_url as string | null) ?? null,
    }));
  } catch {
    return { home: merged, testimonials: [], logos: [] };
  }

  return { home: merged, testimonials, logos };
}
