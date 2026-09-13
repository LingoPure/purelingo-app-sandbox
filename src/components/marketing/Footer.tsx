import Link from "next/link";
import { home } from "@/content/home";
import { dict, DEFAULT_LANGUAGE, type LanguageCode } from "@/lib/i18n/dictionary";
import { Anno } from "./AnnotationLayer";

const FOOTER_LINK_KEYS: Record<string, string> = {
  "/privacy": "mkt.footer.privacy",
  "/terms": "mkt.footer.terms",
  "/contact": "mkt.footer.contact",
  "/company": "mkt.footer.company",
  "/book-a-demo": "mkt.footer.bookDemo",
};

export function Footer({ lang }: { lang: LanguageCode }) {
  const f = home.footer;
  const year = new Date().getFullYear();
  const t = (key: string, en?: string) =>
    dict(lang)[key] ?? dict(DEFAULT_LANGUAGE)[key] ?? en ?? key;

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footin">
          <div>
            <Link href="/" className="mark" aria-label="Home">
              LingoPure<span>.</span>
            </Link>
            <p className="footer-note">{t("mkt.footer.note", "Business English for Vietnam & Southeast Asia")}</p>
            <div className="legal">
              {f.legalLeft.map((line, i) => (
                <span key={i}>
                  {t(`mkt.footer.legalL${i + 1}`, line)}
                  {i < f.legalLeft.length - 1 ? <br /> : null}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="footer-col-title">{t("mkt.footer.colCompany", "Company")}</h2>
            <ul className="footer-col">
              {f.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>
                    {t(FOOTER_LINK_KEYS[l.href] ?? "", l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="footer-col-title">{t("mkt.footer.colContract", "Contract")}</h2>
            <p className="footer-contact">info@lingopure.com</p>
            <h2 className="footer-col-title" style={{ marginTop: 20 }}>
              {t("mkt.footer.colLanguages", "Languages")}
            </h2>
            <p className="footer-contact">{f.langs}</p>
          </div>
        </div>
        <div className="legal" style={{ marginTop: 24 }}>
          © {year} LingoPure. {t("mkt.footer.allRights", "All rights reserved.")}
        </div>
        <div className="wrap" style={{ marginTop: 0, padding: 0 }}>
          <Anno annotation={f.anno} status={f.anno.status} />
        </div>
      </div>
    </footer>
  );
}