import Link from "next/link";

export const metadata = {
  title: "Contact — LingoPure",
  description:
    "Get in touch with the LingoPure team — product questions, pilots, classroom rollouts, and enterprise enquiries.",
};

const CHANNELS = [
  {
    label: "General & product",
    value: "dennis@corporateaisolutions.com",
    href: "mailto:dennis@corporateaisolutions.com?subject=LingoPure%20enquiry",
    note: "Questions about the product, pilots, or partnerships.",
  },
  {
    label: "Enterprise & classrooms",
    value: "dennis@corporateaisolutions.com",
    href: "mailto:dennis@corporateaisolutions.com?subject=LingoPure%20Enterprise",
    note: "Cohort rollouts, SSO, BYOK, and custom language packs.",
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <header className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Contact
          </p>
          <h1 className="mb-4 font-serif text-4xl leading-tight text-navy sm:text-5xl">
            Talk to us
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-mute">
            What this page is: how to reach the LingoPure team. What to do here:
            pick the channel that fits your enquiry and email us. Why it matters:
            we set up pilots and classroom rollouts on a call so the roster and
            role baselines are configured correctly from day one.
          </p>
        </header>

        <section className="space-y-4">
          {CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="block rounded-xl border border-cream bg-cream/20 p-5 transition hover:bg-mist"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {c.label}
              </p>
              <p className="mt-1 font-medium text-navy">{c.value}</p>
              <p className="mt-1 text-sm text-mute">{c.note}</p>
            </a>
          ))}
        </section>

        <p className="mt-8 text-center text-sm text-mute">
          We aim to reply within two business days.{" "}
          <Link href="/pricing" className="font-medium text-navy hover:underline">
            See pricing
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="font-medium text-navy hover:underline">
            start a free trial
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
