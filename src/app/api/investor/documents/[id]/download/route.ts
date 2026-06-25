/**
 * GET /api/investor/documents/[id]/download — view/download a dataroom source file.
 *
 * THE tier boundary for documents: re-checks the doc's tier against the investor's
 * server-side max_tier (never trusts the id), fetches the original from the private
 * bucket, watermarks PDFs per-investor, audits the access (doc_view), and streams it.
 * A main-tier investor cannot pull a restricted file even with its id.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor, allowedTiersFor, type Tier } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { stampPdf } from "@/lib/investor/watermark-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpeg: "image/jpeg",
};
const INLINE = new Set(["pdf", "png", "jpeg"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;
  const { id } = await params;

  const svc = createAdminClient();
  const { data: doc, error } = await svc
    .from("dataroom_documents")
    .select("id, display_name, format, storage_path, confidentiality_tier")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc || !doc.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Tier gate — the confidentiality boundary.
  const allowed = allowedTiersFor(investor.maxTier);
  if (!allowed.includes(doc.confidentiality_tier as Tier)) {
    return NextResponse.json({ error: "Not authorised for this document" }, { status: 403 });
  }

  const dl = await svc.storage.from("dataroom").download(doc.storage_path);
  if (dl.error || !dl.data) {
    return NextResponse.json({ error: "Could not retrieve the file" }, { status: 502 });
  }
  const raw = new Uint8Array(await dl.data.arrayBuffer());
  let bytes: Uint8Array = raw;

  if (doc.format === "pdf") {
    const date = new Date().toISOString().slice(0, 10);
    const firm = investor.firm || investor.fullName || investor.email;
    bytes = await stampPdf(raw, { firm, date });
  }

  await svc
    .from("dataroom_audit")
    .insert({
      investor_id: investor.id,
      action: "doc_view",
      detail: { documentId: doc.id, display_name: doc.display_name, tier: doc.confidentiality_tier },
    })
    .then(
      () => {},
      () => {}
    );

  const ext = doc.format === "jpeg" ? "jpg" : doc.format;
  const safeName = `${doc.display_name.replace(/[^A-Za-z0-9 ._-]+/g, "_")}.${ext}`;
  const disposition = INLINE.has(doc.format) ? "inline" : "attachment";

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": MIME[doc.format] ?? "application/octet-stream",
      "content-disposition": `${disposition}; filename="${safeName}"`,
      "cache-control": "private, no-store",
    },
  });
}
