import { MarketingHomeView } from "@/components/marketing/HomeView";
import { getHomeContent } from "@/content/resolve";

/**
 * Marketing homepage. Renders PUBLISHED content — the row-overlaid home object
 * (edits from the content admin), falling back to the source file for any block
 * that hasn't been edited. The gated /preview route renders the same view with
 * draft content.
 */
export default async function MarketingHome() {
  const { home, testimonials, logos } = await getHomeContent();
  return <MarketingHomeView home={home} testimonials={testimonials} logos={logos} />;
}
