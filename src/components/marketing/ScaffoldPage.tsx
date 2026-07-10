import Link from "next/link";
import { Anno } from "./AnnotationLayer";
import type { Annotation } from "@/content/types";

/**
 * Scaffold page body for the route stubs (/for-companies, /for-individuals,
 * /method, /company). Renders REAL, approved copy (drawn from the homepage /
 * product demo — never invented) so a visitor sees a coherent page. The
 * "scaffold" note lives ONLY in the annotation, so it shows in spec view and
 * NEVER leaks into clean view. Nothing in the visible copy describes product
 * functionality that doesn't exist.
 */
export function ScaffoldPage({
  eyebrow,
  headline,
  subhead,
  cta,
  annotation,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: { label: string; href: string };
  annotation: Annotation;
}) {
  return (
    <section>
      <div className="wrap">
        <p className="eyebrow">{eyebrow}</p>
        <h1 style={{ marginBottom: 18 }}>{headline}</h1>
        <p className="lede" style={{ marginBottom: 26 }}>
          {subhead}
        </p>
        <div style={{ marginBottom: 26 }}>
          <Link href={cta.href} className="btn btn--lg">
            {cta.label}
          </Link>
        </div>
        <Anno annotation={annotation} status="confirm" />
      </div>
    </section>
  );
}
