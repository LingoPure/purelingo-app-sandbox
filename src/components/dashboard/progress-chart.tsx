/**
 * Per-skill score-over-time sparklines, read from gap_score_history.
 *
 * Server-rendered SVG, no client deps (matches GapRadar). De-noises on read:
 * consecutive identical scores collapse to a single point, so retry/duplicate
 * scoring runs don't clutter the line. (A write-side dedupe is a separate
 * refinement — see TODO; until then this keeps the chart clean.)
 */

type HistoryRow = { skill: string; score: number; scored_at: string };
type SkillDef = { readonly key: string; readonly label: string };

const SCALE_MAX = 1000;

/** Chronological scores for one skill, with consecutive duplicates collapsed. */
function seriesFor(history: HistoryRow[], key: string): number[] {
  const scores = history
    .filter((h) => h.skill === key)
    .slice()
    .sort((a, b) => a.scored_at.localeCompare(b.scored_at))
    .map((h) => h.score);

  const out: number[] = [];
  for (const s of scores) {
    if (out.length === 0 || out[out.length - 1] !== s) out.push(s);
  }
  return out;
}

export function ProgressChart({
  history,
  skills,
}: {
  history: HistoryRow[];
  skills: readonly SkillDef[];
}) {
  const series = skills.map((s) => ({ ...s, values: seriesFor(history, s.key) }));
  const anyTrend = series.some((s) => s.values.length >= 2);

  if (!anyTrend) {
    return (
      <p className="text-sm text-mute">
        This is your first check-in. After some lessons, run another{" "}
        <span className="font-medium text-navy">Progress check-in</span> and your
        trajectory will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {series.map((s) => (
        <SkillSpark key={s.key} label={s.label} values={s.values} />
      ))}
    </div>
  );
}

function SkillSpark({ label, values }: { label: string; values: number[] }) {
  const W = 240;
  const H = 40;
  const pad = 5;
  const latest = values.length ? values[values.length - 1] : null;
  const delta = values.length >= 2 ? latest! - values[0] : null;

  const coords =
    values.length >= 2
      ? values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * (W - 2 * pad);
          const y = H - pad - (v / SCALE_MAX) * (H - 2 * pad);
          return [x, y] as const;
        })
      : [];

  return (
    <div className="rounded-lg border border-cream bg-cream/20 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-serif text-lg text-navy">{latest ?? "—"}</span>
          {delta != null && (
            <span
              className={
                "font-mono text-[11px] " +
                (delta > 0 ? "text-teal" : delta < 0 ? "text-coral" : "text-mute")
              }
            >
              {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
            </span>
          )}
        </span>
      </div>

      {coords.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" aria-hidden>
          <polyline
            points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--color-navy)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={coords[coords.length - 1][0].toFixed(1)}
            cy={coords[coords.length - 1][1].toFixed(1)}
            r="3.5"
            fill="var(--color-gold)"
          />
        </svg>
      ) : (
        <p className="text-xs text-mute">One reading so far — no trend yet.</p>
      )}
    </div>
  );
}
