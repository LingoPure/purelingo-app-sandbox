/**
 * Report markdown → branded, watermarked PDF. Re-exported from
 * @caistech/dataroom-core, whose default brand (navy/gold + "CONFIDENTIAL"
 * overlay + per-recipient footer + page numbers) matches LingoPure's original
 * output exactly. Pass a PdfBrand only to diverge from the default.
 */

export { renderReportPdf, type PdfMeta } from "@caistech/dataroom-core";
