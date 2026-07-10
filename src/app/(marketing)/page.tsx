import Link from "next/link";
import { home } from "@/content/home";
import { Anno, Stage, EmptySlot } from "@/components/marketing/AnnotationLayer";
import { SectionGate, SpecOnly } from "@/components/marketing/CanvasGates";

/**
 * Marketing homepage — the ten-stage sales flow, ported from
 * docs/lingopure-sales-flow-canvas.html. Draft copy is real (so reviewers
 * react to actual messaging); the explainer boxes + stage spine + empty
 * slots render only in canvas mode (NEXT_PUBLIC_CANVAS_MODE=true).
 */
export default function MarketingHome() {
  const { hero, trust, problem, fork, how, proof, outcomes, testimonials, objections, final } =
    home;
  return (
    <>
      {/* 01 — HERO */}
      <section className="hero">
        <Stage>{hero.stage}</Stage>
        <div className="wrap">
          <Anno annotation={hero.anno} status={hero.anno.status} />
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>{hero.h1}</h1>
          <p className="lede">{hero.lede}</p>
          <div className="ctas">
            {hero.ctas.map((c) => (
              <Link
                key={c.href + c.label}
                href={c.href}
                className={`btn btn--lg${c.ghost ? " btn--ghost" : ""}`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <p className="micro">{hero.micro}</p>
        </div>
      </section>

      {/* 02 — TRUST (empty today: no consented logos, no sourced stat →
          absent from clean-view DOM via SectionGate) */}
      <SectionGate fill="empty">
        <section className="trust">
          <Stage>{trust.stage}</Stage>
          <div className="wrap trustin">
            {(() => {
              const consented = trust.logos.filter((l) => l.consent);
              return consented.length > 0 ? (
                <div className="logos">
                  {consented.map((l) => (
                    <span key={l.name}>{l.name}</span>
                  ))}
                </div>
              ) : (
                <EmptySlot title={trust.logosSlot.title}>
                  {trust.logosSlot.note}
                </EmptySlot>
              );
            })()}
            {trust.statValue ? (
              <div className="stat">
                <b>{trust.statValue}</b>
                {trust.statLabel}
              </div>
            ) : (
              <EmptySlot title={trust.statSlot.title}>
                {trust.statSlot.note}
              </EmptySlot>
            )}
          </div>
        </section>
        <div className="wrap" style={{ paddingTop: 18 }}>
          <Anno annotation={trust.anno} status={trust.anno.status} />
        </div>
      </SectionGate>

      {/* 03 — PROBLEM */}
      <section id="problem" className="tight" style={{ paddingTop: 56 }}>
        <Stage>{problem.stage}</Stage>
        <div className="wrap">
          <p className="eyebrow">{problem.eyebrow}</p>
          <h2 style={{ maxWidth: "20ch", marginBottom: 36 }}>{problem.h2}</h2>
          <Anno annotation={problem.anno} status={problem.anno.status} />
          <div className="problems">
            <blockquote className="problem">
              &ldquo;{problem.quote.text}&rdquo;
              {problem.quote.attribution ? (
                <cite>{problem.quote.attribution}</cite>
              ) : null}
            </blockquote>
            {problem.slots.map((s) => (
              <EmptySlot key={s.title} title={s.title}>
                {s.note}
              </EmptySlot>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — FORK */}
      <section id="fork">
        <Stage>{fork.stage}</Stage>
        <div className="wrap">
          <Anno annotation={fork.anno} status={fork.anno.status} />
          <div className="fork">
            {fork.cards.map((card) => (
              <div className="card" key={card.tag}>
                <span className="tag">{card.tag}</span>
                <h3>{card.h3}</h3>
                <p>{card.p}</p>
                <Link href={card.cta.href} className="btn">
                  {card.cta.label}
                </Link>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <Anno annotation={fork.annoConfirm} status={fork.annoConfirm.status} />
          </div>
        </div>
      </section>

      {/* 05 — HOW */}
      <section id="how" style={{ borderTop: "1px solid var(--line)" }}>
        <Stage>{how.stage}</Stage>
        <div className="wrap">
          <Anno annotation={how.anno} status={how.anno.status} />
          <p className="eyebrow">{how.eyebrow}</p>
          <h2 style={{ maxWidth: "16ch", marginBottom: 44 }}>{how.h2}</h2>
          <div className="steps">
            {how.steps.map((s) => (
              <div className="step" key={s.num}>
                <div className="stepnum">{s.num}</div>
                <h3>{s.h3}</h3>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 06 — PROOF */}
      <section id="proof" className="proof">
        <Stage>{proof.stage}</Stage>
        <div className="wrap">
          <Anno annotation={proof.anno} status={proof.anno.status} />
          <div className="proofgrid">
            <div>
              <p className="eyebrow">{proof.eyebrow}</p>
              <h2 style={{ marginBottom: 22 }}>{proof.h2}</h2>
              <p className="lede" style={{ marginBottom: 26 }}>
                {proof.lede}
              </p>
              <Link href={proof.cta.href} className="btn">
                {proof.cta.label}
              </Link>
            </div>
            <SpecOnly>
              <div className="reportframe">
                <EmptySlot title={proof.slot.title} plain>
                  {proof.slot.note}
                </EmptySlot>
              </div>
            </SpecOnly>
          </div>
        </div>
      </section>

      {/* 07 — OUTCOMES */}
      <section id="outcomes">
        <Stage>{outcomes.stage}</Stage>
        <div className="wrap">
          <Anno annotation={outcomes.anno} status={outcomes.anno.status} />
          <p className="eyebrow">{outcomes.eyebrow}</p>
          <h2 style={{ maxWidth: "18ch", marginBottom: 44 }}>{outcomes.h2}</h2>
          <div className="outcomes">
            <div className="outcol">
              <h3>{outcomes.company.h3}</h3>
              <ul>
                {outcomes.company.items.map((it) => (
                  <li key={it.b}>
                    <b>{it.b}</b>
                    <span>{it.span}</span>
                  </li>
                ))}
              </ul>
            </div>
            <SpecOnly>
              <div className="outcol">
                <h3>{outcomes.individual.h3}</h3>
                <EmptySlot title={outcomes.individual.slot.title}>
                  {outcomes.individual.slot.note}
                </EmptySlot>
              </div>
            </SpecOnly>
          </div>
        </div>
      </section>

      {/* 08 — TESTIMONIALS (empty: three pending slots → absent from clean) */}
      <SectionGate fill="empty">
        <section style={{ borderTop: "1px solid var(--line)" }}>
          <Stage>{testimonials.stage}</Stage>
          <div className="wrap">
            <Anno annotation={testimonials.anno} status={testimonials.anno.status} />
            <p className="eyebrow">{testimonials.eyebrow}</p>
            <h2 style={{ marginBottom: 40 }}>{testimonials.h2}</h2>
            <div className="tgrid">
              {testimonials.slots.map((s) => (
                <EmptySlot key={s.title} title={s.title}>
                  {s.note}
                </EmptySlot>
              ))}
            </div>
          </div>
        </section>
      </SectionGate>

      {/* 09 — OBJECTIONS (empty: six questions, zero answers → absent from
          clean. Six rows opening into nothing is a broken interaction, not an
          unfinished section. Do NOT ship placeholder answers.) */}
      <SectionGate fill="empty">
        <section style={{ background: "var(--teal-soft)" }}>
          <Stage>{objections.stage}</Stage>
          <div className="wrap">
            <Anno annotation={objections.anno} status={objections.anno.status} />
            <p className="eyebrow">{objections.eyebrow}</p>
            <h2 style={{ marginBottom: 38 }}>{objections.h2}</h2>
            <div className="faq">
              {objections.faqs.map((f) => (
                <details key={f.q} open={"open" in f ? Boolean(f.open) : undefined}>
                  <summary>{f.q}</summary>
                  <div className="body">
                    <EmptySlot title={f.answer.title}>{f.answer.note}</EmptySlot>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </SectionGate>

      {/* 10 — FINAL */}
      <section id="final" className="final">
        <Stage>{final.stage}</Stage>
        <div className="wrap">
          <Anno annotation={final.anno} status={final.anno.status} />
          <h2>{final.h2}</h2>
          <p>{final.p}</p>
          <Link href={final.cta.href} className="btn btn--lg">
            {final.cta.label}
          </Link>
          <p className="micro" style={{ marginTop: 22, color: "#7c8f92" }}>
            {final.microPrefix}
            <Link href={final.microLink.href} style={{ color: "#9fb4b7" }}>
              {final.microLink.label}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
