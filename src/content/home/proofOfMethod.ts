/** 06 ProofOfMethod — Proof. The LP-18 report artifact, displayed large.
 *  Copy is ready; the report image is pending Thao's anonymised export. */
import type { ContentBlock } from "@/content/types";

export interface ProofData {
  titleKey: string;
  bodyKey: string;
  /** Image slot: pending Thao's anonymised LP-18 export. */
  image: ContentBlock<{ src: string; alt: string; width: number; height: number }>;
}

export const proofOfMethodBlock: ContentBlock<ProofData> = {
  id: "home.proofOfMethod",
  status: "ready",
  data: {
    titleKey: "mkt.proof.title",
    bodyKey: "mkt.proof.body",
    image: {
      id: "home.proofOfMethod.image",
      status: "pending",
      annotation: {
        label: "LP-18 EXPORT PENDING",
        note: "Anonymised LP-18 report image from Thao. No mockup or invented screenshot — the real artifact is the proof.",
      },
      data: null,
    },
  },
};
