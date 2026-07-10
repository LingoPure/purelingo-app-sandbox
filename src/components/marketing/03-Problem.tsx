import type { T } from "@/lib/i18n";
import { problemBlock } from "@/content/home/problem";
import { hasData } from "@/content/types";
import { Section } from "./Section";
import { StatusPill, EmptySlot } from "./AnnotationLayer";

/** 03 Problem — customer verbatims as pull-quotes. */
export function Problem({ t }: { t: T }) {
  const data = problemBlock.data!;
  return (
    <Section stage="03" name="Problem" status={problemBlock.status}>
      <div className="mb-10 flex items-center gap-3">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={problemBlock.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {data.quotes.map((q) => (
          <figure
            key={q.id}
            className="flex flex-col justify-between rounded-lg border border-cream bg-paper p-6"
          >
            {hasData(q) ? (
              <>
                <blockquote className="font-serif text-lg leading-relaxed text-ink">
                  “{t(q.data.quoteKey)}”
                </blockquote>
                <figcaption className="mt-4 text-sm text-mute">
                  {t(q.data.attributionKey)}
                </figcaption>
              </>
            ) : (
              <EmptySlot annotation={q.annotation} minHeight="8rem" />
            )}
          </figure>
        ))}
      </div>
    </Section>
  );
}
