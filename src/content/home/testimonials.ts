/** 08 Testimonials — Social proof. Three slots, all pending. Each needs
 *  photo, first name, role, company, and one specific claim. */
import type { ContentBlock } from "@/content/types";

export interface Testimonial {
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  companyKey: string;
  photo: string;
}

export interface TestimonialsData {
  titleKey: string;
  items: ContentBlock<Testimonial>[];
}

const pendingItem = (n: number): ContentBlock<Testimonial> => ({
  id: `home.testimonials.item${n}`,
  status: "pending",
  annotation: {
    label: "TESTIMONIAL PENDING",
    note: "Real named testimonial — photo, first name, role, company, one specific claim. No stock faces, no invented quotes.",
  },
  data: null,
});

export const testimonialsBlock: ContentBlock<TestimonialsData> = {
  id: "home.testimonials",
  status: "pending",
  data: {
    titleKey: "mkt.testimonials.title",
    items: [pendingItem(1), pendingItem(2), pendingItem(3)],
  },
};
