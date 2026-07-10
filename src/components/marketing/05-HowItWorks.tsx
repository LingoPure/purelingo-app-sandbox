import type { T } from "@/lib/i18n";
import { howItWorksBlock } from "@/content/home/howItWorks";
import { Section } from "./Section";
import { StatusPill } from "./AnnotationLayer";

/** 05 HowItWorks — Mechanism. Three steps. Ready — no dependencies. */
export function HowItWorks({ t }: { t: T }) {
  const data = howItWorksBlock.data!;
  return (
    <Section stage="05" name="Mechanism" status={howItWorksBlock.status}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-serif text-3xl text-navy sm:text-4xl">
          {t(data.titleKey)}
        </h2>
        <StatusPill status={howItWorksBlock.status} />
      </div>
      <p className="mb-10 max-w-2xl text-lg text-mute">{t(data.leadKey)}</p>
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {data.steps.map((step) => (
          <li
            key={step.tag}
            className="rounded-lg border border-cream bg-paper p-6 shadow-sm"
          >
            <div className="mb-3 font-mono text-xs uppercase tracking-widest text-gold">
              {step.tag}
            </div>
            <h3 className="mb-2 font-serif text-xl text-navy">
              {t(step.titleKey)}
            </h3>
            <p className="text-sm leading-relaxed text-mute">
              {t(step.bodyKey)}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
