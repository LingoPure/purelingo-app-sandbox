/**
 * Server-rendered SVG radar showing the 6 LingoPure sub-skill scores against
 * the student's target. No client deps. Pure geometry.
 *
 *   - 5 concentric polygons at 20/40/60/80/100
 *   - solid filled polygon for the current scores
 *   - dashed polygon for the target line (default 80)
 *   - outer labels for each axis
 */

type Skill = { key: string; label: string; score: number | null; target: number };

type Props = {
  skills: Skill[];
  size?: number;
};

const RING_VALUES = [20, 40, 60, 80, 100];

function polarPoint(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function GapRadar({ skills, size = 360 }: Props) {
  const padding = 56;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - padding;
  const n = skills.length;

  // -π/2 puts the first axis at 12 o'clock; clockwise from there.
  const angles = skills.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);

  const buildPolygon = (values: number[]) =>
    values
      .map((v, i) => {
        const r = (Math.max(0, Math.min(100, v)) / 100) * maxRadius;
        const p = polarPoint(cx, cy, r, angles[i]);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");

  const scoreValues = skills.map((s) => s.score ?? 0);
  const targetValues = skills.map((s) => s.target);
  const hasAnyScore = skills.some((s) => s.score != null);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full max-w-[360px]"
      role="img"
      aria-label="Gap profile radar — scores across 6 sub-skills against target"
    >
      {/* Concentric reference rings */}
      {RING_VALUES.map((v) => {
        const r = (v / 100) * maxRadius;
        const points = angles
          .map((a) => {
            const p = polarPoint(cx, cy, r, a);
            return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          })
          .join(" ");
        return (
          <polygon
            key={v}
            points={points}
            fill="none"
            stroke="var(--color-cream)"
            strokeWidth={1}
          />
        );
      })}

      {/* Spokes */}
      {angles.map((a, i) => {
        const p = polarPoint(cx, cy, maxRadius, a);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-cream)"
            strokeWidth={1}
          />
        );
      })}

      {/* Target polygon (dashed) */}
      <polygon
        points={buildPolygon(targetValues)}
        fill="none"
        stroke="var(--color-navy)"
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />

      {/* Score polygon (filled) */}
      {hasAnyScore && (
        <polygon
          points={buildPolygon(scoreValues)}
          fill="var(--color-teal-soft)"
          fillOpacity={0.28}
          stroke="var(--color-teal)"
          strokeWidth={1.5}
        />
      )}

      {/* Score dots */}
      {hasAnyScore &&
        skills.map((s, i) => {
          if (s.score == null) return null;
          const r = (s.score / 100) * maxRadius;
          const p = polarPoint(cx, cy, r, angles[i]);
          return (
            <circle
              key={s.key}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="var(--color-teal)"
            />
          );
        })}

      {/* Axis labels */}
      {skills.map((s, i) => {
        const labelRadius = maxRadius + 22;
        const p = polarPoint(cx, cy, labelRadius, angles[i]);
        // Anchor based on position so labels read naturally on each side.
        const anchor =
          Math.abs(p.x - cx) < 4
            ? "middle"
            : p.x > cx
            ? "start"
            : "end";
        return (
          <text
            key={s.key}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-mute font-mono"
            fontSize={10.5}
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}
