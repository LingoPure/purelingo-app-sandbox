/**
 * POST /api/admin/assets/upload — upload a testimonial photo or client logo.
 * Marketing/admin only. Uploads to the public "marketing-assets" bucket via the
 * service role (ensures the bucket exists) and returns the public URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "marketing-assets";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  const editor = await getContentEditor();
  if (!editor || !canEdit(editor.role)) {
    return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = (form?.get("kind") as string) === "logo" ? "logos" : "photos";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // Ensure the bucket exists (idempotent — ignore "already exists").
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${kind}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
