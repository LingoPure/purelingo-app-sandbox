import Link from "next/link";
import type { T } from "@/lib/i18n";
import { audienceForkBlock, type ForkCard } from "@/content/home/audienceFork";
import { Section } from "./Section";
import { StatusPill, AnnotationNote } from "./AnnotationLayer";

/** 04 AudienceFork — Qualify. Two equal-weight cards, the structural
 *  spine of the site. Not tabs, not a dropdown. */
export function AudienceFork({ t }: { t: T }) {
  const data = audienceForkBlock.data!;
  return (
    <Section stage="04" name="Qualify" status={audienceForkBlock.status} tone="soft">
      <div className="mb-10 flex items-center justify-center gap-3 text-center">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={audienceForkBlock.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ForkCardView card={data.company} t={t} />
        <ForkCardView card={data.individual} t={t} />
      </div>
      {audienceForkBlock.annotation ? (
        <div className="mx-auto mt-6 max-w-md">
          <AnnotationNote annotation={audienceForkBlock.annotation} />
        </div>
      ) : null}
    </Section>
  );
}

function ForkCardView({ card, t }: { card: ForkCard; t: T }) {
  return (
    <Link
      href={card.href}
      className="group flex flex-col rounded-xl border border-cream bg-paper p-8 transition hover:border-navy/30 hover:shadow-md"
    >
      <h3 className="font-serif text-2xl text-navy">{t(card.titleKey)}</h3>
      <p className="mt-3 flex-1 text-base leading-relaxed text-mute">
        {t(card.bodyKey)}
      </p>
      <span className="mt-6 inline-flex items-center gap-1 font-medium text-teal group-hover:gap-2">
        {t(card.ctaKey)} →
      </span>
    </Link>
  );
}
