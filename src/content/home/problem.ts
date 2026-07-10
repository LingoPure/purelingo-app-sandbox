/** 03 Problem — three to four customer verbatims as pull-quotes.
 *  One illustrative (confirm), the rest empty until interviews land. */
import type { ContentBlock } from "@/content/types";

export interface Quote {
  quoteKey: string;
  attributionKey: string;
}

export interface ProblemData {
  titleKey: string;
  quotes: ContentBlock<Quote>[];
}

export const problemBlock: ContentBlock<ProblemData> = {
  id: "home.problem",
  status: "confirm",
  annotation: {
    label: "VERBATIMS PENDING",
    note: "One illustrative quote stands in; the remaining slots are empty until real customer verbatims exist. Do not invent quotes.",
  },
  data: {
    titleKey: "mkt.problem.title",
    quotes: [
      {
        id: "home.problem.q1",
        status: "confirm",
        annotation: {
          label: "ILLUSTRATIVE",
          note: "Composite, not a real customer. Replace with a verbatim from interviews.",
        },
        data: { quoteKey: "mkt.problem.q1", attributionKey: "mkt.problem.q1.attr" },
      },
      {
        id: "home.problem.q2",
        status: "pending",
        annotation: {
          label: "VERBATIM PENDING",
          note: "Real customer quote from interviews.",
        },
        data: null,
      },
      {
        id: "home.problem.q3",
        status: "pending",
        annotation: {
          label: "VERBATIM PENDING",
          note: "Real customer quote from interviews.",
        },
        data: null,
      },
    ],
  },
};
