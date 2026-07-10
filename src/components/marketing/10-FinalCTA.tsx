import Link from "next/link";
import type { T } from "@/lib/i18n";
import { finalCtaBlock } from "@/content/home/finalCta";
import { Section } from "./Section";
import { StatusPill } from "./AnnotationLayer";

/** 10 FinalCTA — Convert. One offer, one button, no inline form. */
export function FinalCTA({ t }: { t: T }) {
  const data = finalCtaBlock.data!;
  return (
    <Section stage="10" name="Convert" status={finalCtaBlock.status} tone="ink">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <StatusPill status={finalCtaBlock.status} />
        </div>
        <h2 className="font-serif text-3xl text-paper sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <p className="mt-4 text-lg text-paper/80">{t(data.bodyKey)}</p>
        <div className="mt-8">
          <Link
            href={data.href}
            className="inline-block rounded-md bg-gold px-8 py-4 text-base font-medium text-navy hover:bg-gold/90"
          >
            {t(data.buttonKey)}
          </Link>
        </div>
      </div>
    </Section>
  );
}
