import type { T } from "@/lib/i18n";
import { outcomesBlock } from "@/content/home/outcomes";
import { hasData, type ContentBlock } from "@/content/types";
import type { OutcomeColumn } from "@/content/home/outcomes";
import { Section } from "./Section";
import { StatusPill, EmptySlot } from "./AnnotationLayer";

/** 07 Outcomes — Benefit. Two columns; company (confirm) + individual
 *  (pending, empty until B2C research lands). */
export function Outcomes({ t }: { t: T }) {
  const data = outcomesBlock.data!;
  return (
    <Section stage="07" name="Benefit" status={outcomesBlock.status}>
      <div className="mb-10 flex items-center gap-3">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={outcomesBlock.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <OutcomeColumnView column={data.company} t={t} />
        <OutcomeColumnView column={data.individual} t={t} />
      </div>
    </Section>
  );
}

function OutcomeColumnView({
  column,
  t,
}: {
  column: ContentBlock<OutcomeColumn>;
  t: T;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-8">
      {hasData(column) ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <h3 className="font-serif text-xl text-navy">
              {t(column.data.titleKey)}
            </h3>
            <StatusPill status={column.status} />
          </div>
          <ul className="space-y-3">
            {column.data.itemKeys.map((key) => (
              <li key={key} className="flex gap-3 text-base text-ink">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                <span className="text-mute">{t(key)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptySlot annotation={column.annotation} minHeight="12rem" />
      )}
    </div>
  );
}
