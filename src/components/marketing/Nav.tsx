import Link from "next/link";
import { home } from "@/content/home";

/** Marketing top nav (sticky). Matches the sales-flow canvas mockup. */
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
        </div>
      </div>
    </nav>
  );
}
