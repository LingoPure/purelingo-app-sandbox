/** 05 HowItWorks — Mechanism. Three steps, no external dependencies.
 *  Final copy (mirrors the proven demo feature set). */
import type { ContentBlock } from "@/content/types";

export interface Step {
  tag: string;
  titleKey: string;
  bodyKey: string;
}

export interface HowItWorksData {
  titleKey: string;
  leadKey: string;
  steps: Step[];
}

export const howItWorksBlock: ContentBlock<HowItWorksData> = {
  id: "home.howItWorks",
  status: "ready",
  data: {
    titleKey: "mkt.how.title",
    leadKey: "mkt.how.lead",
    steps: [
      { tag: "01", titleKey: "mkt.how.step1.title", bodyKey: "mkt.how.step1.body" },
      { tag: "02", titleKey: "mkt.how.step2.title", bodyKey: "mkt.how.step2.body" },
      { tag: "03", titleKey: "mkt.how.step3.title", bodyKey: "mkt.how.step3.body" },
    ],
  },
};
