/**
 * PUT /api/admin/content — save a block's DRAFT (marketing/admin only).
 *
 * Edits the working copy; publishing (POST /api/admin/content/publish) promotes
 * draft → published. RLS on marketing_content enforces the role on top of this
 * app-level gate, and the audit trigger records every change.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";
import { EDITABLE_BLOCKS } from "@/content/editable";

const BodySchema = z.object({
  section: z.string().min(1),
  block_key: z.string().min(1),
  draft_en: z.string().max(5000).nullable().optional(),
  draft_vi: z.string().max(5000).nullable().optional(),
  status: z.enum(["ready", "confirm", "pending"]).optional(),
});

export async function PUT(request: NextRequest) {
  const editor = await getContentEditor();
  if (!editor) return NextResponse.json({ error: "Not a content editor" }, { status: 403 });
  if (!canEdit(editor.role))
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  // Only allow blocks the manifest declares editable.
  const known = EDITABLE_BLOCKS.some(
    (b) => b.section === body.section && b.key === body.block_key
  );
  if (!known) {
    return NextResponse.json({ error: "Unknown content block" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("marketing_content").upsert(
    {
      page: "home",
      section: body.section,
      block_key: body.block_key,
      draft_en: body.draft_en ?? null,
      draft_vi: body.draft_vi ?? null,
      ...(body.status ? { status: body.status } : {}),
      updated_by: editor.userId,
    },
    { onConflict: "page,section,block_key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
