/** 09 Objections — Remove friction. Accordion. Questions are drafted
 *  (ready); every answer is pending real product/positioning sign-off. */
import type { ContentBlock } from "@/content/types";

export interface ObjectionItem {
  /** Question copy is drafted and shown. */
  questionKey: string;
  /** Answer is a separate block so it renders as an empty slot until ready. */
  answer: ContentBlock<{ answerKey: string }>;
}

export interface ObjectionsData {
  titleKey: string;
  items: ObjectionItem[];
}

const q = (n: number): ObjectionItem => ({
  questionKey: `mkt.objections.q${n}`,
  answer: {
    id: `home.objections.a${n}`,
    status: "pending",
    annotation: {
      label: "ANSWER PENDING",
      note: "Question is drafted; the answer needs product + positioning sign-off before it ships.",
    },
    data: null,
  },
});

export const objectionsBlock: ContentBlock<ObjectionsData> = {
  id: "home.objections",
  status: "confirm",
  data: {
    titleKey: "mkt.objections.title",
    items: [q(1), q(2), q(3), q(4)],
  },
};
