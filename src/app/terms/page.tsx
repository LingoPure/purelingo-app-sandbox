export const metadata = {
  title: "Terms of Service — LingoPure",
  description:
    "The terms governing your use of LingoPure — accounts, acceptable use, subscriptions, and liability.",
};

const SECTIONS = [
  {
    h: "1. Acceptance",
    p: "By creating an account or using LingoPure, you agree to these terms. If you're using LingoPure on behalf of an organisation, you confirm you're authorised to bind that organisation.",
  },
  {
    h: "2. The service",
    p: "LingoPure provides AI-assisted business-English training: personalised lessons, writing and speaking practice, scoring, and progress tracking. Features and pricing may change as the product evolves.",
  },
  {
    h: "3. Accounts",
    p: "You're responsible for the security of your account and for activity under it. Classroom and enterprise learners are provisioned by their administrator and are subject to that organisation's policies in addition to these terms.",
  },
  {
    h: "4. Acceptable use",
    p: "Don't misuse the service: no unlawful content, no attempts to break or overload the platform, no scraping or reselling, and no uploading content you don't have the right to use. We may suspend accounts that breach these rules.",
  },
  {
    h: "5. Subscriptions & billing",
    p: "Paid plans are billed in advance on the cycle you select. Trials convert to paid unless cancelled before they end. Per-seat plans bill on allocated seats. Fees are non-refundable except where required by law.",
  },
  {
    h: "6. Intellectual property",
    p: "LingoPure and its content remain our property. You retain ownership of the content you submit (your writing, recordings); you grant us the licence needed to process it and deliver the service to you.",
  },
  {
    h: "7. Disclaimer & liability",
    p: "The service is provided “as is”. Scores and feedback are guidance, not a certified qualification. To the extent permitted by law, our liability is limited to the fees you paid in the 12 months before the claim.",
  },
  {
    h: "8. Changes & termination",
    p: "We may update these terms; material changes will be notified. You can stop using the service at any time, and we may suspend or end accounts that breach these terms.",
  },
  {
    h: "9. Governing law & contact",
    p: "These terms are governed by the laws of the operator's jurisdiction. Questions: dennis@corporateaisolutions.com.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <header className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Terms
          </p>
          <h1 className="mb-4 font-serif text-4xl leading-tight text-navy sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-mute">
            What this page is: the rules for using LingoPure. What to do here:
            read them before relying on the service. Why it matters: they set
            expectations on accounts, billing, and what the scores do and
            don&apos;t guarantee.
          </p>
          <p className="mt-3 text-sm text-mute/70">Last updated: 24 May 2026</p>
        </header>

        <div className="mb-8 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <strong>Template notice:</strong> this is a baseline terms-of-service
          for LingoPure. Have it reviewed by legal counsel for your jurisdiction
          before relying on it.
        </div>

        <section className="space-y-7">
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 className="mb-2 font-serif text-2xl text-navy">{s.h}</h2>
              <p className="leading-relaxed text-mute">{s.p}</p>
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}
