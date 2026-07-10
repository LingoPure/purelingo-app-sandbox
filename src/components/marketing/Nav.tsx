import Link from "next/link";
import { home } from "@/content/home";
import { MktMobileMenu } from "./MktMobileMenu";

/** Marketing top nav (sticky). Desktop shows inline links; ≤860px collapses to
 *  a hamburger drawer (MktMobileMenu). */
export function Nav() {
  const { links, cta } = home.nav;
  return (
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
          <Link href={cta.href} className="btn">
            {cta.label}
          </Link>
          <MktMobileMenu links={links.map((l) => ({ ...l }))} cta={{ ...cta }} />
        </div>
      </div>
    </nav>
  );
}
