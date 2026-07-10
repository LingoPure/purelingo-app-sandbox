import Image from "next/image";
import type { T } from "@/lib/i18n";
import { testimonialsBlock } from "@/content/home/testimonials";
import { hasData } from "@/content/types";
import { Section } from "./Section";
import { StatusPill, EmptySlot } from "./AnnotationLayer";

/** 08 Testimonials — Social proof. Three slots, all pending. */
export function Testimonials({ t }: { t: T }) {
  const data = testimonialsBlock.data!;
  return (
    <Section stage="08" name="Social proof" status={testimonialsBlock.status} tone="soft">
      <div className="mb-10 flex items-center gap-3">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={testimonialsBlock.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {data.items.map((item) => (
          <figure
            key={item.id}
            className="rounded-lg border border-cream bg-paper p-6"
          >
            {hasData(item) ? (
              <>
                <blockquote className="text-base leading-relaxed text-ink">
                  “{t(item.data.quoteKey)}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <Image
                    src={item.data.photo}
                    alt={t(item.data.nameKey)}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <span className="text-sm text-mute">
                    <span className="block font-medium text-navy">
                      {t(item.data.nameKey)}
                    </span>
                    {t(item.data.roleKey)}, {t(item.data.companyKey)}
                  </span>
                </figcaption>
              </>
            ) : (
              <EmptySlot annotation={item.annotation} minHeight="10rem" />
            )}
          </figure>
        ))}
      </div>
    </Section>
  );
}
