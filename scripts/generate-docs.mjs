/**
 * Generate .docx from markdown docs for LingoPure.
 * Usage: node scripts/generate-docs.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ExternalHyperlink,
  TabStopPosition,
  TabStopType,
  ShadingType,
} from "docx";

function parseMd(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      elements.push(
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: level <= 2 ? 32 : 28 })],
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
              ? HeadingLevel.HEADING_2
              : level === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4,
          spacing: { before: level <= 2 ? 360 : 240, after: 120 },
        })
      );
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|[\s-:|]+\|/)) {
      const headerCells = line
        .split("|")
        .filter((c) => c.trim())
        .map((c) => c.trim());
      const rows = [];
      let j = i + 2; // skip header + separator
      while (j < lines.length && lines[j].includes("|")) {
        const cells = lines[j]
          .split("|")
          .filter((c) => c.trim())
          .map((c) => c.trim());
        rows.push(cells);
        j++;
      }

      const numCols = headerCells.length;
      const colWidth = Math.floor(9000 / numCols);

      const headerRow = new TableRow({
        children: headerCells.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, bold: true, size: 20 })],
                }),
              ],
              width: { size: colWidth, type: WidthType.DXA },
              shading: { fill: "D9E2F3", type: ShadingType.CLEAR },
            })
        ),
        tableHeader: true,
      });

      const dataRows = rows.map(
        (row) =>
          new TableRow({
            children: Array.from({ length: numCols }, (_, k) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: row[k] || "",
                        size: 20,
                      }),
                    ],
                  }),
                ],
                width: { size: colWidth, type: WidthType.DXA },
              })
            ),
          })
      );

      elements.push(
        new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      elements.push(new Paragraph({ children: [], spacing: { after: 200 } }));
      i = j;
      continue;
    }

    // Checkbox list
    if (line.match(/^\d+\.\s+\[.\]/) || line.match(/^-\s+\[.\]/)) {
      const text = line.replace(/^\d+\.\s+\[.\]\s*/, "").replace(/^-\s+\[.\]\s*/, "");
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: "\u2610  ", size: 22 }),
            ...parseInline(text),
          ],
          spacing: { after: 60 },
          indent: { left: 480 },
        })
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${numMatch[1]}. `, bold: true, size: 22 }),
            ...parseInline(numMatch[2]),
          ],
          spacing: { after: 60 },
          indent: { left: 480 },
        })
      );
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*]\s+/)) {
      const text = line.replace(/^[-*]\s+/, "");
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: "\u2022  ", size: 22 }),
            ...parseInline(text),
          ],
          spacing: { after: 60 },
          indent: { left: 480 },
        })
      );
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      for (const codeLine of codeLines) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeLine,
                font: "Courier New",
                size: 18,
                color: "333333",
              }),
            ],
            spacing: { after: 0 },
            indent: { left: 480 },
          })
        );
      }
      elements.push(new Paragraph({ children: [], spacing: { after: 200 } }));
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const text = line.slice(2);
      elements.push(
        new Paragraph({
          children: parseInline(text),
          spacing: { after: 100 },
          indent: { left: 720 },
          border: {
            left: { color: "AAAAAA", space: 4, style: BorderStyle.SINGLE, size: 6 },
          },
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(
        new Paragraph({
          border: { bottom: { color: "CCCCCC", style: BorderStyle.SINGLE, size: 1 } },
          spacing: { before: 200, after: 200 },
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      new Paragraph({
        children: parseInline(line),
        spacing: { after: 120 },
      })
    );
    i++;
  }

  return elements;
}

function parseInline(text) {
  const runs = [];
  // Simple bold/inline handling
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22 }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: "Courier New",
          size: 20,
          color: "C7254E",
          shading: { fill: "F9F2F4", type: ShadingType.CLEAR },
        })
      );
    } else {
      runs.push(new TextRun({ text: part, size: 22 }));
    }
  }
  return runs;
}

async function generateDocx(mdPath, docxPath, title) {
  const md = readFileSync(mdPath, "utf8");
  const children = parseMd(md);

  const doc = new Document({
    creator: "LingoPure",
    title,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(docxPath, buffer);
  console.log(`  Generated: ${docxPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

const docs = [
  ["docs/TEST_PROTOCOL.md", "docs/TEST_PROTOCOL.docx", "LingoPure — Test Protocol"],
  [
    "docs/FUNCTIONALITY_WORKFLOWS.md",
    "docs/FUNCTIONALITY_WORKFLOWS.docx",
    "LingoPure — Functionality & Workflows",
  ],
];

console.log("Generating .docx files...");
for (const [md, docx, title] of docs) {
  await generateDocx(md, docx, title);
}
console.log("Done.");
