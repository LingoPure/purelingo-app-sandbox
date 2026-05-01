import Link from "next/link";
import type { Tier } from "@/lib/gamification/rules";
import type { LanguageCode } from "@/lib/i18n/dictionary";
import { tierLabel } from "@/lib/gamification/rules";

type Props = {
  xp: number;
  streakDays: number;
  tier: Tier;
  lang: LanguageCode;
  labels: {
    title: string;
    xp: string;
    streak: string;
    streakUnit: string;
    streakUnitOne: string;
    cta: string;
  };
};

const TIER_STYLE: Record<Tier, { ring: string; chip: string; dot: string }> = {
  bronze: {
    ring: "from-[#c8973a]/40 to-[#c8973a]/10",
    chip: "border-[#c8973a]/40 bg-[#c8973a]/10 text-[#7a5a1f]",
    dot: "bg-[#c8973a]",
  },
  silver: {
    ring: "from-slate-400/40 to-slate-400/10",
    chip: "border-slate-400/40 bg-slate-400/10 text-slate-700",
    dot: "bg-slate-400",
  },
  gold: {
    ring: "from-amber-400/50 to-amber-400/10",
    chip: "border-amber-500/50 bg-amber-400/10 text-amber-700",
    dot: "bg-amber-500",
  },
};

export function GamificationCard({
  xp,
  streakDays,
  tier,
  lang,
  labels,
}: Props) {
  const style = TIER_STYLE[tier];
  const streakUnit = streakDays === 1 ? labels.streakUnitOne : labels.streakUnit;
  return (
    <section
      className={`relative overflow-hidden rounded-lg border border-cream bg-gradient-to-br ${style.ring} p-6`}
    >
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              {labels.title}
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-serif text-4xl text-navy">
                {xp.toLocaleString()}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-mute">
                {labels.xp}
              </span>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-cream sm:block" aria-hidden />

          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              {labels.streak}
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span aria-hidden className="text-2xl">
                {streakDays > 0 ? "🔥" : "·"}
              </span>
              <span className="font-serif text-3xl text-navy">{streakDays}</span>
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-mute">
                {streakUnit}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${style.chip}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${style.dot}`} />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
              {tierLabel(tier, lang)}
            </span>
          </span>
          <Link
            href="/lessons"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
          >
            {labels.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
