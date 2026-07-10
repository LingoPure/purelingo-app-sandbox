import Image from "next/image";
import type { T } from "@/lib/i18n";
import { proofOfMethodBlock } from "@/content/home/proofOfMethod";
import { hasData } from "@/content/types";
import { Section } from "./Section";
import { StatusPill, EmptySlot } from "./AnnotationLayer";

/** 06 ProofOfMethod — Proof. The LP-18 report artifact, displayed large.
 *  Copy ready; report image pending Thao's anonymised export. */
export function ProofOfMethod({ t }: { t: T }) {
  const data = proofOfMethodBlock.data!;
  const image = data.image;
  return (
    <Section stage="06" name="Proof" status={proofOfMethodBlock.status} tone="soft">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-serif text-3xl text-navy sm:text-4xl">
              {t(data.titleKey)}
            </h2>
            <StatusPill status={proofOfMethodBlock.status} />
          </div>
          <p className="text-lg leading-relaxed text-mute">{t(data.bodyKey)}</p>
        </div>
        <div className="rounded-xl border border-cream bg-paper p-3 shadow-sm">
          {hasData(image) ? (
            <Image
              src={image.data.src}
              alt={image.data.alt}
              width={image.data.width}
              height={image.data.height}
              className="h-auto w-full rounded-lg"
            />
          ) : (
            <EmptySlot annotation={image.annotation} minHeight="18rem" />
          )}
        </div>
      </div>
    </Section>
  );
}
