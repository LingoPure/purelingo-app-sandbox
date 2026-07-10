import { redirect } from "next/navigation";
import Link from "next/link";
import { MarketingHomeView } from "@/components/marketing/HomeView";
import { getHomeContent } from "@/content/resolve";
import { getContentEditor } from "@/lib/content/auth";

export const metadata = { title: "Preview · LingoPure content", robots: { index: false } };

/**
 * Draft preview of the marketing homepage — the real component rendered from
 * DRAFT content, before it is published. Gated to content editors; a visitor
 * cannot reach it. Lives in the (marketing) route group so it inherits the real
 * marketing styling.
 */
export default async function MarketingPreview() {
  const editor = await getContentEditor();
  if (!editor) redirect("/login?next=/preview");

  const { home, testimonials, logos } = await getHomeContent({ draft: true });
  return (
    <>
      <div className="demobar">
        Draft preview — not published ·{" "}
        <Link href="/admin/content">← back to the editor</Link>
      </div>
      <MarketingHomeView home={home} testimonials={testimonials} logos={logos} />
    </>
  );
}
