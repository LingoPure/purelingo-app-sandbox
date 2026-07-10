import Link from "next/link";
import { home } from "@/content/home";
import { Anno } from "./AnnotationLayer";

/** Marketing footer. The "Company" link is the only investor-facing entry
 *  point, and it lives below the fold — per the mockup's confirm note. */
export function Footer() {
  const f = home.footer;
  return (
    <footer>
      <div className="wrap footin">
        <div className="legal">
          {f.legalLeft.map((line, i) => (
            <span key={i}>
              {line}
              {i < f.legalLeft.length - 1 ? <br /> : null}
            </span>
          ))}
        </div>
        <div className="legal">
          {f.links.map((l, i) => (
            <span key={l.label}>
              <Link href={l.href}>{l.label}</Link>
              {i < f.links.length - 1 ? " · " : null}
            </span>
          ))}
          <br />
          {f.langs}
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 26 }}>
        <Anno annotation={f.anno} status={f.anno.status} />
      </div>
    </footer>
  );
}
