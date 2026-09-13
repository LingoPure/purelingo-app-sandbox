import Link from "next/link";
import type { HomeContent } from "@/content/home";
import type { PublicTestimonial, PublicLogo } from "@/content/resolve";
import { Anno, Stage, EmptySlot } from "@/components/marketing/AnnotationLayer";
import { SectionGate, SpecOnly } from "@/components/marketing/CanvasGates";
import type { LanguageCode } from "@/lib/i18n/dictionary";
import { MarketingHomeCopy } from "./promo-copy";

/**
 * The ten-stage sales-flow homepage. Renders a home-shaped content object —
 * the static source file (public/production), or the row-overlaid object
 * (edits / preview) — plus the row-backed testimonials and logo lists.
 * Presentation only; content comes from the props.
 */
export function MarketingHomeView({
  home,
  testimonials: liveTestimonials = [],
  logos = [],
  lang,
}: {
  home: HomeContent;
  testimonials?: PublicTestimonial[];
  logos?: PublicLogo[];
  lang?: LanguageCode;
}) {
  const copy = new MarketingHomeCopy(lang);
  const { hero, trust, problem, fork, how, proof, outcomes, testimonials, objections, final } =
    home;
  const hasLogos = logos.length > 0;
  const hasTestimonials = liveTestimonials.length > 0;
  return (
    <>
      {/* 01 — HERO */}
      <section className="hero">
        <Stage>{hero.stage}</Stage>
        <div className="wrap">
          <Anno annotation={hero.anno} status={hero.anno.status} />
          <p className="eyebrow">{copy.hero.eyebrow(hero.eyebrow)}</p>
          <h1>{copy.hero.h1(hero.h1)}</h1>
          <p className="lede">{copy.hero.lede(hero.lede)}</p>
          <div className="ctas">
            {hero.ctas.map((c, i) => (
              <Link
                key={c.href + c.label}
                href={c.href}
                className={`btn btn--lg${c.ghost ? " btn--ghost" : ""}`}
              >
                {copy.hero.cta(i, c.label)}
              </Link>
            ))}
          </div>
          <p className="micro">{copy.hero.micro(hero.micro)}</p>
        </div>
      </section>

      {/* 02 — TRUST (empty today: no consented logos, no sourced stat →
          absent from clean-view DOM via SectionGate) */}
      <SectionGate fill={hasLogos || trust.statValue ? "partial" : "empty"}>
        <section className="trust">
          <Stage>{trust.stage}</Stage>
          <div className="wrap trustin">
            {hasLogos ? (
              <div className="logos">
                {logos.map((l) =>
                  l.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={l.id} src={l.logoUrl} alt={l.name} />
                  ) : (
                    <span key={l.id}>{l.name}</span>
                  )
                )}
              </div>
            ) : (
              <EmptySlot title={trust.logosSlot.title}>
                {trust.logosSlot.note}
              </EmptySlot>
            )}
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
          <p className="eyebrow">{copy.problem.eyebrow(problem.eyebrow)}</p>
          <h2 style={{ maxWidth: "20ch", marginBottom: 36 }}>{copy.problem.h2(problem.h2)}</h2>
          <Anno annotation={problem.anno} status={problem.anno.status} />
          <div className="problems">
            <blockquote className="problem">
              &ldquo;{copy.problem.quote(problem.quote.text)}&rdquo;
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
            {fork.cards.map((card) => {
              const company = card.tag === "For companies";
              return (
                <div className="card" key={card.tag}>
                  <span className="tag">
                    {company ? copy.forkCompany.tag(card.tag) : copy.forkIndividual.tag(card.tag)}
                  </span>
                  <h3>{company ? copy.forkCompany.h3(card.h3) : copy.forkIndividual.h3(card.h3)}</h3>
                  <p>{company ? copy.forkCompany.p(card.p) : copy.forkIndividual.p(card.p)}</p>
                  <Link href={card.cta.href} className="btn">
                    {company ? copy.forkCompany.cta(card.cta.label) : copy.forkIndividual.cta(card.cta.label)}
                  </Link>
                </div>
              );
            })}
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
          <p className="eyebrow">{copy.how.eyebrow(how.eyebrow)}</p>
          <h2 style={{ maxWidth: "16ch", marginBottom: 44 }}>{copy.how.h2(how.h2)}</h2>
          <div className="steps">
            {how.steps.map((s, i) => (
              <div className="step" key={s.num}>
                <div className="stepnum">{s.num}</div>
                <h3>{copy.step(i).h3(s.h3)}</h3>
                <p>{copy.step(i).p(s.p)}</p>
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
              <p className="eyebrow">{copy.proof.eyebrow(proof.eyebrow)}</p>
              <h2 style={{ marginBottom: 22 }}>{copy.proof.h2(proof.h2)}</h2>
              <p className="lede" style={{ marginBottom: 26 }}>
                {copy.proof.lede(proof.lede)}
              </p>
              <Link href={proof.cta.href} className="btn">
                {copy.proof.cta(proof.cta.label)}
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
          <p className="eyebrow">{copy.outcomes.eyebrow(outcomes.eyebrow)}</p>
          <h2 style={{ maxWidth: "18ch", marginBottom: 44 }}>{copy.outcomes.h2(outcomes.h2)}</h2>
          <div className="outcomes">
            <div className="outcol">
              <h3>{copy.outcomes.company.h3(outcomes.company.h3)}</h3>
              <ul>
                {outcomes.company.items.map((it, i) => (
                  <li key={it.b}>
                    <b>{copy.outcomes.company.item(i).b(it.b)}</b>
                    <span>{copy.outcomes.company.item(i).span(it.span)}</span>
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

      {/* 08 — TESTIMONIALS (real ones from the DB; empty pending slots when none) */}
      <SectionGate fill={hasTestimonials ? "complete" : "empty"}>
        <section style={{ borderTop: "1px solid var(--line)" }}>
          <Stage>{testimonials.stage}</Stage>
          <div className="wrap">
            <Anno annotation={testimonials.anno} status={testimonials.anno.status} />
            <p className="eyebrow">{copy.testimonials.eyebrow(testimonials.eyebrow)}</p>
            <h2 style={{ marginBottom: 40 }}>{copy.testimonials.h2(testimonials.h2)}</h2>
            <div className="tgrid">
              {hasTestimonials
                ? liveTestimonials.map((t) => (
                    <figure className="tcard" key={t.id}>
                      <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
                      <figcaption>
                        {t.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="tphoto" src={t.photoUrl} alt={t.name} />
                        ) : null}
                        <span>
                          <strong>{t.name}</strong>
                          {t.role ? `, ${t.role}` : ""}
                          {t.company ? ` · ${t.company}` : ""}
                        </span>
                      </figcaption>
                    </figure>
                  ))
                : testimonials.slots.map((s) => (
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
          <h2>{copy.final.h2(final.h2)}</h2>
          <p>{copy.final.p(final.p)}</p>
          <Link href={final.cta.href} className="btn btn--lg">
            {copy.final.cta(final.cta.label)}
          </Link>
          <p className="micro" style={{ marginTop: 22, color: "#7c8f92" }}>
            {copy.final.microPrefix(final.microPrefix)}
            <Link href={final.microLink.href} style={{ color: "#9fb4b7" }}>
              {copy.final.microLink(final.microLink.label)}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
