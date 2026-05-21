import Link from "next/link";

export const metadata = {
  title: "Languages — LingoPure",
  description:
    "Supported languages on LingoPure. Tier-1 with premium neural voice for pronunciation feedback; tier-2 with text-first lessons and serviceable voice.",
};

const TIER_1 = [
  "English (UK / US / AU)", "Mandarin Chinese", "Cantonese", "Japanese", "Korean",
  "Spanish (ES / MX / LA)", "Portuguese (PT / BR)", "French (FR / CA)",
  "German", "Italian", "Dutch", "Russian", "Arabic (MSA)", "Turkish", "Hebrew",
  "Hindi", "Bengali", "Tamil", "Indonesian", "Vietnamese", "Thai", "Filipino",
  "Swedish", "Norwegian", "Danish", "Finnish", "Polish",
];

const TIER_2 = [
  "Ukrainian", "Romanian", "Czech", "Hungarian", "Slovak", "Bulgarian",
  "Croatian", "Serbian", "Slovenian", "Greek", "Catalan", "Welsh", "Irish",
  "Persian (Farsi)", "Urdu", "Pashto", "Kurdish", "Armenian", "Georgian",
  "Burmese", "Khmer", "Lao", "Mongolian", "Nepali", "Sinhala",
  "Telugu", "Marathi", "Gujarati", "Punjabi", "Malayalam", "Kannada",
  "Swahili", "Amharic", "Yoruba", "Hausa", "Zulu", "Afrikaans",
  "Maori", "Samoan", "Tongan", "Hawaiian",
  "Malay", "Javanese", "Tagalog", "Cebuano",
  "Kazakh", "Uzbek", "Azerbaijani",
  "Albanian", "Macedonian",
];

export default function LanguagesPage() {
  const total = TIER_1.length + TIER_2.length;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <header className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-3 font-semibold">
            Languages
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-navy leading-tight mb-4">
            {total}+ languages with honest tier separation
          </h1>
          <p className="text-lg text-mute max-w-2xl mx-auto leading-relaxed">
            What this page is: the actual supported language list, with the
            voice-quality tier visible up front. What to do here: check the
            language you&apos;re learning (or teaching) sits in the tier you
            need. Why it matters: every language app advertises 100+
            languages — most have premium quality on 8 and tier-down hard
            on the rest. LingoPure publishes the tier list.
          </p>
        </header>

        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-6 gap-4">
            <h2 className="font-serif text-2xl text-navy">
              Tier 1 &middot; Premium neural voice
            </h2>
            <span className="text-sm text-mute">
              {TIER_1.length} languages
            </span>
          </div>
          <p className="text-mute mb-6 leading-relaxed">
            Native-speaker-quality TTS for lesson playback and pronunciation
            feedback. Voice samples used in practice sessions are processed
            in-flight and not retained after the session ends.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {TIER_1.map((l) => (
              <div
                key={l}
                className="flex items-center gap-2 px-3 py-2 bg-cream/30 border border-cream rounded-md text-sm"
              >
                <span className="text-gold">✓</span>
                <span className="text-ink">{l}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-6 gap-4">
            <h2 className="font-serif text-2xl text-navy">
              Tier 2 &middot; Text-first + serviceable voice
            </h2>
            <span className="text-sm text-mute">
              {TIER_2.length} languages
            </span>
          </div>
          <p className="text-mute mb-6 leading-relaxed">
            Full text-based lessons + spaced-review. Voice playback available
            where the underlying TTS engine reaches an acceptable quality
            bar. Pronunciation feedback is text-anchored on tier-2 languages
            until the voice model graduates.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {TIER_2.map((l) => (
              <div
                key={l}
                className="flex items-center gap-2 px-3 py-2 bg-cream/30 border border-cream rounded-md text-sm"
              >
                <span className="text-mute">○</span>
                <span className="text-ink">{l}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-cream/30 border border-cream p-6 mb-12">
          <h2 className="font-serif text-xl text-navy mb-3">
            Language not listed?
          </h2>
          <p className="text-mute leading-relaxed mb-3">
            Email us with the language and use-case (school, employer
            rollout, personal). We add new languages where the underlying
            neural TTS engine reaches the quality bar and there&apos;s clear
            demand. Most additions ship within a fortnight of first request.
          </p>
          <a
            href="mailto:dennis@corporateaisolutions.com?subject=LingoPure%20language%20request"
            className="inline-flex items-center gap-1 text-navy hover:text-gold underline-offset-4 hover:underline text-sm font-medium"
          >
            Email language request &rarr;
          </a>
        </section>

        <section className="text-center">
          <h2 className="font-serif text-2xl text-navy mb-3">Ready to begin?</h2>
          <p className="text-mute mb-6">
            14-day free trial across all {total}+ languages.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-navy text-paper rounded-md font-semibold hover:bg-navy-deep transition"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 border border-cream text-navy rounded-md font-semibold hover:bg-mist transition"
            >
              See pricing
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
