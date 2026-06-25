/**
 * GET /api/investor/reports/[id]/download — re-download a stored report PDF.
 * Ownership-checked (the report must belong to the calling investor), issues a
 * short-lived signed URL, audits the download, and redirects to it.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor } from "@/lib/investor/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;
  const { id } = await params;

  const svc = createAdminClient();
  const { data, error } = await svc
    .from("dataroom_reports")
    .select("id, storage_path")
    .eq("id", id)
    .eq("investor_id", investor.id) // ownership
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (!data.storage_path) {
    return NextResponse.json({ error: "No downloadable file for this report" }, { status: 404 });
  }

  const signed = await svc.storage.from("dataroom").createSignedUrl(data.storage_path, 600);
  if (signed.error || !signed.data) {
    return NextResponse.json({ error: "Could not sign the download URL" }, { status: 500 });
  }

  await svc
    .from("dataroom_audit")
    .insert({
      investor_id: investor.id,
      action: "download",
      detail: { reportId: id, storage_path: data.storage_path },
    })
    .then(
      () => {},
      () => {}
    );

  return NextResponse.redirect(signed.data.signedUrl);
}
