/**
 * Marketing-only type stack (matches the sales-flow canvas mockup).
 * Scoped to the marketing route group — the product app keeps its own
 * Jakarta/DM fonts. Exposed as CSS variables consumed by marketing.css.
 *
 * Vietnamese subset loaded where upstream supports it (Bricolage, JetBrains,
 * Newsreader). Instrument Sans has no vietnamese subset upstream, so VI body
 * text falls back — acceptable for an English draft-review canvas; revisit
 * (e.g. Be Vietnam Pro) if VI body rendering matters at ship.
 */
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600", "800"],
  display: "swap",
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-mkt",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600"],
  display: "swap",
});

const quote = Newsreader({
  variable: "--font-quote",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});

/** Combined CSS-variable className to apply on the `.mkt` root. */
export const marketingFontVars = `${display.variable} ${body.variable} ${mono.variable} ${quote.variable}`;
