/** 07 Outcomes — Benefit. Two columns, different benefits per audience.
 *  Company column is a first pass (confirm); individual column is
 *  pending until B2C research lands. */
import type { ContentBlock } from "@/content/types";

export interface OutcomeColumn {
  titleKey: string;
  itemKeys: string[];
}

export interface OutcomesData {
  titleKey: string;
  company: ContentBlock<OutcomeColumn>;
  individual: ContentBlock<OutcomeColumn>;
}

export const outcomesBlock: ContentBlock<OutcomesData> = {
  id: "home.outcomes",
  status: "confirm",
  data: {
    titleKey: "mkt.outcomes.title",
    company: {
      id: "home.outcomes.company",
      status: "confirm",
      annotation: {
        label: "COMPANY BENEFITS TO VALIDATE",
        note: "First-pass benefits — validate against what companies actually buy on.",
      },
      data: {
        titleKey: "mkt.outcomes.company.title",
        itemKeys: [
          "mkt.outcomes.company.item1",
          "mkt.outcomes.company.item2",
          "mkt.outcomes.company.item3",
        ],
      },
    },
    individual: {
      id: "home.outcomes.individual",
      status: "pending",
      annotation: {
        label: "INDIVIDUAL BENEFITS PENDING",
        note: "B2C benefits must come from individual-learner research. Empty until then.",
      },
      data: null,
    },
  },
};
