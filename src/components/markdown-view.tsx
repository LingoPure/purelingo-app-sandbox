"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- react-markdown passes a `node` prop we intentionally strip before spreading onto the DOM element */
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Render agent/report markdown (GFM tables, headings, lists) with the LingoPure
 * theme. Tables are wrapped in overflow-x-auto so a wide cap-table never forces
 * the whole page to scroll sideways on mobile (naive-tester finding #1).
 */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="min-w-0 max-w-full space-y-2 text-base leading-relaxed text-navy">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...p }) => <h1 className="font-serif text-xl text-navy" {...p} />,
          h2: ({ node, ...p }) => <h2 className="mt-3 font-serif text-lg text-navy" {...p} />,
          h3: ({ node, ...p }) => <h3 className="mt-2 text-base font-semibold text-navy" {...p} />,
          p: ({ node, ...p }) => <p className="text-base text-navy/90" {...p} />,
          ul: ({ node, ...p }) => <ul className="list-disc space-y-1 pl-5 text-navy/90" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal space-y-1 pl-5 text-navy/90" {...p} />,
          li: ({ node, ...p }) => <li className="text-base" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-semibold text-navy" {...p} />,
          a: ({ node, ...p }) => <a className="text-navy underline" {...p} />,
          code: ({ node, ...p }) => (
            <code className="rounded bg-mist px-1 py-0.5 text-sm" {...p} />
          ),
          hr: ({ node, ...p }) => <hr className="my-3 border-cream" {...p} />,
          table: ({ node, ...p }) => (
            <div className="block w-full max-w-full overflow-x-auto">
              <table className="my-2 w-max min-w-full border-collapse text-sm" {...p} />
            </div>
          ),
          thead: ({ node, ...p }) => <thead className="bg-mist" {...p} />,
          th: ({ node, ...p }) => (
            <th className="border border-cream px-2 py-1 text-left font-medium text-navy" {...p} />
          ),
          td: ({ node, ...p }) => (
            <td className="border border-cream px-2 py-1 align-top text-navy/90" {...p} />
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
