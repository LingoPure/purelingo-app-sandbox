import type { Metadata } from "next";
import { LciBridgeClient } from "./lci-bridge-client";

export const metadata: Metadata = {
  title: "LCI Bridge — Live Interpreter | LingoPure",
  description:
    "Real-time AI interpreter. Speak your language, they hear theirs — one device, live, across English and Mandarin.",
};

export default function LciBridgePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Explanatory header (what it is / what to do / why it matters) */}
      <header className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.24em] text-gold">
          LingoPure · LCI Bridge
        </p>
        <h1 className="font-serif text-3xl text-navy sm:text-4xl">
          Live AI Interpreter
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink">
          Put one phone or laptop between you and the person you&apos;re meeting.
          Pick the language you&apos;re about to speak, hold the button, and talk.
          They hear it spoken back in their language within a couple of seconds —
          and the whole conversation is logged as you go.
        </p>
        <p className="mt-2 text-sm text-mute">
          Built for cross-border business conversations. This demo runs English
          ⇄ Mandarin.
        </p>
      </header>

      <LciBridgeClient />

      <p className="mt-10 text-center text-xs text-mute">
        Turn-based interpretation · powered by LingoPure&apos;s voice engine
      </p>
    </main>
  );
}
