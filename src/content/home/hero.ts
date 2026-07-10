/** 01 Hero — Promise. Headline/subhead are research-dependent (pending);
 *  the two CTAs are structural and known (ready). */
import type { ContentBlock } from "@/content/types";

export interface HeroActions {
  primaryKey: string;
  primaryHref: string;
  secondaryKey: string;
  secondaryHref: string;
}

/** The promise itself — deliberately empty. The headline must come from
 *  customer interviews: which pain, in whose words. */
export const heroBlock: ContentBlock<never> = {
  id: "home.hero",
  status: "pending",
  annotation: {
    label: "HERO PROMISE PENDING",
    note: "Headline + subhead must come from customer interviews — the one pain, in the customer's own words. No invented promise ships here.",
  },
  data: null,
};

/** The CTA row is structural, not research-dependent. */
export const heroActionsBlock: ContentBlock<HeroActions> = {
  id: "home.hero.actions",
  status: "ready",
  data: {
    primaryKey: "mkt.hero.ctaPrimary",
    primaryHref: "/book-a-demo",
    secondaryKey: "mkt.hero.ctaSecondary",
    secondaryHref: "/for-companies",
  },
};
