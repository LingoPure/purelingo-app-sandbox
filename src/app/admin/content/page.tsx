import { home } from "@/content/home";
import { EDITABLE_BLOCKS, getByPath } from "@/content/editable";
import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentEditorClient, type EditorBlock } from "./content-editor-client";

type Row = {
  section: string;
  block_key: string;
  en: string | null;
  vi: string | null;
  draft_en: string | null;
  draft_vi: string | null;
  status: "ready" | "confirm" | "pending";
};

/**
 * Content editor. Edit the homepage copy block by block (English + Vietnamese),
 * set each block's status, preview drafts, then publish. Row-backed — no deploy.
 */
export default async function AdminContentPage() {
  const editor = await getContentEditor();
  const editable = editor ? canEdit(editor.role) : false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_content")
    .select("section, block_key, en, vi, draft_en, draft_vi, status")
    .eq("page", "home");
  const map = new Map(
    ((data as Row[] | null) ?? []).map((r) => [`${r.section}::${r.block_key}`, r])
  );

  const blocks: EditorBlock[] = EDITABLE_BLOCKS.map((b) => {
    const row = map.get(`${b.section}::${b.key}`);
    const source = getByPath((home as unknown as Record<string, unknown>)[b.section], b.key) ?? "";
    return {
      section: b.section,
      key: b.key,
      label: b.label,
      group: b.group,
      multiline: Boolean(b.multiline),
      en: row?.draft_en ?? row?.en ?? source,
      vi: row?.draft_vi ?? row?.vi ?? "",
      status: row?.status ?? "ready",
    };
  });

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">Content</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Marketing homepage</h1>
      <p className="mt-3 max-w-prose text-mute">
        Edit the homepage copy block by block. Changes are saved as a <em>draft</em>;
        preview them, then <strong>publish</strong> to make them live. English is what
        the site shows today; Vietnamese is stored for when the site goes bilingual.
      </p>
      <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-navy">
        A <strong>pending</strong> block is <em>intentionally empty</em> — its copy must
        come from customer research. Filling it with invented copy defeats its purpose;
        move it to <strong>confirm</strong> only when real copy exists.
      </div>

      <ContentEditorClient blocks={blocks} canEdit={editable} />
    </div>
  );
}
