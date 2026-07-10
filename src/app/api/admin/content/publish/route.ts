/**
 * POST /api/admin/content/publish — promote all drafts to published for a page.
 * Marketing/admin only. Sets en = draft_en (vi = draft_vi) where a draft exists;
 * the audit trigger records each en/vi change as a publish event.
 */
import { NextRequest, NextResponse } from "next/server";
import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  en: string | null;
  vi: string | null;
  draft_en: string | null;
  draft_vi: string | null;
};

export async function POST(request: NextRequest) {
  const editor = await getContentEditor();
  if (!editor) return NextResponse.json({ error: "Not a content editor" }, { status: 403 });
  if (!canEdit(editor.role))
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_content")
    .select("id, en, vi, draft_en, draft_vi")
    .eq("page", "home");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as Row[] | null) ?? [];
  let published = 0;
  for (const row of rows) {
    const nextEn = row.draft_en ?? row.en;
    const nextVi = row.draft_vi ?? row.vi;
    if (nextEn === row.en && nextVi === row.vi) continue; // nothing to publish
    const { error: upErr } = await supabase
      .from("marketing_content")
      .update({ en: nextEn, vi: nextVi, updated_by: editor.userId })
      .eq("id", row.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    published += 1;
  }

  return NextResponse.json({ ok: true, published });
}
