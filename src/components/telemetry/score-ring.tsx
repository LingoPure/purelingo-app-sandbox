/**
 * Server-rendered SVG score ring (LP-1000 style). No client deps — pure SVG.
 * Shows the score at centre and a 3/4 progress track.
 */
export function ScoreRing({
  score,
  max = 1000,
  label = "LP-1000 index",
  size = 138,
  color = "#ff9f1c",
}: {
  score: number;
  max?: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(max, score));
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const fill = (clamped / max) * c;
  const cx = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${score} ${label}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#16293a" strokeWidth="10" />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${c - fill}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  );
}

/** Small labelled progress fill, used in weekly-goal and mastery rows. */
export function TProgress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`t-progress ${className ?? ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}