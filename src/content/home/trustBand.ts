/** 02 TrustBand — Permission. Logo strip + one hard number.
 *  Placeholder until logo consent + the real number are confirmed. */
import type { ContentBlock } from "@/content/types";

export interface TrustBandData {
  captionKey: string;
  statValueKey: string;
  statLabelKey: string;
}

export const trustBandBlock: ContentBlock<TrustBandData> = {
  id: "home.trustBand",
  status: "confirm",
  annotation: {
    label: "LOGOS + NUMBER UNVERIFIED",
    note: "Logo strip needs written consent per brand; the headline number is a placeholder pending a real, defensible figure. Validate before ship.",
  },
  data: {
    captionKey: "mkt.trust.caption",
    statValueKey: "mkt.trust.statValue",
    statLabelKey: "mkt.trust.statLabel",
  },
};
