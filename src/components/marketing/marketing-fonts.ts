/**
 * Marketing-only type stack — matches the LingoPure production site
 * (Lato body + Montserrat display, the exact fonts Prod loads from Google
 * Fonts). Scoped to the marketing route group — the product app keeps its
 * own Jakarta/DM fonts. Exposed as CSS variables consumed by marketing.css.
 *
 * Vietnamese subsets fit Prod's public content (VI is a primary locale).
 */
import {
  JetBrains_Mono,
  Lato,
  Montserrat,
} from "next/font/google";

const display = Montserrat({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const body = Lato({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-mkt",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600"],
  display: "swap",
});

/** Combined CSS-variable className to apply on the `.mkt` root. */
export const marketingFontVars = `${display.variable} ${body.variable} ${mono.variable}`;