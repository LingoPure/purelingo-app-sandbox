/** 04 AudienceFork — Qualify. Two equal-weight cards (NOT tabs, NOT a
 *  dropdown). The structural spine of the site. */
import type { ContentBlock } from "@/content/types";

export interface ForkCard {
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  href: string;
}

export interface AudienceForkData {
  titleKey: string;
  company: ForkCard;
  individual: ForkCard;
}

export const audienceForkBlock: ContentBlock<AudienceForkData> = {
  id: "home.audienceFork",
  status: "confirm",
  annotation: {
    label: "FORK COPY TO VALIDATE",
    note: "Structure is fixed (two equal cards). The card copy is a first pass — validate which promise each audience actually responds to.",
  },
  data: {
    titleKey: "mkt.fork.title",
    company: {
      titleKey: "mkt.fork.company.title",
      bodyKey: "mkt.fork.company.body",
      ctaKey: "mkt.fork.company.cta",
      href: "/for-companies",
    },
    individual: {
      titleKey: "mkt.fork.individual.title",
      bodyKey: "mkt.fork.individual.body",
      ctaKey: "mkt.fork.individual.cta",
      href: "/for-individuals",
    },
  },
};
