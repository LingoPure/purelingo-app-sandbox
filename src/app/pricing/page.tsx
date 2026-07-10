import Link from "next/link";

export const metadata = {
  title: "Pricing — LingoPure",
  description:
    "Per-learner pricing for LingoPure. Three tiers — Learner, Classroom, Enterprise. Honest about what's included, what's per-seat, and what's BYOK.",
};

const PLANS = [
  {
    name: "Learner",
    price: "$9",
    period: "/month",
    description: "For a single learner pursuing one or two languages.",
    features: [
      "1 active learner profile",
      "Up to 2 target languages",
      "Daily lesson + spaced-review",
      "Conversation practice (text + voice)",
      "Progress dashboard",
      "Email support",
    ],
    cta: "Start free trial",
    href: "/signup",
    popular: false,
  },
  {
    name: "Classroom",
    price: "$15",
    period: "/seat / month",
    description: "For schools, RTOs, and language programmes with groups of learners.",
    features: [
      "Up to 50 learners per classroom",
      "Unlimited target languages",
      "Teacher dashboard + cohort analytics",
      "Custom vocabulary lists",
      "CEFR alignment + exam prep mode",
      "SIS / CSV roster import",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/signup",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For employers, government, and multi-school deployments.",
    features: [
      "Unlimited learners",
      "Multi-classroom org structure",
      "SSO / SAML",
      "Audit-trail exports",
      "Dedicated success engineer",
      "Custom language packs + vocabulary",
      "BYOK option for AI inference",
    ],
    cta: "Talk to us",
    href: "mailto:dennis@corporateaisolutions.com?subject=LingoPure%20Enterprise",
    popular: false,
  },
];

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes — 14 days on every tier. No credit card on Learner. Classroom and Enterprise trials run on a setup call so we can configure the roster + classroom structure with you.",
  },
  {
    q: "Are prices in AUD?",
    a: "Yes. Australian dollars, ex-GST. International customers billed in their local currency at the prevailing Stripe rate.",
  },
  {
    q: "How does the per-seat Classroom price work?",
    a: "You buy a pool of seats. Adding a learner consumes a seat; removing one frees it. You can over-allocate temporarily (we don't lock anyone out mid-cycle), and we'll email before any tier change rolls forward.",
  },
  {
    q: "What's the BYOK option?",
    a: "Bring Your Own Key. Enterprise customers can plug in their own Anthropic / OpenAI / Google API key, so all AI inference runs on their account. Useful for organisations with existing AI procurement contracts.",
  },
  {
    q: "Are my learners' practice conversations used to train models?",
    a: "No. The AI providers we use are accessed through paid APIs under terms that exclude training on customer data. Voice samples used for pronunciation feedback are processed in-flight and not retained beyond the session.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <header className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-3 font-semibold">
            Pricing
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-navy leading-tight mb-4">
            Honest pricing for language learning
          </h1>
          <p className="text-lg text-mute max-w-2xl mx-auto leading-relaxed">
            What this page is: every LingoPure cost spelled out. What to do
            here: pick the tier that matches you (one learner, a classroom,
            an enterprise rollout). Why it matters: incumbent language apps
            either charge $0 then sell your data, or charge premium per-seat
            but bundle a low-quality voice model. LingoPure does neither.
          </p>
          <p className="text-sm text-mute/70 mt-3">
            AUD ex-GST &middot; Cancel any time
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl bg-cream/30 border-2 p-6 ${
                p.popular
                  ? "border-navy shadow-lg scale-[1.02]"
                  : "border-cream"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-navy text-paper text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <h2 className="text-sm font-semibold text-navy">{p.name}</h2>
              <div className="mt-3 mb-2">
                <span className="font-serif text-4xl text-navy tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-mute ml-1">{p.period}</span>
              </div>
              <p className="text-sm text-mute mb-5">{p.description}</p>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-ink"
                  >
                    <span className="text-gold mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block text-center text-sm font-semibold py-2.5 rounded-md transition-colors ${
                  p.popular
                    ? "bg-navy text-paper hover:bg-navy-deep"
                    : "bg-cream text-navy hover:bg-mist"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </section>

        <section className="max-w-3xl mx-auto mb-12">
          <h2 className="font-serif text-3xl text-navy text-center mb-8">
            Pricing questions, answered
          </h2>
          <div className="space-y-5">
            {FAQ.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-xl bg-cream/20 border border-cream p-5"
              >
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-sm text-ink leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center">
          <h2 className="font-serif text-2xl text-navy mb-3">Ready to start?</h2>
          <p className="text-mute mb-6">
            14-day free trial. Pick a target language and run a real lesson
            before deciding.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-navy text-paper rounded-md font-semibold hover:bg-navy-deep transition"
            >
              Start Free Trial
            </Link>
            <Link
              href="/languages"
              className="inline-flex items-center gap-2 px-6 py-3 border border-cream text-navy rounded-md font-semibold hover:bg-mist transition"
            >
              See the languages
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
