export const metadata = {
  title: "Privacy Policy — LingoPure",
  description:
    "How LingoPure collects, uses, retains, and protects learner data, and the rights you have over it.",
};

const SECTIONS = [
  {
    h: "1. What we collect",
    p: "Account details (name, email, employer/classroom association, role), your learning activity (lesson submissions, scores, progress), and, where you use voice practice, audio you record during a session. We also collect standard technical data (device, browser, IP) for security and reliability.",
  },
  {
    h: "2. How we use it",
    p: "To deliver the service: generate personalised lessons, score your work, track progress against your role baseline, and — for classroom and enterprise plans — report cohort progress to your administrator. We use contact details for transactional email (sign-in, password reset, lesson reminders).",
  },
  {
    h: "3. AI processing",
    p: "Lesson generation and scoring use third-party AI providers accessed through paid APIs under terms that exclude training on customer data. Voice samples used for pronunciation feedback are processed in-flight and not retained beyond the session unless you explicitly save a recording.",
  },
  {
    h: "4. Data retention",
    p: "We keep your account and learning data for as long as your account is active. Anonymous/trial session data is purged on a short schedule. You can request deletion of your account and associated data at any time (see Your rights).",
  },
  {
    h: "5. Third parties",
    p: "We share data only with processors required to run the service (hosting, database, email delivery, AI inference) under data-processing agreements. We do not sell your data. For classroom/enterprise plans, your administrator can see your progress within their organisation. Your information is stored and processed outside Australia: our database is hosted in Tokyo, Japan, and our hosting, email and AI providers operate overseas, including in the United States. We take reasonable steps to ensure overseas recipients protect your information, but we cannot control their handling to the same degree as our own.",
  },
  {
    h: "6. Your rights",
    p: "You can access, correct, export, or delete your personal data. Email the contact below and we will action verified requests within the period required by applicable law.",
  },
  {
    h: "7. Security",
    p: "Data is encrypted in transit and at rest, access is restricted by role, and authentication is handled by a dedicated identity provider. No system is perfectly secure, but we apply industry-standard safeguards.",
  },
  {
    h: "8. Contact",
    p: "Questions or requests: dennis@corporateaisolutions.com.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <header className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Privacy
          </p>
          <h1 className="mb-4 font-serif text-4xl leading-tight text-navy sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-mute">
            What this page is: how LingoPure handles your data. What to do here:
            understand what we collect and the control you have. Why it matters:
            you and your employer can trust that practice data stays private and
            is never sold or used to train models.
          </p>
          <p className="mt-3 text-sm text-mute/70">Last updated: 24 May 2026</p>
        </header>

        <div className="mb-8 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <strong>Template notice:</strong> this is a baseline privacy policy for
          LingoPure. Have it reviewed by legal counsel for your jurisdiction
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
