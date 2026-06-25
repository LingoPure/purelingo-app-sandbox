/**
 * POST /api/investor/reports/run — generate a report from a validated ReportSpec.
 *
 * auth → tiers from server-side max_tier (NDA gate) → per-section retrieve+synthesise
 * → (pdf) render watermarked PDF + store in the private bucket → persist a
 * dataroom_reports row + audit. Returns the markdown + citations and, for PDF, a
 * short-lived signed download URL.
 *
 * Body: ReportSpec (or { spec: ReportSpec })
 */

import { NextRequest, NextResponse } from "next/server";
import { requireInvestor, allowedTiersFor } from "@/lib/investor/auth";
import { ReportSpecSchema } from "@/lib/investor/report-spec";
import { buildReport } from "@/lib/investor/build-report";
import { renderReportPdf } from "@/lib/investor/report-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireInvestor();
  if (auth instanceof NextResponse) return auth;
  const { investor } = auth;

  const body = await req.json().catch(() => null);
  const parsed = ReportSpecSchema.safeParse(body?.spec ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid report request: ${parsed.error.issues[0].message}` },
      { status: 400 }
    );
  }
  const spec = parsed.data;
  const allowedTiers = allowedTiersFor(investor.maxTier);
  const svc = createAdminClient();

  try {
    const report = await buildReport(spec, allowedTiers);

    const ins = await svc
      .from("dataroom_reports")
      .insert({ investor_id: investor.id, report_type: spec.reportType, spec, storage_path: null })
      .select("id")
      .single();
    if (ins.error) throw new Error(`could not save report: ${ins.error.message}`);
    const reportId = ins.data.id as string;

    let downloadUrl: string | null = null;
    if (spec.format === "pdf") {
      const date = new Date().toISOString().slice(0, 10);
      const firm = investor.firm || investor.fullName || investor.email;
      const bytes = await renderReportPdf(report.markdown, { firm, date });
      const storagePath = `reports/${investor.id}/${reportId}.pdf`;
      const up = await svc.storage
        .from("dataroom")
        .upload(storagePath, Buffer.from(bytes), { upsert: true, contentType: "application/pdf" });
      if (up.error) throw new Error(`PDF upload failed: ${up.error.message}`);
      await svc.from("dataroom_reports").update({ storage_path: storagePath }).eq("id", reportId);
      const signed = await svc.storage.from("dataroom").createSignedUrl(storagePath, 600);
      downloadUrl = signed.data?.signedUrl ?? null;
    }

    await svc.from("dataroom_audit").insert({
      investor_id: investor.id,
      action: "report_generate",
      detail: {
        reportId,
        reportType: spec.reportType,
        format: spec.format,
        tiers: allowedTiers,
        citations: report.citations.map((c) => c.documentId),
      },
    });

    return NextResponse.json({
      reportId,
      title: report.title,
      markdown: report.markdown,
      citations: report.citations,
      format: spec.format,
      downloadUrl,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[investor/reports/run] ${detail}`);
    return NextResponse.json({ error: `Could not generate the report: ${detail}` }, { status: 502 });
  }
}
