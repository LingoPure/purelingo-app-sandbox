import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      <header className="border-b border-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-serif text-2xl text-navy">
            LingoPure<span className="text-gold">.</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            AI-First Business English Platform
          </p>
          <h1 className="font-serif text-5xl leading-tight text-navy md:text-6xl">
            Close the language gap your team <em className="text-teal">actually has</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-mute">
            Voice-led AI assessment, gamified micro-learning between live ClassIn
            sessions, and CEFR certification — wrapped into one measurable
            outcomes platform for B2B language training.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-navy px-6 py-3 text-base font-medium text-paper hover:bg-navy-deep"
            >
              Start discovery session
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-navy/20 px-6 py-3 text-base font-medium text-navy hover:bg-mist"
            >
              I already have an account
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            tag="01"
            title="AI Voice Discovery"
            body="A 20–35 min conversational assessment surfaces fluency, role, and target level — before a single class."
          />
          <FeatureCard
            tag="02"
            title="ClassIn, Embedded"
            body="Live virtual classrooms run inside LingoPure — no context switching, no separate logins, full session analytics back."
          />
          <FeatureCard
            tag="03"
            title="Measurable Gap, Closing"
            body="Six-dimension gap score updates after every micro-lesson and live class. CEFR certification via TrackTest."
          />
        </div>
      </main>

      <footer className="border-t border-cream py-8">
        <div className="mx-auto max-w-6xl px-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-mute">
          LingoPure · Strategic Platform Demo · 2026
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6 shadow-sm">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-gold">
        {tag}
      </div>
      <h3 className="mb-2 font-serif text-xl text-navy">{title}</h3>
      <p className="text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}
