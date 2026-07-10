/**
 * Content overlay. Starts from the static src/content/home.ts (the seed +
 * fallback) and overlays any edited rows from public.marketing_content on top,
 * returning a home-shaped object the page renders unchanged.
 *
 *   - Public page  → getHomeContent()            reads PUBLISHED (en/vi).
 *   - Gated preview → getHomeContent({draft:true}) reads DRAFT (falls back to
 *     published, then to the source file).
 *
 * A block with no row, or an empty value, falls back to the source file — so
 * the page always renders even before anything is edited.
 */
import { home, type HomeContent } from "@/content/home";
import { EDITABLE_BLOCKS, setByPath } from "@/content/editable";
import { createClient } from "@/lib/supabase/server";

type ContentRow = {
  section: string;
  block_key: string;
  en: string | null;
  vi: string | null;
  draft_en: string | null;
  draft_vi: string | null;
};

export async function getHomeContent(
  opts: { draft?: boolean; lang?: "en" | "vi" } = {}
): Promise<HomeContent> {
  const { draft = false, lang = "en" } = opts;
  const merged = structuredClone(home) as HomeContent;

  let rows: ContentRow[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("marketing_content")
      .select("section, block_key, en, vi, draft_en, draft_vi")
      .eq("page", "home");
    rows = (data as ContentRow[] | null) ?? [];
  } catch {
    // DB unavailable / table missing → render the source file unchanged.
    return merged;
  }

  const editable = new Set(EDITABLE_BLOCKS.map((b) => `${b.section}::${b.key}`));

  for (const row of rows) {
    if (!editable.has(`${row.section}::${row.block_key}`)) continue;
    const published = lang === "vi" ? row.vi : row.en;
    const drafted = lang === "vi" ? row.draft_vi ?? row.vi : row.draft_en ?? row.en;
    const value = draft ? drafted : published;
    if (typeof value !== "string" || value.length === 0) continue;

    const section = (merged as unknown as Record<string, unknown>)[row.section];
    if (section && typeof section === "object") {
      setByPath(section, row.block_key, value);
    }
  }

  return merged;
}
