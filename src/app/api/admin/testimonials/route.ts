/**
 * Testimonials CRUD — marketing/admin only (RLS enforces it too; the audit
 * trigger records every change). POST create · PUT update · DELETE remove.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";

const FIELDS = z.object({
  quote: z.string().trim().min(1).max(2000),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  photo_url: z.string().url().max(1000).nullable().optional(),
  published: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

async function gate() {
  const editor = await getContentEditor();
  if (!editor || !canEdit(editor.role)) return null;
  return editor;
}

export async function POST(request: NextRequest) {
  const editor = await gate();
  if (!editor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const parsed = FIELDS.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_testimonials")
    .insert({ ...parsed.data, updated_by: editor.userId })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PUT(request: NextRequest) {
  const editor = await gate();
  if (!editor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const schema = FIELDS.partial().extend({ id: z.string().uuid() });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { id, ...fields } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_testimonials")
    .update({ ...fields, updated_by: editor.userId })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const editor = await gate();
  if (!editor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("marketing_testimonials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
