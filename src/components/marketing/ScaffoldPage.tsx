import Link from "next/link";
import { Anno } from "./AnnotationLayer";
import type { Annotation } from "@/content/types";

/**
 * Scaffold page body for the route stubs (/for-companies, /for-individuals,
 * /method, /book-a-demo). The marketing chrome (nav, footer, canvas toggle)
 * comes from the (marketing) layout — this renders only the page's own
 * section: an explanatory header + an honest empty slot for the page body.
 */
export function ScaffoldPage({
  title,
  intro,
  annotation,
}: {
  title: string;
  intro: string;
  annotation: Annotation;
}) {
  return (
    <section>
      <div className="wrap">
        <p className="eyebrow">Landing page · scaffold</p>
        <h1 style={{ marginBottom: 18 }}>{title}</h1>
        <p className="lede" style={{ marginBottom: 26 }}>
          {intro}
        </p>
        {/* A single CTA so a linked scaffold is never a dead end. */}
        <div style={{ marginBottom: 26 }}>
          <Link href="/book-a-demo" className="btn btn--lg">
            Book a free demo class
          </Link>
        </div>
        <Anno annotation={annotation} status="pending" />
        <div style={{ marginTop: 8 }}>
          <Anno
            annotation={{
              label: "Page body pending",
              note: "This landing page is scaffolded. The full argument is built here after the homepage fork copy is validated.",
            }}
            status="pending"
          />
        </div>
      </div>
    </section>
  );
}
