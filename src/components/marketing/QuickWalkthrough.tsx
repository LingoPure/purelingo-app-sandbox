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

/**
 * Marketing-canvas variant of the ~30-second sandbox preview — styled with
 * the .mkt design tokens (marketing.css) rather than the app's Tailwind
 * navy/gold classes, so it sits natively on the public homepage. Shares
 * content + player state with the /demo-page variant via
 * src/components/quick-walkthrough/. Always renders (not gated by
 * SectionGate/SpecOnly) — this is finished, working product, not draft copy
 * under review.
 */
export function MktQuickWalkthrough() {
  const { index, step, playing, finished, reducedMotion, goTo, replay, togglePlaying, pause, resume } =
    useWalkthroughPlayer();

  return (
    <div
      className="preview-card"
      aria-label="30-second preview of the sandbox assessment"
      onMouseEnter={() => !reducedMotion && !finished && pause()}
      onMouseLeave={() => !reducedMotion && !finished && resume()}
    >
      <div className="preview-head">
        <p className="eyebrow" style={{ marginBottom: 0 }}>
          Watch how it works · 30 seconds
        </p>
        {!reducedMotion && (
          <button
            type="button"
            onClick={togglePlaying}
            disabled={finished}
            className="preview-play"
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>

      <div className="preview-bars" role="tablist" aria-label="Preview steps">
        {WALKTHROUGH_STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${s.tag}: ${s.title}`}
            onClick={() => goTo(i)}
            className="preview-bar"
          >
            <span className="preview-bar-track">
              <span
                className="preview-bar-fill"
                style={{
                  width: i < index || finished ? "100%" : i === index ? "100%" : "0%",
                  transition:
                    i === index && playing && !reducedMotion
                      ? `width ${STEP_MS}ms linear`
                      : "width 200ms linear",
                }}
              />
            </span>
          </button>
        ))}
      </div>

      <div className="preview-body">
        <div>
          <p className="preview-step-tag">{step.tag}</p>
          <h3 className="preview-step-title">{step.title}</h3>
          <p className="preview-step-body">{step.body}</p>
        </div>
        <div className="preview-visual">
          <StepVisual index={index} />
        </div>
      </div>

      {finished && (
        <div className="preview-done">
          <p>That&apos;s the whole idea — it&apos;s free to try yourself.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" onClick={replay} className="btn btn--ghost">
              Watch again
            </button>
            <Link href="/signup" className="btn">
              Start your real assessment
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StepVisual({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="preview-mock-signup">
          <p className="brand">LingoPure.</p>
          <div className="field" aria-hidden />
          <div className="field" aria-hidden />
          <div className="cta" aria-hidden />
        </div>
      );
    case 1:
      return (
        <div className="preview-chat">
          <ChatBubble from="aria" text="What's your role, and who do you speak English with most?" />
          <ChatBubble from="you" text="I lead a client-facing ops team — mostly calls and email." />
          <ChatBubble from="aria" text="Got it. Let's hear how that sounds in a live exchange…" />
        </div>
      );
    case 2:
      return (
        <div style={{ width: "100%" }}>
          <GapRadar skills={SAMPLE_SKILLS} size={200} />
          <p className="preview-caption">Sample data — illustrative only</p>
        </div>
      );
    case 3:
    default:
      return (
        <div className="preview-mock-plan">
          {SAMPLE_PLAN.map((row) => (
            <div key={row.week} className="preview-plan-row">
              <p className="week">{row.week}</p>
              <p className="focus">{row.focus}</p>
            </div>
          ))}
          <p className="preview-caption">Sample plan — illustrative only</p>
        </div>
      );
  }
}

function ChatBubble({ from, text }: { from: "aria" | "you"; text: string }) {
  const isAria = from === "aria";
  return (
    <div className={`preview-bubble ${isAria ? "aria" : "you"}`}>
      <span className="who">{isAria ? "Aria" : "You"}</span>
      {text}
    </div>
  );
}
