"use client";

import Link from "next/link";
import { GapRadar } from "@/components/dashboard/gap-radar";
import {
  WALKTHROUGH_STEPS,
  SAMPLE_SKILLS,
  SAMPLE_PLAN,
  STEP_MS,
} from "@/components/quick-walkthrough/content";
import { useWalkthroughPlayer } from "@/components/quick-walkthrough/use-player";
import { StepThumb } from "@/components/quick-walkthrough/StepThumb";

/**
 * A ~30-second auto-advancing preview of the sandbox flow (signup → voice
 * discovery → skill profile → plan), for a visitor who wants to see the
 * process without spending the ~30 minutes to run their own assessment.
 *
 * Illustrative only — the skill profile below is sample data, never a real
 * student's. Reuses the real GapRadar component (not a mockup) so the shape
 * shown matches what actually renders on /dashboard.
 *
 * App-chrome (navy/gold Tailwind) variant. The marketing-canvas equivalent
 * lives at src/components/marketing/QuickWalkthrough.tsx and shares this
 * content + player state via src/components/quick-walkthrough/.
 */
export function QuickWalkthrough() {
  const { started, start, index, step, playing, finished, reducedMotion, goTo, replay, togglePlaying } =
    useWalkthroughPlayer();

  return (
    <section
      aria-label="30-second preview of the sandbox assessment"
      className="rounded-xl border border-cream bg-paper p-5 shadow-sm sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
          Watch how it works · 30 seconds
        </p>
        {started && !reducedMotion && (
          <button
            type="button"
            onClick={togglePlaying}
            disabled={finished}
            className="min-h-11 min-w-11 rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-mist disabled:opacity-40"
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>

      {!started ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex gap-2" aria-hidden="true">
            {WALKTHROUGH_STEPS.map((s, i) => (
              <span
                key={s.title}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream bg-mist text-navy"
              >
                <StepThumb index={i} size={18} />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={start}
            className="flex min-h-14 items-center gap-3 rounded-full bg-navy px-7 py-3 text-base font-medium text-paper hover:bg-navy-deep"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs" aria-hidden="true">
              ▶
            </span>
            Watch the 30-second demo
          </button>
          <p className="max-w-sm text-sm text-mute">
            See the whole flow — signup, talking to Aria, your skill profile, your plan — before you
            try it yourself.
          </p>
        </div>
      ) : (
        <>
          {/* Progress segments */}
          <div className="mb-6 grid grid-cols-4 gap-2" role="tablist" aria-label="Preview steps">
            {WALKTHROUGH_STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${s.tag}: ${s.title}`}
                onClick={() => goTo(i)}
                className="flex min-h-11 flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    i === index ? "border-gold text-gold bg-paper" : "border-cream text-mute bg-mist"
                  }`}
                >
                  <StepThumb index={i} size={16} />
                </span>
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-cream">
                  <span
                    className="block h-full rounded-full bg-teal transition-all"
                    style={{
                      width: i < index || finished ? "100%" : i === index ? "100%" : "0%",
                      transitionDuration:
                        i === index && playing && !reducedMotion ? `${STEP_MS}ms` : "200ms",
                      transitionTimingFunction: "linear",
                    }}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-gold">
                {step.tag}
              </p>
              <h3 className="mb-2 font-serif text-2xl text-navy">{step.title}</h3>
              <p className="text-base leading-relaxed text-mute">{step.body}</p>
            </div>

            <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-mist p-4">
              <StepVisual index={index} />
            </div>
          </div>

          {finished && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-cream pt-5">
              <p className="text-base text-mute">
                That&apos;s the whole idea — it&apos;s free to try yourself.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={replay}
                  className="min-h-11 rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
                >
                  Watch again
                </button>
                <Link
                  href="/signup"
                  className="min-h-11 rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
                >
                  Start your real assessment
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StepVisual({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="w-full max-w-xs rounded-lg border border-cream bg-paper p-5 shadow-sm">
          <p className="mb-4 font-serif text-lg text-navy">
            LingoPure<span className="text-gold">.</span>
          </p>
          <div className="space-y-3">
            <div className="h-9 rounded border border-cream bg-mist" aria-hidden />
            <div className="h-9 rounded border border-cream bg-mist" aria-hidden />
            <div className="h-9 rounded bg-navy" aria-hidden />
          </div>
        </div>
      );
    case 1:
      return (
        <div className="w-full max-w-xs space-y-3">
          <ChatBubble from="aria" text="What's your role, and who do you speak English with most?" />
          <ChatBubble from="you" text="I lead a client-facing ops team — mostly calls and email." />
          <ChatBubble from="aria" text="Got it. Let's hear how that sounds in a live exchange…" />
        </div>
      );
    case 2:
      return (
        <div className="w-full">
          <GapRadar skills={SAMPLE_SKILLS} size={220} />
          <p className="mt-1 text-center text-xs text-mute">Sample data — illustrative only</p>
        </div>
      );
    case 3:
    default:
      return (
        <div className="w-full max-w-xs space-y-2">
          {SAMPLE_PLAN.map((row) => (
            <div
              key={row.week}
              className="rounded-md border border-cream bg-paper px-3 py-2.5"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-gold">
                {row.week}
              </p>
              <p className="text-sm text-navy">{row.focus}</p>
            </div>
          ))}
          <p className="pt-1 text-center text-xs text-mute">Sample plan — illustrative only</p>
        </div>
      );
  }
}

function ChatBubble({ from, text }: { from: "aria" | "you"; text: string }) {
  const isAria = from === "aria";
  return (
    <div className={`flex ${isAria ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isAria ? "bg-paper text-navy border border-cream" : "bg-teal text-paper"
        }`}
      >
        <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wider opacity-70">
          {isAria ? "Aria" : "You"}
        </p>
        {text}
      </div>
    </div>
  );
}
