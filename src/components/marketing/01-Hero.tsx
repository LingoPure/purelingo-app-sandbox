import Link from "next/link";
import type { T } from "@/lib/i18n";
import { heroBlock, heroActionsBlock } from "@/content/home/hero";
import { Section } from "./Section";
import { EmptySlot, StatusPill, CleanOnly } from "./AnnotationLayer";

/** 01 Hero — Promise. Headline/subhead are pending; CTAs are structural. */
export function Hero({ t }: { t: T }) {
  const actions = heroActionsBlock.data!;
  return (
    <Section stage="01" name="Promise" status={heroBlock.status}>
      <div className="max-w-3xl">
        <div className="mb-4">
          <StatusPill status={heroBlock.status} />
        </div>
        <h1 className="font-serif text-4xl leading-tight text-navy sm:text-5xl md:text-6xl">
          {/* Promise pending — an empty slot is the deliverable. The
              only h1 fallback is the brand name (not an invented promise),
              kept accessible so the document has exactly one h1. */}
          <EmptySlot annotation={heroBlock.annotation} minHeight="9rem" />
          <CleanOnly>
            <span className="sr-only">LingoPure</span>
          </CleanOnly>
        </h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={actions.primaryHref}
            className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep"
          >
            {t(actions.primaryKey)}
          </Link>
          <Link
            href={actions.secondaryHref}
            className="rounded-md border border-navy/20 px-6 py-3 text-base font-medium text-navy hover:bg-mist"
          >
            {t(actions.secondaryKey)}
          </Link>
        </div>
      </div>
    </Section>
  );
}
