import { DemoBookingForm } from "./demo-booking-form";

const CAPABILITIES = [
  {
    icon: "🎙",
    title: "AI Voice Discovery",
    body: "A 20–35 minute conversational session with Aria that surfaces fluency, role context, and target level — before a single class.",
  },
  {
    icon: "📊",
    title: "CEFR Assessment Battery",
    body: "Speaking, listening, reading, and writing tasks scored against LP-18 micro-bands — not just a level label, but a precise placement.",
  },
  {
    icon: "🎯",
    title: "LP-18 Gap Radar",
    body: "A visual skill profile with bilingual evidence — exactly what's holding each learner back, mapped to what the role demands.",
  },
  {
    icon: "👩‍🏫",
    title: "Live Classes (1:1 + Group)",
    body: "Real teachers in ClassIn — role-targeted curriculum, not generic content. Every class closes a specific gap identified by the assessment.",
  },
  {
    icon: "📈",
    title: "Progress + Certification",
    body: "LP-18 re-measurement as learners progress. CEFR certification via TrackTest. Monthly reports your board can read.",
  },
  {
    icon: "🏢",
    title: "Employer Console",
    body: "Cohort roll-ups by department and role. Individual gap tracking. Admin tools for staff import, CSV roster, and subscription management.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Submit your team's details",
    body: "A few questions about your organisation, your team's English baseline, and what you're looking for.",
  },
  {
    num: "02",
    title: "LP prepares a tailored walkthrough",
    body: "We map the full LingoPure service to your org — the assessment depth, the reporting, the class format, and a proposal for your team.",
  },
  {
    num: "03",
    title: "Live demo with your team",
    body: "A staff-led walkthrough — not a sales call. We show you exactly what your team would experience, end to end.",
  },
];

const FAQ = [
  {
    q: "What happens after I submit?",
    a: "A member of the LingoPure team will review your details and reach out within one business day to confirm a time for your walkthrough.",
  },
  {
    q: "Is this a sales call?",
    a: "No. It's a staff-led walkthrough of the full LingoPure service — the assessment, the reporting, the class format — mapped to your team's specific needs. No pressure, no commitment.",
  },
  {
    q: "How long does the demo take?",
    a: "Usually 30–45 minutes. We walk through the service offering, answer your questions, and discuss what a rollout for your team would look like.",
  },
  {
    q: "Can I bring my whole team?",
    a: "Absolutely. The demo is designed for decision-makers and L&D leads, but the more people who see it, the better the conversation.",
  },
];

export default function BookADemoPage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">For companies</p>
          <h1>See the full LingoPure service mapped to your team</h1>
          <p className="lede">
            This isn&apos;t a sales call. It&apos;s a staff-led walkthrough of everything
            LingoPure delivers — the assessment depth, the reporting, the class format —
            mapped to your organisation&apos;s English goals.
          </p>
          <div className="ctas">
            <a href="#intake-form" className="btn btn--lg">
              Start the walkthrough
            </a>
            <a href="/for-companies" className="btn btn--ghost btn--lg">
              Learn more about LingoPure for teams
            </a>
          </div>
        </div>
      </section>

      {/* ── What LingoPure delivers ─────────────────────────────────── */}
      <section className="proof">
        <div className="wrap">
          <p className="eyebrow">What you&apos;ll see in the demo</p>
          <h2 style={{ marginBottom: 44 }}>The full LingoPure offering</h2>
          <div className="cap-grid">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="card">
                <span style={{ fontSize: 32 }}>{c.icon}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section>
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2 style={{ marginBottom: 12 }}>Three steps, and the first one takes two minutes</h2>
          <p className="lede">
            Submit your team&apos;s details below. We&apos;ll prepare a tailored walkthrough
            and reach out to confirm a time.
          </p>
          <div className="steps" style={{ marginTop: 44 }}>
            {STEPS.map((s) => (
              <div key={s.num} className="step">
                <span className="stepnum">{s.num}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The intake form ─────────────────────────────────────────── */}
      <section id="intake-form" className="proof">
        <div className="wrap">
          <p className="eyebrow">Get started</p>
          <h2 style={{ marginBottom: 12 }}>Tell us about your team</h2>
          <p className="lede">
            A few questions so we can prepare a walkthrough that&apos;s relevant to your
            organisation — not a generic pitch.
          </p>
          <div style={{ marginTop: 44, maxWidth: 720 }}>
            <DemoBookingForm />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="faq" style={{ margin: "0 auto" }}>
        <div className="wrap">
          <p className="eyebrow">Questions</p>
          <h2 style={{ marginBottom: 32 }}>Before you submit</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <div className="body">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="final">
        <div className="wrap">
          <h2>Ready to see what LingoPure can do for your team?</h2>
          <p>
            Submit your details above, and we&apos;ll reach out within one business day
            to confirm your walkthrough.
          </p>
        </div>
      </section>
    </>
  );
}