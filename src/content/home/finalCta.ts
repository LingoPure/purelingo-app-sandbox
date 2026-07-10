/** 10 FinalCTA — Convert. One offer, one button, no inline form. */
import type { ContentBlock } from "@/content/types";

export interface FinalCtaData {
  titleKey: string;
  bodyKey: string;
  buttonKey: string;
  href: string;
}

export const finalCtaBlock: ContentBlock<FinalCtaData> = {
  id: "home.finalCta",
  status: "ready",
  data: {
    titleKey: "mkt.finalCta.title",
    bodyKey: "mkt.finalCta.body",
    buttonKey: "mkt.finalCta.button",
    href: "/book-a-demo",
  },
};
