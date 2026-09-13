/**
 * Marketing-home copy resolver.
 *
 * Renders EN from the annotated source copy (src/content/home.ts) and switches
 * to the dictionary (mkt.*) when a non-English locale is active. `lang` can be
 * undefined (server static render) — that is English.
 *
 * Loaded from src/lib/i18n/dictionary (pure — safe client-side), so the
 * resolver works from both server and client components.
 */

import {
  DEFAULT_LANGUAGE,
  dict,
  isLanguageCode,
  type LanguageCode,
} from "@/lib/i18n/dictionary";

function resolveKey(lang: LanguageCode | undefined, key: string, en: string): string {
  if (!lang || lang === DEFAULT_LANGUAGE) return en;
  return dict(lang)[key] ?? en;
}

export class MarketingHomeCopy {
  private readonly lang: LanguageCode | undefined;

  constructor(lang?: string | null) {
    this.lang = lang && isLanguageCode(lang) ? lang : undefined;
  }

  // —— 01 Hero ——
  hero = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.hero.eyebrow", en),
    h1: (en: string) => resolveKey(this.lang, "mkt.hero.h1", en),
    lede: (en: string) => resolveKey(this.lang, "mkt.hero.lede", en),
    micro: (en: string) => resolveKey(this.lang, "mkt.hero.micro", en),
    cta: (i: number, en: string) =>
      resolveKey(this.lang, i === 0 ? "mkt.hero.ctaPrimary" : "mkt.hero.ctaSecondary", en),
  };

  // —— 03 Problem ——
  problem = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.problem.eyebrow", en),
    h2: (en: string) => resolveKey(this.lang, "mkt.problem.h2", en),
    quote: (en: string) => resolveKey(this.lang, "mkt.problem.quote", en),
  };

  // —— 04 Fork ——
  forkCompany = {
    tag: (en: string) => resolveKey(this.lang, "mkt.fork.company.tag", en),
    h3: (en: string) => resolveKey(this.lang, "mkt.fork.company.h3", en),
    p: (en: string) => resolveKey(this.lang, "mkt.fork.company.p", en),
    cta: (en: string) => resolveKey(this.lang, "mkt.fork.company.cta", en),
  };
  forkIndividual = {
    tag: (en: string) => resolveKey(this.lang, "mkt.fork.individual.tag", en),
    h3: (en: string) => resolveKey(this.lang, "mkt.fork.individual.h3", en),
    p: (en: string) => resolveKey(this.lang, "mkt.fork.individual.p", en),
    cta: (en: string) => resolveKey(this.lang, "mkt.fork.individual.cta", en),
  };

  // —— 05 How ——
  how = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.how.eyebrow", en),
    h2: (en: string) => resolveKey(this.lang, "mkt.how.h2", en),
  };
  step = (i: number) => ({
    h3: (en: string) => resolveKey(this.lang, `mkt.how.step${i + 1}.h3`, en),
    p: (en: string) => resolveKey(this.lang, `mkt.how.step${i + 1}.p`, en),
  });

  // —— 06 Proof ——
  proof = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.proof.eyebrow", en),
    h2: (en: string) => resolveKey(this.lang, "mkt.proof.h2", en),
    lede: (en: string) => resolveKey(this.lang, "mkt.proof.lede", en),
    cta: (en: string) => resolveKey(this.lang, "mkt.proof.cta", en),
  };

  // —— 07 Outcomes ——
  outcomes = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.outcomes.eyebrow", en),
    h2: (en: string) => resolveKey(this.lang, "mkt.outcomes.h2", en),
    company: {
      h3: (en: string) => resolveKey(this.lang, "mkt.outcomes.company.h3", en),
      item: (i: number) => ({
        b: (en: string) =>
          resolveKey(this.lang, `mkt.outcomes.company.item${i + 1}.b`, en),
        span: (en: string) =>
          resolveKey(this.lang, `mkt.outcomes.company.item${i + 1}.span`, en),
      }),
    },
  };

  // —— 08 Testimonials ——
  testimonials = {
    eyebrow: (en: string) => resolveKey(this.lang, "mkt.testimonials.eyebrow", en),
    h2: (en: string) => resolveKey(this.lang, "mkt.testimonials.h2", en),
  };

  // —— 10 Final CTA ——
  final = {
    h2: (en: string) => resolveKey(this.lang, "mkt.final.h2", en),
    p: (en: string) => resolveKey(this.lang, "mkt.final.p", en),
    cta: (en: string) => resolveKey(this.lang, "mkt.final.cta", en),
    microPrefix: (en: string) => resolveKey(this.lang, "mkt.final.microPrefix", en),
    microLink: (en: string) => resolveKey(this.lang, "mkt.final.microLink", en),
  };
}