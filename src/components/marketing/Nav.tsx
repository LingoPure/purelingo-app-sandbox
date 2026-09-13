"use client";

import React from "react";
import Link from "next/link";
import { home } from "@/content/home";
import { LanguagePill } from "@/components/i18n/language-pill";
import { useMarketingI18n } from "./i18n-context";
import { MktMobileMenu } from "./MktMobileMenu";

export function Nav() {
  const { lang, t } = useMarketingI18n();
  const links = home.nav.links.map((l) => ({
    ...l,
    label: t(`mkt.nav.${linkKey(l.href)}`, l.label),
  }));
  const ctaLabel = t("mkt.nav.cta", home.nav.cta.label);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`mkt-header ${isScrolled ? "scrolled" : ""}`}>
      <nav>
        <div className="navin">
          <div className="mark">
            LingoPure<span>.</span>
          </div>
          <div className="navlinks">
            {links.map((l) => (
              <Link key={l.href + l.label} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            <Link href={home.nav.cta.href} className="btn">
              {ctaLabel}
            </Link>
            <LanguagePill current={lang} tone="dark" />
          </div>
          <MktMobileMenu
            links={links.map((l) => ({ ...l }))}
            cta={{ label: ctaLabel, href: home.nav.cta.href }}
          />
        </div>
      </nav>
    </header>
  );
}

function linkKey(href: string): string {
  switch (href) {
    case "/for-companies":
      return "forCompanies";
    case "/for-individuals":
      return "forIndividuals";
    case "/method":
      return "method";
    case "/#proof":
      return "theReport";
    default:
      return "forCompanies";
  }
}