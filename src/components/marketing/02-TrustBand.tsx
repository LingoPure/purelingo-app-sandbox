import type { T } from "@/lib/i18n";
import { trustBandBlock } from "@/content/home/trustBand";
import { Section } from "./Section";
import { StatusPill, AnnotationNote, EmptySlot } from "./AnnotationLayer";

/** 02 TrustBand — Permission. Logo strip + one hard number. */
export function TrustBand({ t }: { t: T }) {
  const data = trustBandBlock.data!;
  return (
    <Section stage="02" name="Permission" status={trustBandBlock.status} tone="soft">
      <div className="flex flex-col items-center gap-6 text-center">
        <StatusPill status={trustBandBlock.status} />
        <p className="text-sm uppercase tracking-widest text-mute">
          {t(data.captionKey)}
        </p>
        <div className="flex flex-col items-center">
          <span className="font-serif text-5xl text-navy">
            {t(data.statValueKey)}
          </span>
          <span className="mt-1 text-sm text-mute">{t(data.statLabelKey)}</span>
        </div>
        {/* Logo strip slot — pending written consent per brand. */}
        <div className="w-full max-w-3xl">
          <EmptySlot
            annotation={{
              label: "LOGO STRIP PENDING",
              note: "Partner/customer logos require written consent before display. No placeholder logos.",
            }}
            minHeight="4rem"
          />
        </div>
        {trustBandBlock.annotation ? (
          <div className="w-full max-w-md">
            <AnnotationNote annotation={trustBandBlock.annotation} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}
