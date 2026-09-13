import React from "react";
import Link from "next/link";
import { home } from "@/content/home";
import { MktMobileMenu } from "./MktMobileMenu";

export function Nav() {
  const { links, cta } = home.nav;
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
            <Link href={cta.href} className="btn">
              {cta.label}
            </Link>
          </div>
          <MktMobileMenu links={links.map((l) => ({ ...l }))} cta={{ ...cta }} />
        </div>
      </nav>
    </header>
  );
}
