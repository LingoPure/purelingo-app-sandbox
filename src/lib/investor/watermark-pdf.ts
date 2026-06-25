/**
 * Stamp an EXISTING PDF (a dataroom source file) with a per-investor confidential
 * watermark on every page — distinct from report-pdf.ts which renders a PDF from
 * scratch. Used by the documents viewer so a downloaded original is traceable.
 *
 * If a particular PDF can't be loaded/stamped (encrypted, malformed), we log and
 * return the original bytes rather than block access — the download is still
 * audited; degrade the watermark, don't deny the document.
 */

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export async function stampPdf(
  bytes: Uint8Array,
  meta: { firm: string; date: string }
): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const stamp = `Confidential - prepared for ${meta.firm}  -  ${meta.date}`.replace(
      /[^\x20-\xFF]/g,
      ""
    );
    for (const p of pdf.getPages()) {
      p.drawText("CONFIDENTIAL", {
        x: 80,
        y: 320,
        size: 58,
        font: bold,
        color: rgb(0.55, 0.58, 0.66),
        rotate: degrees(45),
        opacity: 0.1,
      });
      p.drawText(stamp, { x: 36, y: 18, size: 8, font, color: rgb(0.5, 0.5, 0.55) });
    }
    return await pdf.save();
  } catch (err) {
    console.warn(`[watermark-pdf] could not stamp, serving original: ${err instanceof Error ? err.message : err}`);
    return bytes;
  }
}
