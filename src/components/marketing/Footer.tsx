import Link from "next/link";
import { home } from "@/content/home";
import { Anno } from "./AnnotationLayer";

export function Footer() {
  const f = home.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footin">
          <div>
            <Link href="/" className="mark" aria-label="Home">
              LingoPure<span>.</span>
            </Link>
            <p className="footer-note">Business English for Vietnam &amp; Southeast Asia</p>
            <div className="legal">
              {f.legalLeft.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < f.legalLeft.length - 1 ? <br /> : null}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="footer-col-title">Company</h2>
            <ul className="footer-col">
              {f.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="footer-col-title">Contract</h2>
            <p className="footer-contact">info@lingopure.com</p>
            <h2 className="footer-col-title" style={{ marginTop: 20 }}>
              Languages
            </h2>
            <p className="footer-contact">{f.langs}</p>
          </div>
        </div>
        <div className="legal" style={{ marginTop: 24 }}>
          © {year} LingoPure. All rights reserved.
        </div>
        <div className="wrap" style={{ marginTop: 0, padding: 0 }}>
          <Anno annotation={f.anno} status={f.anno.status} />
        </div>
      </div>
    </footer>
  );
}
