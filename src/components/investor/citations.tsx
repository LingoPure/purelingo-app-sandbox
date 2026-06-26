"use client";

/**
 * Clickable source citations for an investor answer. Each chip deep-links to the
 * cited document AT the cited page (`#page=N`) — opened in a new tab via the
 * existing authed download route, which serves PDFs inline.
 *
 * Security note: this adds NO new access path. The chip points at
 * /api/investor/documents/[id]/download, which re-checks the investor's tier
 * server-side, gates deep-dive behind the NDA, watermarks the PDF per-investor,
 * and audits the open (doc_view) — exactly as the Documents page does. The
 * answer only ever cites documents within the investor's allowed tier, and the
 * route enforces it again regardless. Voice is never involved: citations sit on
 * the WRITTEN answer (text Ask + the text answer in the Morgan handoff).
 */

export type Citation = {
  documentId: string;
  displayName: string;
  page: number | null;
};

export function Citations({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="border-t border-cream pt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/50">
        Sources — open the document at the cited page
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {citations.map((c) => (
          <a
            key={`${c.documentId}#${c.page ?? ""}`}
            href={`/api/investor/documents/${c.documentId}/download${
              c.page ? `#page=${c.page}` : ""
            }`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${c.displayName}${
              c.page ? ` at page ${c.page}` : ""
            } — watermarked, access-logged`}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-md bg-mist px-2.5 py-1 text-xs text-navy/80 underline decoration-navy/20 underline-offset-2 hover:bg-gold/15 hover:text-navy hover:decoration-navy"
          >
            <span>
              {c.displayName}
              {c.page ? ` · p.${c.page}` : ""}
            </span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0 opacity-60"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
