import Link from "next/link";

export const metadata = {
  title: "About — LingoPure",
  description:
    "LingoPure trains business English for Southeast Asian professionals — calibrated to the role they're hired into, not a generic CEFR ladder. Built by Corporate AI Solutions.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <header className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            About
          </p>
          <h1 className="mb-4 font-serif text-4xl leading-tight text-navy sm:text-5xl">
            Business English, calibrated to the job
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-mute">
            What this page is: who builds LingoPure and why. What to do here:
            decide whether our approach fits your team. Why it matters: most
            language tools teach a generic ladder; LingoPure trains the specific
            English a role actually requires.
          </p>
        </header>

        <section className="space-y-6 text-base leading-relaxed text-ink">
          <div>
            <h2 className="mb-2 font-serif text-2xl text-navy">The problem</h2>
            <p className="text-mute">
              Generic language apps measure progress against a one-size CEFR
              ladder. But a BPO operator, a manufacturing sales rep, and a
              technical specialist each need different English to clear the bar
              their employer cares about. Training to a generic level wastes time
              on the wrong skills.
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-serif text-2xl text-navy">The approach</h2>
            <p className="text-mute">
              LingoPure profiles each learner against the baseline their role
              requires, then generates practice — email sprints, speaking
              scenarios — scaled to close their largest gap. Every exercise is
              scored in real time and feeds a live progress profile, so learners
              and their employers can see the bar being cleared.
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-serif text-2xl text-navy">Who it&apos;s for</h2>
            <p className="text-mute">
              Vietnamese and Southeast Asian professionals working in business
              English, the employers training them, and the schools and RTOs
              running group programmes. Single learners, classrooms, and
              enterprise rollouts are all supported.
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-serif text-2xl text-navy">Who builds it</h2>
            <p className="text-mute">
              LingoPure is built by Corporate AI Solutions. Questions, pilots, or
              partnership enquiries are welcome via the{" "}
              <Link href="/contact" className="font-medium text-navy hover:underline">
                contact page
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mt-14 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 font-semibold text-paper transition hover:bg-navy-deep"
          >
            Start a free trial
          </Link>
        </section>
      </article>
    </main>
  );
}
