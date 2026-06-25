/**
 * Render a report's markdown to a branded, watermarked PDF (pdf-lib).
 *
 * Watermarking is confidentiality-critical (§9): every page carries a faint
 * "CONFIDENTIAL" overlay + a footer naming who it was prepared for and when,
 * plus page numbers — so an exported report is traceable to the investor.
 *
 * Canonical note: @caistech/report-generator is the portfolio's markdown→PDF
 * vehicle, but it isn't usable in this repo yet (the @caistech dist install is
 * broken — same blocker as AuthForm/G1). pdf-lib gives a reliable watermarked
 * PDF now; swap to report-generator when the @caistech install is fixed.
 */

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

// Keep text within Helvetica's WinAnsi range — map common smart punctuation and
// drop anything pdf-lib can't encode (rare in synthesised English reports).
function winAnsi(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●]/g, "-")
    .replace(/…/g, "...")
    .replace(/[→➔]/g, "->")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

export type PdfMeta = { firm: string; date: string };

export async function renderReportPdf(markdown: string, meta: PdfMeta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE: [number, number] = [595.28, 841.89]; // A4
  const margin = 56;
  const contentW = PAGE[0] - margin * 2;
  const navy = rgb(0.06, 0.09, 0.16);
  const gold = rgb(0.72, 0.55, 0.2);
  const grey = rgb(0.45, 0.45, 0.5);

  let page = pdf.addPage(PAGE);
  let y = PAGE[1] - margin;

  const newPage = () => {
    page = pdf.addPage(PAGE);
    y = PAGE[1] - margin;
  };
  const ensure = (h: number) => {
    if (y - h < margin + 36) newPage();
  };

  const wrap = (text: string, f: typeof font, size: number): string[] => {
    const out: string[] = [];
    for (const rawLine of winAnsi(text).split("\n")) {
      if (rawLine.trim() === "") {
        out.push("");
        continue;
      }
      const words = rawLine.split(/\s+/);
      let line = "";
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(trial, size) > contentW && line) {
          out.push(line);
          line = w;
        } else {
          line = trial;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  const draw = (text: string, f: typeof font, size: number, color = navy, after = 4) => {
    for (const line of wrap(text, f, size)) {
      if (line === "") {
        y -= size * 0.6;
        continue;
      }
      ensure(size * 1.35);
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size * 1.35;
    }
    y -= after;
  };

  // Body: lightweight markdown — # title, ## heading, "- " bullet, else paragraph.
  for (const block of markdown.split("\n")) {
    const line = block.trimEnd();
    if (line.startsWith("# ")) {
      draw(line.slice(2), bold, 20, navy, 10);
    } else if (line.startsWith("## ")) {
      ensure(40);
      y -= 6;
      draw(line.slice(3), bold, 13, gold, 6);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      draw(`-  ${line.slice(2).replace(/\*\*/g, "")}`, font, 10.5, navy, 2);
    } else if (line.trim() === "") {
      y -= 5;
    } else {
      draw(line.replace(/\*\*/g, ""), font, 10.5, navy, 4);
    }
  }

  // Overlay watermark + footer + page numbers on every page.
  const stamp = winAnsi(`Confidential - prepared for ${meta.firm}  -  ${meta.date}`);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText("CONFIDENTIAL", {
      x: 90,
      y: 360,
      size: 64,
      font: bold,
      color: rgb(0.55, 0.58, 0.66),
      rotate: degrees(45),
      opacity: 0.1,
    });
    p.drawText(stamp, { x: margin, y: 30, size: 8, font, color: grey });
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: PAGE[0] - margin - 36,
      y: 30,
      size: 8,
      font,
      color: grey,
    });
  });

  return pdf.save();
}
