import type { T } from "@/lib/i18n";
import { objectionsBlock } from "@/content/home/objections";
import { hasData } from "@/content/types";
import { Section } from "./Section";
import { StatusPill, EmptySlot } from "./AnnotationLayer";

/** 09 Objections — Remove friction. Accessible disclosure accordion via
 *  <details>/<summary>. Questions drafted; answers pending. */
export function Objections({ t }: { t: T }) {
  const data = objectionsBlock.data!;
  return (
    <Section stage="09" name="Remove friction" status={objectionsBlock.status}>
      <div className="mb-10 flex items-center gap-3">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={objectionsBlock.status} />
      </div>
      <div className="mx-auto max-w-3xl divide-y divide-cream border-y border-cream">
        {data.items.map((item) => (
          <details key={item.answer.id} className="group py-4">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-left font-serif text-lg text-navy marker:content-none">
              <span>{t(item.questionKey)}</span>
              <span className="shrink-0 text-mute transition group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 text-base leading-relaxed text-mute">
              {hasData(item.answer) ? (
                <p>{t(item.answer.data.answerKey)}</p>
              ) : (
                <EmptySlot annotation={item.answer.annotation} minHeight="5rem" />
              )}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
