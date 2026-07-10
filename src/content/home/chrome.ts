/** Nav + Footer content — structural chrome, ready. Kept in the content
 *  layer so every visitor-facing string is traceable to content/. */
import type { ContentBlock } from "@/content/types";

export interface NavLink {
  labelKey: string;
  href: string;
}

export interface NavData {
  links: NavLink[];
  ctaKey: string;
  ctaHref: string;
}

export interface FooterData {
  taglineKey: string;
  links: NavLink[];
  /** Discreet investor/board entry point — footer only, per non-goals. */
  companyKey: string;
  companyHref: string;
  rightsKey: string;
}

export const navBlock: ContentBlock<NavData> = {
  id: "home.nav",
  status: "ready",
  data: {
    links: [
      { labelKey: "mkt.nav.method", href: "/method" },
      { labelKey: "mkt.nav.forCompanies", href: "/for-companies" },
      { labelKey: "mkt.nav.forIndividuals", href: "/for-individuals" },
      { labelKey: "mkt.nav.demo", href: "/demo" },
    ],
    ctaKey: "mkt.nav.bookDemo",
    ctaHref: "/book-a-demo",
  },
};

export const footerBlock: ContentBlock<FooterData> = {
  id: "home.footer",
  status: "ready",
  data: {
    taglineKey: "mkt.footer.tagline",
    links: [
      { labelKey: "mkt.footer.method", href: "/method" },
      { labelKey: "mkt.footer.privacy", href: "/privacy" },
      { labelKey: "mkt.footer.terms", href: "/terms" },
    ],
    companyKey: "mkt.footer.company",
    companyHref: "/company",
    rightsKey: "mkt.footer.rights",
  },
};
